export const CONFIG = {
  // Размеры игры
  GAME_WIDTH: 1280,
  GAME_HEIGHT: 720,
  
  // Карта
  MAP_WIDTH: 60,
  MAP_HEIGHT: 60,
  TILE_SIZE: 64,
  
  // Бой
  BATTLE_WIDTH: 15,
  BATTLE_HEIGHT: 11,
  BATTLE_TILE_SIZE: 64,
  
  // Игрок
  STARTING_RESOURCES: {
    gold: 5000,
    wood: 10,
    ore: 10,
    crystal: 0,
    gems: 0,
    sulfur: 0,
    mercury: 0
  },
  
  // Настройки генерации
  MAP_SEED: Date.now(),
  
  // UI
  UI_PADDING: 16,
  
  // Анимации
  ANIM_DURATION: {
    MOVEMENT: 300,
    ATTACK: 400,
    SPELL: 600,
    FADE: 200
  },
  
  // Сцены
  SCENES: {
    BOOT: 'BootScene',
    PRELOAD: 'PreloadScene',
    MENU: 'MenuScene',
    WORLD: 'WorldScene',
    BATTLE: 'BattleScene',
    TOWN: 'TownScene',
    UI: 'UIScene'
  }
} as const;
