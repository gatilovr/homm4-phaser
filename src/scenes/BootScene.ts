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

    // === ПОДЗЕМНЫЕ ТАЙЛЫ (Underground) ===
    
    // Пол пещеры (тёмно-серый с камешками)
    this.makeTexture('tile_cave_floor', TS, TS, (g) => {
      g.fillStyle(0x3a3a3a, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x2a2a2a, 0.5);
      for (let i = 0; i < 6; i++) {
        g.fillCircle(Phaser.Math.Between(4, TS - 4), Phaser.Math.Between(4, TS - 4), 2);
      }
      g.lineStyle(1, 0x1a1a1a, 0.3);
      g.strokeRect(0, 0, TS, TS);
    });

    // Скала в пещере (непроходимая, тёмная)
    this.makeTexture('tile_cave_rock', TS, TS, (g) => {
      g.fillStyle(0x1a1a1a, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x0a0a0a, 0.8);
      g.fillTriangle(TS * 0.2, TS * 0.8, TS * 0.5, TS * 0.15, TS * 0.8, TS * 0.8);
      g.fillStyle(0x2a2a2a, 0.5);
      g.fillCircle(TS * 0.3, TS * 0.4, 6);
      g.fillCircle(TS * 0.7, TS * 0.6, 8);
    });

    // Подземное озеро (тёмно-синее, светящееся)
    this.makeTexture('tile_underground_lake', TS, TS, (g) => {
      g.fillStyle(0x0a2a4a, 1);
      g.fillRect(0, 0, TS, TS);
      g.fillStyle(0x1a4a7a, 0.6);
      g.fillCircle(TS * 0.5, TS * 0.5, TS * 0.4);
      g.lineStyle(2, 0x3a8acb, 0.4);
      for (let i = 0; i < 3; i++) {
        const y = 12 + i * 14;
        g.lineBetween(8, y, TS - 8, y);
      }
      g.fillStyle(0x6ab8ff, 0.3);
      g.fillCircle(TS * 0.3, TS * 0.4, 4);
      g.fillCircle(TS * 0.7, TS * 0.6, 3);
    });

    // Грибная роща (фиолетово-зелёные грибы)
    this.makeTexture('tile_mushroom_grove', TS, TS, (g) => {
      g.fillStyle(0x2a3a2a, 1);
      g.fillRect(0, 0, TS, TS);
      // Грибы
      const drawMushroom = (x: number, y: number, color: number) => {
        g.fillStyle(0xddddcc, 1);
        g.fillRect(x - 2, y, 4, 10);
        g.fillStyle(color, 1);
        g.fillCircle(x, y, 8);
        g.fillStyle(0xffffff, 0.6);
        g.fillCircle(x - 2, y - 2, 2);
        g.fillCircle(x + 3, y + 1, 1);
      };
      drawMushroom(TS * 0.3, TS * 0.4, 0x9b59b6);
      drawMushroom(TS * 0.7, TS * 0.3, 0xe74c3c);
      drawMushroom(TS * 0.5, TS * 0.7, 0xf39c12);
      drawMushroom(TS * 0.2, TS * 0.8, 0x3498db);
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

    // === НОВЫЕ ОБЪЕКТЫ КАРТЫ ===
    
    // Школа магии (башня с свечением)
    this.makeTexture('school', S, S, (g) => {
      g.fillStyle(0x4a4a8a, 1);
      g.fillRect(20, 20, 24, 40);
      g.fillStyle(0x6a6aaa, 1);
      g.fillTriangle(32, 8, 16, 24, 48, 24);
      g.fillStyle(0xffd700, 0.8);
      g.fillCircle(32, 32, 6);
    });

    // Святилище (светящийся алтарь)
    this.makeTexture('shrine', S, S, (g) => {
      g.fillStyle(0x8b7355, 1);
      g.fillRect(16, 40, 32, 16);
      g.fillStyle(0x5a4a30, 1);
      g.fillRect(20, 24, 24, 20);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(32, 32, 8);
    });

    // Алтарь (каменный круг)
    this.makeTexture('altar', S, S, (g) => {
      g.fillStyle(0x6b6b6b, 1);
      g.fillCircle(32, 32, 20);
      g.fillStyle(0x8b8b8b, 0.8);
      g.fillCircle(32, 32, 14);
      g.fillStyle(0xffd700, 1);
      g.fillCircle(32, 32, 6);
    });

    // Обелиск (высокая колонна)
    this.makeTexture('obelisk', S, S, (g) => {
      g.fillStyle(0x5a5a5a, 1);
      g.fillRect(24, 12, 16, 48);
      g.fillStyle(0x8b8b8b, 0.8);
      g.fillTriangle(32, 4, 20, 16, 44, 16);
      g.fillStyle(0x9b59b6, 0.6);
      g.fillCircle(32, 32, 4);
    });

    // Таверна (дом с вывеской)
    this.makeTexture('tavern', S, S, (g) => {
      g.fillStyle(0x8b4513, 1);
      g.fillRect(16, 28, 32, 28);
      g.fillStyle(0xd4af37, 1);
      g.fillTriangle(32, 12, 8, 32, 56, 32);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(28, 40, 8, 16);
      g.fillStyle(0xffd700, 1);
      g.fillRect(40, 32, 6, 6);
    });

    // Хижина ведьмы (тёмный дом)
    this.makeTexture('witch_hut', S, S, (g) => {
      g.fillStyle(0x2a2a2a, 1);
      g.fillRect(16, 28, 32, 28);
      g.fillStyle(0x4a1a4a, 1);
      g.fillTriangle(32, 12, 8, 32, 56, 32);
      g.fillStyle(0x9b59b6, 0.8);
      g.fillCircle(32, 32, 5);
    });

    // Сундук с сокровищами
    this.makeTexture('treasure_chest', S, S, (g) => {
      g.fillStyle(0x8b4513, 1);
      g.fillRect(16, 24, 32, 28);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(16, 24, 32, 8);
      g.fillStyle(0xffd700, 1);
      g.fillRect(28, 32, 8, 8);
    });

    // Лагерь беженцев (палатки)
    this.makeTexture('refugee_camp', S, S, (g) => {
      g.fillStyle(0xc2b280, 1);
      g.fillTriangle(32, 16, 12, 48, 52, 48);
      g.fillStyle(0x8b7355, 0.8);
      g.fillTriangle(24, 24, 8, 48, 40, 48);
      g.fillStyle(0x5a4a30, 1);
      g.fillRect(28, 40, 8, 8);
    });

    // Гарнизон (крепость)
    this.makeTexture('garrison', S, S, (g) => {
      g.fillStyle(0x6b6b6b, 1);
      g.fillRect(12, 20, 40, 36);
      g.fillStyle(0x8b8b8b, 1);
      g.fillRect(16, 12, 8, 12);
      g.fillRect(40, 12, 8, 12);
      g.fillStyle(0x5a5a5a, 1);
      g.fillRect(26, 36, 12, 20);
    });

    // Библиотека (здание с книгами)
    this.makeTexture('library', S, S, (g) => {
      g.fillStyle(0x8b4513, 1);
      g.fillRect(16, 24, 32, 32);
      g.fillStyle(0xd4af37, 1);
      g.fillTriangle(32, 8, 12, 28, 52, 28);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(20, 32, 8, 8);
      g.fillRect(36, 32, 8, 8);
      g.fillRect(28, 44, 8, 12);
    });

    // Волшебный колодец (колодец с свечением)
    this.makeTexture('magic_well', S, S, (g) => {
      g.fillStyle(0x6b6b6b, 1);
      g.fillCircle(32, 32, 20);
      g.fillStyle(0x3498db, 0.8);
      g.fillCircle(32, 32, 14);
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(32, 32, 6);
    });

    // Оазис (вода с пальмами)
    this.makeTexture('oasis', S, S, (g) => {
      g.fillStyle(0x2e5a7c, 1);
      g.fillCircle(32, 32, 18);
      g.fillStyle(0x8b4513, 1);
      g.fillRect(30, 8, 4, 20);
      g.fillStyle(0x4a7c2e, 1);
      g.fillCircle(32, 12, 8);
    });

    // Ветряная мельница (мельница с лопастями)
    this.makeTexture('windmill', S, S, (g) => {
      g.fillStyle(0x8b4513, 1);
      g.fillRect(24, 28, 16, 28);
      g.fillStyle(0xd4af37, 1);
      g.fillTriangle(32, 12, 20, 32, 44, 32);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(30, 40, 4, 16);
    });

    // Водяное колесо (колесо в воде)
    this.makeTexture('water_wheel', S, S, (g) => {
      g.fillStyle(0x2e5a7c, 1);
      g.fillCircle(32, 32, 20);
      g.fillStyle(0x8b4513, 1);
      g.fillCircle(32, 32, 16);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(30, 16, 4, 32);
      g.fillRect(16, 30, 32, 4);
    });

    // === ПОДЗЕМНЫЙ ПОРТАЛ (Subterranean Gate) — канон HoMM4 ===
    // Связывает поверхность с подземельем
    this.makeTexture('subterranean_gate', S, S, (g) => {
      // Каменный круг
      g.fillStyle(0x4a4a4a, 1);
      g.fillCircle(32, 32, 28);
      g.fillStyle(0x2a2a2a, 1);
      g.fillCircle(32, 32, 22);
      // Светящийся вихрь
      g.fillStyle(0x9b59b6, 0.9);
      g.fillCircle(32, 32, 18);
      g.fillStyle(0x6a3a9b, 0.8);
      g.fillCircle(32, 32, 13);
      g.fillStyle(0xe74c3c, 0.6);
      g.fillCircle(32, 32, 8);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(32, 32, 3);
      // Колонны по бокам
      g.fillStyle(0x5a5a5a, 1);
      g.fillRect(4, 20, 6, 24);
      g.fillRect(54, 20, 6, 24);
      g.fillStyle(0x8b8b8b, 0.7);
      g.fillRect(4, 18, 6, 4);
      g.fillRect(54, 18, 6, 4);
    });

    // === КОРАБЛИ (Naval System — канон HoMM4) ===
    
    // Корабль (boat) — деревянная лодка с парусом
    this.makeTexture('boat', S, S, (g) => {
      // Корпус лодки (коричневый)
      g.fillStyle(0x8b4513, 1);
      g.fillRect(8, 36, 48, 16);
      g.fillStyle(0x654321, 1);
      g.fillTriangle(8, 36, 16, 28, 56, 28);
      g.fillTriangle(56, 36, 48, 28, 8, 28);
      // Мачта
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(30, 8, 4, 24);
      // Парус (белый)
      g.fillStyle(0xffffff, 0.9);
      g.fillTriangle(32, 10, 32, 28, 52, 20);
      g.fillStyle(0xeeeeee, 0.7);
      g.fillTriangle(32, 10, 32, 28, 12, 20);
      // Флаг
      g.fillStyle(0xe74c3c, 1);
      g.fillRect(30, 6, 8, 4);
    });

    // Верфь (shipyard) — док с кораблями
    this.makeTexture('shipyard', S, S, (g) => {
      // Основание дока (серое)
      g.fillStyle(0x6b6b6b, 1);
      g.fillRect(8, 40, 48, 16);
      // Столбы
      g.fillStyle(0x8b4513, 1);
      g.fillRect(12, 20, 6, 24);
      g.fillRect(46, 20, 6, 24);
      // Крыша
      g.fillStyle(0xd4af37, 1);
      g.fillTriangle(32, 8, 4, 24, 60, 24);
      // Маленькая лодка внутри
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(20, 44, 24, 8);
      g.fillStyle(0xffffff, 0.8);
      g.fillTriangle(32, 36, 32, 44, 40, 40);
    });

    // Водоворот (whirlpool) — парный телепорт на воде
    this.makeTexture('whirlpool', S, S, (g) => {
      // Тёмно-синяя вода
      g.fillStyle(0x0a2a4a, 1);
      g.fillCircle(32, 32, 28);
      // Спираль водоворота
      g.fillStyle(0x1a4a7a, 0.9);
      g.fillCircle(32, 32, 22);
      g.fillStyle(0x2e5a8a, 0.8);
      g.fillCircle(32, 32, 16);
      g.fillStyle(0x3a8acb, 0.7);
      g.fillCircle(32, 32, 10);
      g.fillStyle(0x000000, 0.9);
      g.fillCircle(32, 32, 4);
      // Брызги
      g.fillStyle(0xffffff, 0.6);
      g.fillCircle(20, 20, 2);
      g.fillCircle(44, 44, 2);
      g.fillCircle(44, 20, 2);
      g.fillCircle(20, 44, 2);
    });

    // Морской сундук (sea_chest) — плавающее сокровище
    this.makeTexture('sea_chest', S, S, (g) => {
      // Вода вокруг
      g.fillStyle(0x2e5a7c, 0.6);
      g.fillCircle(32, 32, 24);
      // Сундук
      g.fillStyle(0x8b4513, 1);
      g.fillRect(16, 24, 32, 28);
      g.fillStyle(0x5a3a0e, 1);
      g.fillRect(16, 24, 32, 8);
      g.fillStyle(0xffd700, 1);
      g.fillRect(28, 32, 8, 8);
    });

    // Плавающий мусор (flotsam) — случайные ресурсы
    this.makeTexture('flotsam', S, S, (g) => {
      g.fillStyle(0x2e5a7c, 0.6);
      g.fillCircle(32, 32, 24);
      g.fillStyle(0x8b7355, 1);
      g.fillRect(20, 28, 24, 16);
      g.fillStyle(0x5a4a30, 1);
      g.fillRect(24, 24, 16, 8);
    });

    // Бутылка с посланием (bottle)
    this.makeTexture('bottle', S, S, (g) => {
      g.fillStyle(0x2e5a7c, 0.6);
      g.fillCircle(32, 32, 24);
      g.fillStyle(0x5dade2, 0.8);
      g.fillRect(26, 20, 12, 24);
      g.fillStyle(0x8b4513, 1);
      g.fillRect(28, 16, 8, 6);
      g.fillStyle(0xffffff, 0.7);
      g.fillRect(28, 28, 8, 12);
    });

    // Затонувший корабль (shipwreck) — с призраками
    this.makeTexture('shipwreck', S, S, (g) => {
      g.fillStyle(0x0a2a4a, 0.8);
      g.fillCircle(32, 32, 28);
      // Сломанный корпус
      g.fillStyle(0x3a2a1a, 1);
      g.fillRect(12, 36, 40, 12);
      g.fillTriangle(12, 36, 20, 28, 52, 28);
      // Сломанная мачта
      g.fillStyle(0x2a1a0a, 1);
      g.fillRect(28, 16, 4, 16);
      // Призрак
      g.fillStyle(0xffffff, 0.5);
      g.fillCircle(40, 24, 6);
      g.fillRect(36, 28, 8, 10);
    });

    // Морское чудовище (sea_monster)
    this.makeTexture('sea_monster', S, S, (g) => {
      g.fillStyle(0x0a2a4a, 0.8);
      g.fillCircle(32, 32, 28);
      // Тело чудовища (тёмно-зелёное)
      g.fillStyle(0x1a5a3a, 1);
      g.fillCircle(32, 32, 18);
      // Щупальца
      g.fillStyle(0x2a7a5a, 1);
      g.fillRect(16, 40, 8, 12);
      g.fillRect(40, 40, 8, 12);
      // Глаза
      g.fillStyle(0xffd700, 1);
      g.fillCircle(26, 28, 4);
      g.fillCircle(38, 28, 4);
      g.fillStyle(0x000000, 1);
      g.fillCircle(26, 28, 2);
      g.fillCircle(38, 28, 2);
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
      const g = this.make.graphics({} as any); // Phaser expects { add?: boolean } but types may differ
      drawFn(g);
      g.generateTexture(key, width, height);
      g.destroy();
    } catch (error) {
      console.error(`[BootScene] Failed to create texture '${key}':`, error);
    }
  }
}
