/* ============================================================
   levelLoader.js — Loads level definitions and instantiates
   all entities.  Levels 1-2 are JSON; 3-5 are defined inline
   here so the game has zero external fetch dependencies.
   ============================================================ */

// LEVELS_DATA removed. Level loader now fetches levels dynamically.

/* ============================================================
   LevelLoader — instantiates a level from data
   ============================================================ */
class LevelLoader {
  constructor() {
    this._cache = {};
  }

  /* Returns a promise resolving to raw level data object */
  async loadData(levelId) {
    if (this._cache[levelId]) return this._cache[levelId];
    try {
      const response = await fetch(`levels/level${levelId}.json`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      this._cache[levelId] = data;
      return data;
    } catch (e) {
      console.error(`LevelLoader: failed to load level ${levelId}`, e);
      return null;
    }
  }

  /* Instantiate all entities from level data */
  instantiate(data) {
    const platforms   = (data.platforms    || []).map(d => new Platform(d));
    const hazards     = (data.hazards      || []).map(d => new Hazard(d));
    const collectibles= (data.collectibles || []).map(d => new Collectible(d));
    const enemies     = (data.enemies      || []).map(d => new Enemy(d));

    // Count gems for HUD
    const totalGems = collectibles.filter(c => c.type === 'gem').length;

    // Exit: start closed (game logic opens it at gem threshold)
    const exit = collectibles.find(c => c.type === 'exit');
    if (exit) exit.open = false;  // always start closed; game opens at threshold

    return {
      platforms,
      hazards,
      collectibles,
      enemies,
      totalGems,
      exit,
      spawn:  data.spawn  || { x: 32, y: 200 },
      worldW: data.worldW || 1200,
      worldH: data.worldH || 400,
      name:   data.name   || `LEVEL ${data.id}`,
      theme:  data.theme  || 0,
      bgMusic:data.bgMusic || 0,
    };
  }
}