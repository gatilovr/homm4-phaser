import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { WorldScene } from './scenes/WorldScene';
import { BattleScene } from './scenes/BattleScene';
import { TownScene } from './scenes/TownScene';
import { UIScene } from './scenes/UIScene';
import { CONFIG } from './config';

// Скрываем loading screen
window.addEventListener('load', () => {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
});

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: CONFIG.GAME_WIDTH,
  height: CONFIG.GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0a0a0f',
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    WorldScene,
    BattleScene,
    TownScene,
    UIScene
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  pixelArt: false,
  antialias: true,
  banner: {
    text: '#d4af37',
    background: ['#1a1a2e', '#0a0a0f'],
    hidePhaser: true,
    hideVersion: false
  }
};

console.log('🎮 Starting Heroes IV - Phaser Edition...');
console.log('📦 Phaser version:', Phaser.VERSION);
console.log('📋 Scenes:', config.scene?.map((s: any) => s.prototype?.constructor?.name || 'unknown'));

try {
  const game = new Phaser.Game(config);
  console.log('✅ Game instance created!');
  
  // Отладка: следим за сменой сцен
  game.events.on('ready', () => {
    console.log('🎮 Game ready!');
  });
  
  (window as any).__game = game;
  
} catch (error) {
  console.error('❌ Failed to create game:', error);
  const container = document.getElementById('game-container');
  if (container) {
    container.innerHTML = `
      <div style="color: #e74c3c; text-align: center; padding: 40px;">
        <h1>❌ Ошибка запуска</h1>
        <p style="color: #aaa; margin-top: 20px;">${error}</p>
        <p style="color: #888; margin-top: 10px;">Откройте консоль (F12) для подробностей.</p>
      </div>
    `;
  }
}
