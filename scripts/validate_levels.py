import json
import os
import math

class LevelValidator:
    def __init__(self, level_dir="levels"):
        self.level_dir = level_dir

    def calculate_distance(self, p1, p2):
        return math.sqrt((p1['x'] - p2['x'])**2 + (p1['y'] - p2['y'])**2)

    def check_overlap(self, rect1, rect2):
        # rect structure: {x, y, w, h}
        # Check if they overlap
        return (rect1['x'] < rect2['x'] + rect2['w'] and
                rect1['x'] + rect1['w'] > rect2['x'] and
                rect1['y'] < rect2['y'] + rect2['h'] and
                rect1['y'] + rect1['h'] > rect2['y'])

    def point_in_rect(self, px, py, rect):
        return (rect['x'] <= px <= rect['x'] + rect['w'] and
                rect['y'] <= py <= rect['y'] + rect['h'])

    def validate_level(self, filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)

        level_id = data.get('id', 'Unknown')
        name = data.get('name', 'Unnamed')
        errors = []
        warnings = []

        spawn = data.get('spawn', {})
        platforms = data.get('platforms', [])
        hazards = data.get('hazards', [])
        collectibles = data.get('collectibles', [])
        enemies = data.get('enemies', [])

        # 1. Validate Player Spawn Position
        if not spawn:
            errors.append("No player spawn point defined.")
        else:
            spawn_x, spawn_y = spawn.get('x', 0), spawn.get('y', 0)
            # Check if spawn is trapped inside a static platform
            for plat in platforms:
                if plat.get('type') == 'static' and self.point_in_rect(spawn_x, spawn_y, plat):
                    errors.append(f"Player spawns INSIDE static platform at ({spawn_x}, {spawn_y}). Plat: x={plat['x']}, y={plat['y']}, w={plat['w']}, h={plat['h']}.")

        # 2. Check for Checkpoint Spawn-Death Loops
        checkpoints = [c for c in collectibles if c.get('type') == 'checkpoint']
        for cp in checkpoints:
            cp_rect = {'x': cp['x'] - 10, 'y': cp['y'] - 10, 'w': 20, 'h': 20} # rough checkpoint size
            for haz in hazards:
                haz_rect = {'x': haz['x'], 'y': haz['y'], 'w': haz.get('w', 16), 'h': haz.get('h', 12)}
                if self.check_overlap(cp_rect, haz_rect):
                    errors.append(f"Checkpoint at ({cp['x']}, {cp['y']}) overlaps with hazard '{haz['type']}' at ({haz['x']}, {haz['y']}). This creates a respawn-death loop!")

        # 3. Check for Collectibles Placed on Spikes or Hazards
        for col in collectibles:
            col_type = col.get('type', 'item')
            col_rect = {'x': col['x'] - 8, 'y': col['y'] - 8, 'w': 16, 'h': 16} # standard item bounding box
            for haz in hazards:
                haz_rect = {'x': haz['x'], 'y': haz['y'], 'w': haz.get('w', 16), 'h': haz.get('h', 12)}
                if self.check_overlap(col_rect, haz_rect):
                    warnings.append(f"Collectible '{col_type}' at ({col['x']}, {col['y']}) is overlapping with hazard '{haz['type']}' at ({haz['x']}, {haz['y']}).")

        # 4. Check for Enemies Spawning Inside Static Platforms or Hazards
        for en in enemies:
            en_type = en.get('type', 'enemy')
            en_rect = {'x': en['x'] - 12, 'y': en['y'] - 12, 'w': 24, 'h': 24} # generic enemy bounding box
            for haz in hazards:
                if haz.get('type') == 'lava': # specific warning for spawning inside lava/hazards
                    haz_rect = {'x': haz['x'], 'y': haz['y'], 'w': haz.get('w', 16), 'h': haz.get('h', 12)}
                    if self.check_overlap(en_rect, haz_rect):
                        warnings.append(f"Enemy '{en_type}' at ({en['x']}, {en['y']}) spawns inside hazard '{haz['type']}' at ({haz['x']}, {haz['y']}).")

        # 5. Out of Bounds Check
        world_w = data.get('worldW', 1200)
        world_h = data.get('worldH', 400)
        for entity_list, name_list in [(platforms, 'Platform'), (hazards, 'Hazard'), (collectibles, 'Collectible'), (enemies, 'Enemy')]:
            for ent in entity_list:
                ex = ent.get('x', 0)
                ey = ent.get('y', 0)
                if ex < 0 or ex > world_w or ey < 0 or ey > world_h:
                    warnings.append(f"{name_list} of type '{ent.get('type', 'generic')}' at ({ex}, {ey}) is outside the world bounds (0-{world_w}, 0-{world_h}).")

        return {
            "id": level_id,
            "name": name,
            "errors": errors,
            "warnings": warnings,
            "passed": len(errors) == 0
        }

    def run(self):
        print("="*60)
        print("          🕹️  BOUNCE LEVEL DATA CI/CD VALIDATOR")
        print("="*60)
        
        all_passed = True
        reports = []
        
        for filename in sorted(os.listdir(self.level_dir)):
            if filename.endswith(".json"):
                filepath = os.path.join(self.level_dir, filename)
                report = self.validate_level(filepath)
                reports.append(report)
                
                status = "✅ PASSED" if report["passed"] else "❌ FAILED"
                print(f"Level {report['id']} ({report['name']}): {status}")
                if report["errors"]:
                    print("  🚨 Errors:")
                    for err in report["errors"]:
                        print(f"    - {err}")
                if report["warnings"]:
                    print("  ⚠️  Warnings:")
                    for warn in report["warnings"]:
                        print(f"    - {warn}")
                print("-" * 50)
                if not report["passed"]:
                    all_passed = False
                    
        print(f"\nFinal CI/CD Level Validation Result: " + ("PASS" if all_passed else "FAIL"))
        print("="*60)

if __name__ == "__main__":
    validator = LevelValidator()
    validator.run()
