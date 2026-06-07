import Phaser from 'phaser';
import { CONFIG } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: CONFIG.SCENES.BOOT });
  }

  create(): void {
    console.log('[BootScene] Starting texture generation...');
    
    try {
      this.generateAllTextures();
      console.log('[BootScene] All textures generated!');
      this.scene.start(CONFIG.SCENES.PRELOAD);
    } catch (error) {
      console.error('[BootScene] ERROR:', error);
      // Всё равно переходим дальше
      this.scene.start(CONFIG.SCENES.PRELOAD);
    }
  }

  private generateAllTextures(): void {
    const TS = CONFIG.TILE_SIZE; // 64

    // === Fallback текстура (розовый квадрат) ===
    this.makeTexture('__fallback', TS, TS, (g) => {
      g.fillStyle(0xff00ff, 1);
      g.fillRect(0, 0, TS, TS);
      g.lineStyle(2, 0x000000, 1);
      g.strokeRect(0, 0, TS, TS);
    });

    // === Тайлы карты ===
    this.makeTexture('tile_grass', TS, TS, (g) => {
      g.fillStyle(0x4a7c2e, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x3a6022, 0.5);
      for (let i = 0; i < 8; i++) {
        g.fillRect(Phaser.Math.Between(2, TS - 4), Phaser.Math.Between(2, TS - 4), 2, 6);
      }
    });

    this.makeTexture('tile_sand', TS, TS, (g) => {
      g.fillStyle(0xc2b280, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0xd4c090, 0.5);
      for (let i = 0; i < 5; i++) {
        g.fillCircle(Phaser.Math.Between(4, TS - 4), Phaser.Math.Between(4, TS - 4), 3);
      }
    });

    this.makeTexture('tile_water', TS, TS, (g) => {
      g.fillStyle(0x2e5a7c, 1);
      g.fillRect(0, 0, TS, TS);
      g.lineStyle(2, 0x1a4a6c, 0.6);
      for (let i = 0; i < 4; i++) {
        const y = 8 + i * 14;
        g.lineBetween(4, y, TS - 4, y);
      }
    });

    this.makeTexture('tile_rock', TS, TS, (g) => {
      g.fillStyle(0x6b6b6b, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x555555, 0.7);
      g.fillTriangle(TS * 0.2, TS * 0.8, TS * 0.5, TS * 0.2, TS * 0.8, TS * 0.8);
    });

    this.makeTexture('tile_snow', TS, TS, (g) => {
      g.fillStyle(0xe8e8e8, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(TS * 0.3, TS * 0.3, 5);
      g.fillCircle(TS * 0.7, TS * 0.6, 6);
    });

    this.makeTexture('tile_swamp', TS, TS, (g) => {
      g.fillStyle(0x3d5a3d, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x2a4a2a, 0.6);
      g.fillCircle(TS * 0.3, TS * 0.5, 8);
      g.fillCircle(TS * 0.7, TS * 0.4, 10);
    });

    this.makeTexture('tile_lava', TS, TS, (g) => {
      g.fillStyle(0xc0392b, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0xff4500, 0.7);
      g.fillCircle(TS * 0.3, TS * 0.4, 8);
      g.fillCircle(TS * 0.7, TS * 0.6, 10);
    });

    this.makeTexture('tile_forest', TS, TS, (g) => {
      g.fillStyle(0x2d5016, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x1a3a0e, 0.8);
      g.fillCircle(TS * 0.3, TS * 0.3, 10);
      g.fillCircle(TS * 0.7, TS * 0.4, 12);
      g.fillCircle(TS * 0.5, TS * 0.7, 10);
    });

    // === Объекты карты (64×64) ===
    const S = 64;

    // Город игрока
    this.makeTexture('town', S, S, (g) => {
      g.fillStyle(0x8b4513, 1);
      g.fillRect(12, 24, 40, 36);
      g.fillStyle(0xd4af37, 1);
      g.fillTriangle(32, 4, 4, 28, 60, 28);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(26, 36, 12, 20);
    });

    // Вражеский город
    this.makeTexture('enemy_town', S, S, (g) => {
      g.fillStyle(0x5a1a1a, 1);
      g.fillRect(12, 24, 40, 36);
      g.fillStyle(0x8b0000, 1);
      g.fillTriangle(32, 4, 4, 28, 60, 28);
      g.fillStyle(0x2a0a0a, 1);
      g.fillRect(26, 36, 12, 20);
    });

    // Герой
    this.makeTexture('hero', S, S, (g) => {
      g.fillStyle(0x4169e1, 1);
      g.fillCircle(32, 18, 12);
      g.fillStyle(0x8b0000, 1);
      g.fillRect(24, 28, 16, 22);
      g.fillStyle(0x333333, 1);
      g.fillRect(22, 48, 8, 10);
      g.fillRect(34, 48, 8, 10);
    });

    // Вражеский герой
    this.makeTexture('enemy_hero', S, S, (g) => {
      g.fillStyle(0xe74c3c, 1);
      g.fillCircle(32, 18, 12);
      g.fillStyle(0x333333, 1);
      g.fillRect(24, 28, 16, 22);
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(22, 48, 8, 10);
      g.fillRect(34, 48, 8, 10);
    });

    // Шахта
    this.makeTexture('mine', S, S, (g) => {
      g.fillStyle(0x654321, 1);
      g.fillTriangle(32, 12, 12, 48, 52, 48);
      g.fillStyle(0x000000, 1);
      g.fillRect(24, 34, 16, 18);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(32, 28, 5);
    });

    // Артефакт (звезда из прямоугольников - надёжнее чем fillPoints)
    this.makeTexture('artifact', S, S, (g) => {
      g.fillStyle(0xffd700, 1);
      // Центральный квадрат
      g.fillRect(24, 24, 16, 16);
      // Лучи
      g.fillRect(28, 8, 8, 16);   // верх
      g.fillRect(28, 40, 8, 16);  // низ
      g.fillRect(8, 28, 16, 8);   // лево
      g.fillRect(40, 28, 16, 8);  // право
      // Центр
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(32, 32, 6);
    });

    // Существо нейтральное
    this.makeTexture('creature', S, S, (g) => {
      g.fillStyle(0xff4500, 1);
      g.fillCircle(32, 32, 20);
      g.fillStyle(0x000000, 1);
      g.fillCircle(25, 26, 4);
      g.fillCircle(39, 26, 4);
      g.fillStyle(0xffffff, 1);
      g.fillRect(25, 40, 14, 3);
    });

    // Ресурс
    this.makeTexture('resource', S, S, (g) => {
      g.fillStyle(0xc2b280, 1);
      g.fillRect(16, 24, 32, 24);
      g.fillStyle(0x8b7355, 1);
      g.fillRect(20, 16, 24, 12);
      g.lineStyle(2, 0x5a4a30, 1);
      g.strokeRect(16, 24, 32, 24);
    });

    // Портал
    this.makeTexture('portal', S, S, (g) => {
      g.fillStyle(0x9b59b6, 0.9);
      g.fillCircle(32, 32, 24);
      g.fillStyle(0xe74c3c, 0.6);
      g.fillCircle(32, 32, 14);
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(32, 32, 6);
    });

    // === Тайлы боя ===
    const BTS = CONFIG.BATTLE_TILE_SIZE;

    this.makeTexture('battle_tile', BTS, BTS, (g) => {
      g.fillStyle(0x5a7c4e, 1);
      g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(1, 0x3d5a33, 0.5);
      g.strokeRect(0, 0, BTS, BTS);
    });

    this.makeTexture('battle_tile_light', BTS, BTS, (g) => {
      g.fillStyle(0x6a8c5e, 1);
      g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(1, 0x4d6a43, 0.5);
      g.strokeRect(0, 0, BTS, BTS);
    });

    this.makeTexture('obstacle', BTS, BTS, (g) => {
      g.fillStyle(0x6b6b6b, 1);
      g.fillCircle(BTS / 2, BTS / 2, 24);
      g.fillStyle(0x4a4a4a, 1);
      g.fillCircle(BTS / 2 - 6, BTS / 2 - 6, 14);
    });

    this.makeTexture('battle_unit', BTS, BTS, (g) => {
      g.fillStyle(0x3498db, 1);
      g.fillCircle(BTS / 2, BTS * 0.35, 14);
      g.fillStyle(0x2980b9, 1);
      g.fillRect(BTS * 0.3, BTS * 0.5, BTS * 0.4, BTS * 0.35);
    });

    this.makeTexture('enemy_unit', BTS, BTS, (g) => {
      g.fillStyle(0xe74c3c, 1);
      g.fillCircle(BTS / 2, BTS * 0.35, 14);
      g.fillStyle(0xc0392b, 1);
      g.fillRect(BTS * 0.3, BTS * 0.5, BTS * 0.4, BTS * 0.35);
    });

    this.makeTexture('hero_unit', BTS, BTS, (g) => {
      g.fillStyle(0xf39c12, 1);
      g.fillCircle(BTS / 2, BTS * 0.35, 14);
      g.fillStyle(0xf1c40f, 1);
      g.fillRect(BTS * 0.3, BTS * 0.5, BTS * 0.4, BTS * 0.35);
    });

    // === UI текстуры ===
    this.makeTexture('highlight', BTS, BTS, (g) => {
      g.fillStyle(0x2ecc71, 0.25);
      g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(2, 0x2ecc71, 0.8);
      g.strokeRect(1, 1, BTS - 2, BTS - 2);
    });

    this.makeTexture('target', BTS, BTS, (g) => {
      g.fillStyle(0xe74c3c, 0.25);
      g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(2, 0xe74c3c, 0.8);
      g.strokeRect(1, 1, BTS - 2, BTS - 2);
    });

    // Белый пиксель
    this.makeTexture('pixel', 4, 4, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 4, 4);
    });

    // Частица для эффектов магии
    this.makeTexture('particle', 8, 8, (g) => {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(4, 4, 4);
    });

    // Иконки эффектов
    this.makeTexture('effect_bless', 16, 16, (g) => {
      g.fillStyle(0xffd700, 1);
      g.fillCircle(8, 8, 7);
    });

    this.makeTexture('effect_curse', 16, 16, (g) => {
      g.fillStyle(0x8b0000, 1);
      g.fillCircle(8, 8, 7);
    });

    console.log('[BootScene] All textures created successfully!');
  }

  /**
   * Безопасное создание текстуры из Graphics
   */
  private makeTexture(key: string, width: number, height: number, drawFn: (g: Phaser.GameObjects.Graphics) => void): void {
    try {
      const g = this.make.graphics({ add: false });
      drawFn(g);
      g.generateTexture(key, width, height);
      g.destroy();
    } catch (error) {
      console.error(`[BootScene] Failed to create texture '${key}':`, error);
    }
  }
}
