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

    // === Тайлы карты (улучшенные процедурные текстуры) ===
    
    // Трава — базовый тайл с деталями
    this.makeTexture('tile_grass', TS, TS, (g) => {
      // Основной фон с градиентом
      g.fillStyle(0x4a7c2e, 1);
      g.fillRect(0, 0, TS, TS);
      // Травинки (разные оттенки)
      g.fillStyle(0x3a6022, 0.6);
      for (let i = 0; i < 12; i++) {
        const x = Phaser.Math.Between(2, TS - 4);
        const y = Phaser.Math.Between(2, TS - 4);
        g.fillRect(x, y, 2, Phaser.Math.Between(4, 8));
      }
      // Тёмные пятна (мoss)
      g.fillStyle(0x2d4a1a, 0.4);
      g.fillCircle(TS * 0.3, TS * 0.6, 6);
      g.fillCircle(TS * 0.7, TS * 0.3, 5);
      // Светлые блики
      g.fillStyle(0x5a9a3e, 0.3);
      g.fillCircle(TS * 0.5, TS * 0.5, 4);
    });

    // Песок — с рябью и тенями
    this.makeTexture('tile_sand', TS, TS, (g) => {
      g.fillStyle(0xc2b280, 1);
      g.fillRect(0, 0, TS, TS);
      // Песчинки
      g.fillStyle(0xd4c090, 0.6);
      for (let i = 0; i < 15; i++) {
        g.fillCircle(Phaser.Math.Between(4, TS - 4), Phaser.Math.Between(4, TS - 4), Phaser.Math.Between(1, 3));
      }
      // Тени от дюн
      g.fillStyle(0xb0a070, 0.5);
      g.fillCircle(TS * 0.7, TS * 0.7, 12);
      // Блики
      g.fillStyle(0xe0d0a0, 0.4);
      g.fillCircle(TS * 0.3, TS * 0.4, 8);
    });

    // Вода — с волнами и бликами
    this.makeTexture('tile_water', TS, TS, (g) => {
      g.fillStyle(0x2e5a7c, 1);
      g.fillRect(0, 0, TS, TS);
      // Волны
      g.lineStyle(2, 0x4a8aac, 0.6);
      for (let i = 0; i < 5; i++) {
        const y = 6 + i * 12;
        g.lineBetween(4, y, TS - 4, y + 2);
      }
      // Блики
      g.fillStyle(0x8ac4ff, 0.3);
      g.fillCircle(TS * 0.3, TS * 0.3, 5);
      g.fillCircle(TS * 0.7, TS * 0.6, 4);
      // Глубина
      g.fillStyle(0x1a3a5c, 0.4);
      g.fillCircle(TS * 0.5, TS * 0.8, 8);
    });

    // Скала — с трещинами и фактурой
    this.makeTexture('tile_rock', TS, TS, (g) => {
      g.fillStyle(0x6b6b6b, 1);
      g.fillRect(0, 0, TS, TS);
      // Основная скала
      g.fillStyle(0x555555, 0.8);
      g.fillTriangle(TS * 0.2, TS * 0.8, TS * 0.5, TS * 0.2, TS * 0.8, TS * 0.8);
      // Трещины
      g.lineStyle(1, 0x444444, 0.6);
      g.lineBetween(TS * 0.3, TS * 0.3, TS * 0.6, TS * 0.5);
      g.lineBetween(TS * 0.5, TS * 0.4, TS * 0.7, TS * 0.7);
      // Блики
      g.fillStyle(0x888888, 0.4);
      g.fillCircle(TS * 0.4, TS * 0.5, 4);
    });

    // Снег — с текстурой и тенями
    this.makeTexture('tile_snow', TS, TS, (g) => {
      g.fillStyle(0xe8e8e8, 1);
      g.fillRect(0, 0, TS, TS);
      // Снежинки
      g.fillStyle(0xffffff, 0.8);
      for (let i = 0; i < 10; i++) {
        g.fillCircle(Phaser.Math.Between(4, TS - 4), Phaser.Math.Between(4, TS - 4), Phaser.Math.Between(1, 3));
      }
      // Тени от сугробов
      g.fillStyle(0xd0d0d0, 0.5);
      g.fillCircle(TS * 0.3, TS * 0.6, 10);
      g.fillCircle(TS * 0.7, TS * 0.4, 8);
      // Блики
      g.fillStyle(0xffffff, 0.4);
      g.fillCircle(TS * 0.5, TS * 0.5, 5);
    });

    // Болото — с пузырями и мхом
    this.makeTexture('tile_swamp', TS, TS, (g) => {
      g.fillStyle(0x3d5a3d, 1);
      g.fillRect(0, 0, TS, TS);
      // Мох
      g.fillStyle(0x2a4a2a, 0.6);
      g.fillCircle(TS * 0.3, TS * 0.5, 10);
      g.fillCircle(TS * 0.7, TS * 0.4, 12);
      // Пузыри
      g.fillStyle(0x4a6a4a, 0.5);
      g.fillCircle(TS * 0.5, TS * 0.7, 4);
      g.fillCircle(TS * 0.2, TS * 0.3, 3);
      // Водоросли
      g.fillStyle(0x1a3a1a, 0.6);
      g.fillRect(TS * 0.4, TS * 0.2, 3, 8);
      g.fillRect(TS * 0.6, TS * 0.6, 3, 8);
    });

    // Лава — с потоками и свечением
    this.makeTexture('tile_lava', TS, TS, (g) => {
      g.fillStyle(0xc0392b, 1);
      g.fillRect(0, 0, TS, TS);
      // Потоки лавы
      g.fillStyle(0xff4500, 0.7);
      g.fillCircle(TS * 0.3, TS * 0.4, 10);
      g.fillCircle(TS * 0.7, TS * 0.6, 12);
      // Свечение
      g.fillStyle(0xff6600, 0.4);
      g.fillCircle(TS * 0.5, TS * 0.5, 8);
      // Остывающие участки
      g.fillStyle(0x8b0000, 0.6);
      g.fillCircle(TS * 0.2, TS * 0.8, 6);
      g.fillCircle(TS * 0.8, TS * 0.2, 5);
    });

    // Лес — с деревьями и тенями
    this.makeTexture('tile_forest', TS, TS, (g) => {
      g.fillStyle(0x2d5016, 1);
      g.fillRect(0, 0, TS, TS);
      // Деревья (крона)
      g.fillStyle(0x1a3a0e, 0.8);
      g.fillCircle(TS * 0.3, TS * 0.3, 12);
      g.fillCircle(TS * 0.7, TS * 0.4, 14);
      g.fillCircle(TS * 0.5, TS * 0.7, 11);
      // Стволы
      g.fillStyle(0x4a3a0e, 0.8);
      g.fillRect(TS * 0.28, TS * 0.35, 3, 8);
      g.fillRect(TS * 0.68, TS * 0.45, 3, 8);
      // Тени
      g.fillStyle(0x1a2a0e, 0.4);
      g.fillCircle(TS * 0.4, TS * 0.5, 6);
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

    // Город игрока — детализированный
    this.makeTexture('town', S, S, (g) => {
      // Фундамент
      g.fillStyle(0x654321, 1); g.fillRect(8, 44, 48, 16);
      // Стены
      g.fillStyle(0x8b4513, 1); g.fillRect(12, 24, 40, 24);
      // Башни
      g.fillStyle(0x8b4513, 1); g.fillRect(8, 16, 12, 32); g.fillRect(44, 16, 12, 32);
      // Крыша
      g.fillStyle(0xd4af37, 1); g.fillTriangle(32, 4, 4, 24, 60, 24);
      // Ворота
      g.fillStyle(0x5a3a0e, 1); g.fillRect(24, 32, 16, 16);
      g.fillStyle(0x3a2a0e, 1); g.fillRect(28, 36, 8, 12);
      // Флаг
      g.fillStyle(0x4169e1, 1); g.fillRect(52, 8, 2, 16);
      g.fillStyle(0x4169e1, 0.8); g.fillRect(54, 8, 8, 6);
    });

    // Вражеский город — зловещий
    this.makeTexture('enemy_town', S, S, (g) => {
      // Фундамент
      g.fillStyle(0x2a0a0a, 1); g.fillRect(8, 44, 48, 16);
      // Стены
      g.fillStyle(0x5a1a1a, 1); g.fillRect(12, 24, 40, 24);
      // Башни
      g.fillStyle(0x5a1a1a, 1); g.fillRect(8, 16, 12, 32); g.fillRect(44, 16, 12, 32);
      // Крыша
      g.fillStyle(0x8b0000, 1); g.fillTriangle(32, 4, 4, 24, 60, 24);
      // Ворота
      g.fillStyle(0x2a0a0a, 1); g.fillRect(24, 32, 16, 16);
      g.fillStyle(0x1a0505, 1); g.fillRect(28, 36, 8, 12);
      // Флаг
      g.fillStyle(0x8b0000, 1); g.fillRect(52, 8, 2, 16);
      g.fillStyle(0x8b0000, 0.8); g.fillRect(54, 8, 8, 6);
      // Свечения
      g.fillStyle(0xff4500, 0.3); g.fillCircle(32, 20, 8);
    });

    // Герой — рыцарь
    this.makeTexture('hero', S, S, (g) => {
      // Тело
      g.fillStyle(0x4169e1, 1); g.fillRect(24, 24, 16, 20);
      // Голова
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 16, 10);
      // Шлем
      g.fillStyle(0xc0c0c0, 1); g.fillRect(24, 10, 16, 8);
      // Глаза
      g.fillStyle(0x000000, 1); g.fillCircle(29, 16, 2); g.fillCircle(35, 16, 2);
      // Ноги
      g.fillStyle(0x8b4513, 1); g.fillRect(24, 44, 8, 10); g.fillRect(36, 44, 8, 10);
      // Меч
      g.fillStyle(0xc0c0c0, 1); g.fillRect(44, 20, 4, 16);
      g.fillStyle(0xffd700, 1); g.fillRect(42, 18, 8, 4);
    });

    // Вражеский герой — некромант
    this.makeTexture('enemy_hero', S, S, (g) => {
      // Тело
      g.fillStyle(0x1a1a1a, 1); g.fillRect(24, 24, 16, 20);
      // Голова
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(32, 16, 10);
      // Шляпа
      g.fillStyle(0x1a1a1a, 1); g.fillTriangle(32, 2, 22, 12, 42, 12);
      // Глаза
      g.fillStyle(0xff0000, 1); g.fillCircle(29, 16, 2); g.fillCircle(35, 16, 2);
      // Плащ
      g.fillStyle(0x1a1a1a, 0.8); g.fillRect(16, 20, 8, 28); g.fillRect(40, 20, 8, 28);
      // Посох
      g.fillStyle(0x654321, 1); g.fillRect(44, 8, 4, 36);
      g.fillStyle(0x9b59b6, 1); g.fillCircle(46, 6, 6);
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

    // === СПРАЙТЫ СУЩЕСТВ (64×64) ===
    // Каждая фракция имеет уникальные цвета и формы

    // --- HAVEN (рыцари, свет, порядок) ---
    this.makeTexture('squire', S, S, (g) => {
      // Пехотинец с щитом
      g.fillStyle(0xc0c0c0, 1); g.fillRect(24, 20, 16, 28); // Доспех
      g.fillStyle(0x8b4513, 1); g.fillRect(28, 12, 8, 10); // Шлем
      g.fillStyle(0x4169e1, 1); g.fillCircle(32, 44, 10); // Щит
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 44, 4); // Эмблема
    });

    this.makeTexture('ballista', S, S, (g) => {
      // Баллиста (осадная машина)
      g.fillStyle(0x8b4513, 1); g.fillRect(16, 40, 32, 8); // Основание
      g.fillStyle(0x654321, 1); g.fillRect(28, 16, 8, 28); // Ствол
      g.fillStyle(0xc0c0c0, 1); g.fillRect(24, 12, 16, 6); // Наконечник
      g.fillStyle(0x8b0000, 1); g.fillCircle(32, 20, 4); // Точка
    });

    this.makeTexture('pikeman_h4', S, S, (g) => {
      // Копейщик
      g.fillStyle(0xc0c0c0, 1); g.fillRect(24, 24, 16, 24); // Доспех
      g.fillStyle(0x8b4513, 1); g.fillRect(28, 16, 8, 10); // Шлем
      g.fillStyle(0x654321, 1); g.fillRect(30, 4, 4, 20); // Копьё
      g.fillStyle(0xc0c0c0, 1); g.fillRect(28, 2, 8, 4); // Наконечник
    });

    this.makeTexture('archer_h4', S, S, (g) => {
      // Лучник
      g.fillStyle(0x228b22, 1); g.fillRect(24, 24, 16, 24); // Туника
      g.fillStyle(0x8b4513, 1); g.fillRect(28, 16, 8, 10); // Шлем
      g.fillStyle(0x654321, 1); g.fillRect(44, 20, 4, 24); // Лук
      g.fillStyle(0xc0c0c0, 1); g.fillRect(46, 18, 2, 8); // Стрела
    });

    this.makeTexture('crusader_h4', S, S, (g) => {
      // Крестоносец
      g.fillStyle(0xffd700, 1); g.fillRect(22, 20, 20, 28); // Доспех
      g.fillStyle(0x8b4513, 1); g.fillRect(26, 10, 12, 12); // Шлем
      g.fillStyle(0xffffff, 1); g.fillRect(30, 22, 4, 12); // Крест
      g.fillStyle(0xffffff, 1); g.fillRect(26, 26, 12, 4); // Крест
    });

    this.makeTexture('champion_h4', S, S, (g) => {
      // Чемпион (рыцарь на коне)
      g.fillStyle(0xc0c0c0, 1); g.fillRect(20, 16, 24, 20); // Доспех
      g.fillStyle(0x8b4513, 1); g.fillRect(26, 8, 12, 10); // Шлем
      g.fillStyle(0x654321, 1); g.fillRect(16, 36, 32, 16); // Конь
      g.fillStyle(0x4169e1, 1); g.fillCircle(32, 12, 6); // Плюмаж
    });

    this.makeTexture('angel_h4', S, S, (g) => {
      // Ангел
      g.fillStyle(0xffffff, 1); g.fillRect(24, 20, 16, 24); // Тело
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 14, 8); // Голова
      g.fillStyle(0xffffff, 0.8); // Крылья
      g.fillTriangle(12, 24, 24, 32, 12, 40);
      g.fillTriangle(52, 24, 40, 32, 52, 40);
      g.fillStyle(0xffd700, 1); g.fillRect(30, 44, 4, 12); // Меч
    });

    // --- NECROPOLIS (нежить, тьма, смерть) ---
    this.makeTexture('skeleton_h4', S, S, (g) => {
      // Скелет
      g.fillStyle(0xe8e8e8, 1); g.fillRect(28, 16, 8, 28); // Рёбра
      g.fillStyle(0xffffff, 1); g.fillCircle(32, 12, 8); // Череп
      g.fillStyle(0x000000, 1); g.fillCircle(29, 10, 2); g.fillCircle(35, 10, 2); // Глаза
      g.fillStyle(0xe8e8e8, 1); g.fillRect(20, 24, 4, 16); g.fillRect(40, 24, 4, 16); // Руки
    });

    this.makeTexture('ghost_h4', S, S, (g) => {
      // Призрак
      g.fillStyle(0x9b59b6, 0.6); g.fillCircle(32, 24, 16); // Тело
      g.fillStyle(0xffffff, 0.8); g.fillCircle(28, 20, 3); g.fillCircle(36, 20, 3); // Глаза
      g.fillStyle(0x9b59b6, 0.4); // Хвост
      g.fillTriangle(20, 36, 32, 52, 44, 36);
    });

    this.makeTexture('vampire_h4', S, S, (g) => {
      // Вампир
      g.fillStyle(0x1a1a1a, 1); g.fillRect(22, 16, 20, 28); // Плащ
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(32, 12, 8); // Лицо
      g.fillStyle(0xff0000, 1); g.fillRect(28, 16, 8, 4); // Рот
      g.fillStyle(0xffffff, 1); g.fillRect(28, 14, 2, 4); g.fillRect(34, 14, 2, 4); // Клыки
      g.fillStyle(0x1a1a1a, 0.8); // Крылья
      g.fillTriangle(14, 20, 22, 32, 14, 44);
      g.fillTriangle(50, 20, 42, 32, 50, 44);
    });

    this.makeTexture('bone_dragon_h4', S, S, (g) => {
      // Костяной дракон
      g.fillStyle(0xe8e8e8, 1); g.fillRect(16, 24, 32, 16); // Тело
      g.fillStyle(0xffffff, 1); g.fillCircle(48, 20, 10); // Голова
      g.fillStyle(0xff0000, 1); g.fillCircle(50, 18, 3); // Глаз
      g.fillStyle(0xe8e8e8, 0.8); // Крылья
      g.fillTriangle(16, 24, 32, 8, 32, 24);
      g.fillTriangle(32, 24, 48, 8, 48, 24);
      g.fillStyle(0xe8e8e8, 1); g.fillRect(48, 28, 4, 16); // Хвост
    });

    // --- PRESERVE (природа, лес, магия) ---
    this.makeTexture('sprite', S, S, (g) => {
      // Фея
      g.fillStyle(0x9b59b6, 1); g.fillCircle(32, 28, 8); // Тело
      g.fillStyle(0xffffff, 1); g.fillCircle(32, 20, 6); // Голова
      g.fillStyle(0xffffff, 0.6); // Крылья
      g.fillTriangle(20, 24, 28, 32, 20, 40);
      g.fillTriangle(44, 24, 36, 32, 44, 40);
    });

    this.makeTexture('elf_h4', S, S, (g) => {
      // Эльф-стрелок
      g.fillStyle(0x228b22, 1); g.fillRect(24, 24, 16, 20); // Туника
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 16, 8); // Волосы
      g.fillStyle(0x228b22, 1); g.fillTriangle(28, 8, 32, 4, 36, 8); // Уши
      g.fillStyle(0x654321, 1); g.fillRect(44, 20, 4, 20); // Лук
    });

    this.makeTexture('unicorn_h4', S, S, (g) => {
      // Единорог
      g.fillStyle(0xffffff, 1); g.fillRect(16, 28, 32, 16); // Тело
      g.fillStyle(0xffffff, 1); g.fillCircle(48, 24, 8); // Голова
      g.fillStyle(0xffd700, 1); g.fillRect(48, 12, 2, 12); // Рог
      g.fillStyle(0x9b59b6, 1); g.fillRect(12, 20, 8, 16); // Грива
      g.fillStyle(0xffffff, 1); g.fillRect(16, 44, 4, 8); g.fillRect(44, 44, 4, 8); // Ноги
    });

    this.makeTexture('phoenix_h4', S, S, (g) => {
      // Феникс
      g.fillStyle(0xff4500, 1); g.fillCircle(32, 28, 12); // Тело
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 18, 8); // Голова
      g.fillStyle(0xff6600, 0.8); // Крылья
      g.fillTriangle(12, 24, 24, 32, 12, 40);
      g.fillTriangle(52, 24, 40, 32, 52, 40);
      g.fillStyle(0xffd700, 1); // Пламя
      g.fillTriangle(28, 8, 32, 2, 36, 8);
    });

    // --- ASYLUM (хаос, демоны, огонь) ---
    this.makeTexture('bandit', S, S, (g) => {
      // Бандит
      g.fillStyle(0x8b4513, 1); g.fillRect(24, 24, 16, 20); // Шкура
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(32, 16, 8); // Маска
      g.fillStyle(0x000000, 1); g.fillCircle(29, 14, 2); g.fillCircle(35, 14, 2); // Глаза
      g.fillStyle(0x654321, 1); g.fillRect(44, 20, 4, 16); // Кинжал
    });

    this.makeTexture('orc_h4', S, S, (g) => {
      // Орк
      g.fillStyle(0x228b22, 1); g.fillRect(22, 20, 20, 24); // Тело
      g.fillStyle(0x228b22, 1); g.fillCircle(32, 14, 10); // Голова
      g.fillStyle(0xff0000, 1); g.fillCircle(28, 12, 3); g.fillCircle(36, 12, 3); // Глаза
      g.fillStyle(0xffffff, 1); g.fillRect(28, 18, 8, 4); // Клыки
    });

    this.makeTexture('minotaur_h4', S, S, (g) => {
      // Минотавр
      g.fillStyle(0x8b4513, 1); g.fillRect(20, 20, 24, 24); // Тело
      g.fillStyle(0x8b4513, 1); g.fillCircle(32, 12, 10); // Голова
      g.fillStyle(0x654321, 1); g.fillRect(22, 4, 4, 8); g.fillRect(38, 4, 4, 8); // Рога
      g.fillStyle(0xff0000, 1); g.fillCircle(28, 10, 2); g.fillCircle(36, 10, 2); // Глаза
    });

    this.makeTexture('efreet', S, S, (g) => {
      // Ифрит
      g.fillStyle(0xff4500, 1); g.fillCircle(32, 28, 12); // Тело
      g.fillStyle(0xff6600, 1); g.fillCircle(32, 16, 10); // Голова
      g.fillStyle(0xffd700, 1); g.fillCircle(28, 14, 3); g.fillCircle(36, 14, 3); // Глаза
      g.fillStyle(0xff4500, 0.6); // Пламя
      g.fillTriangle(24, 8, 32, 0, 40, 8);
    });

    this.makeTexture('hydra', S, S, (g) => {
      // Гидра
      g.fillStyle(0x228b22, 1); g.fillRect(16, 28, 32, 16); // Тело
      g.fillStyle(0x228b22, 1); // 3 головы
      g.fillCircle(20, 20, 8);
      g.fillCircle(32, 16, 8);
      g.fillCircle(44, 20, 8);
      g.fillStyle(0xff0000, 1); // Глаза
      g.fillCircle(18, 18, 2); g.fillCircle(30, 14, 2); g.fillCircle(42, 18, 2);
    });

    this.makeTexture('black_dragon', S, S, (g) => {
      // Чёрный дракон
      g.fillStyle(0x1a1a1a, 1); g.fillRect(16, 24, 32, 16); // Тело
      g.fillStyle(0x1a1a1a, 1); g.fillCircle(48, 20, 10); // Голова
      g.fillStyle(0xff4500, 1); g.fillCircle(50, 18, 3); // Глаз
      g.fillStyle(0x1a1a1a, 0.8); // Крылья
      g.fillTriangle(16, 24, 32, 8, 32, 24);
      g.fillTriangle(32, 24, 48, 8, 48, 24);
      g.fillStyle(0x1a1a1a, 1); g.fillRect(48, 28, 4, 16); // Хвост
    });

    // --- ACADEMY (магия, големы, знание) ---
    this.makeTexture('dwarf_h4', S, S, (g) => {
      // Гном
      g.fillStyle(0x8b4513, 1); g.fillRect(24, 28, 16, 16); // Тело
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(32, 20, 10); // Шлем
      g.fillStyle(0xffd700, 1); g.fillRect(28, 16, 8, 4); // Узор
      g.fillStyle(0x8b4513, 1); g.fillRect(20, 36, 8, 8); g.fillRect(36, 36, 8, 8); // Руки
    });

    this.makeTexture('mage_h4', S, S, (g) => {
      // Маг
      g.fillStyle(0x4169e1, 1); g.fillRect(24, 24, 16, 20); // Мантия
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 16, 8); // Шляпа
      g.fillStyle(0xffd700, 1); g.fillRect(28, 8, 8, 8); // Конус
      g.fillStyle(0xffffff, 1); g.fillCircle(32, 16, 3); // Звезда
    });

    this.makeTexture('genie_h4', S, S, (g) => {
      // Гений
      g.fillStyle(0x4169e1, 0.8); g.fillCircle(32, 32, 12); // Тело
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 18, 10); // Голова
      g.fillStyle(0xffffff, 1); g.fillCircle(28, 16, 3); g.fillCircle(36, 16, 3); // Глаза
      g.fillStyle(0x4169e1, 0.4); // Дымка
      g.fillCircle(32, 44, 10);
    });

    this.makeTexture('titan_h4', S, S, (g) => {
      // Титан
      g.fillStyle(0xc0c0c0, 1); g.fillRect(20, 16, 24, 28); // Доспех
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 8, 10); // Шлем
      g.fillStyle(0x4169e1, 1); g.fillRect(30, 28, 4, 16); // Молния
      g.fillStyle(0xffd700, 1); g.fillRect(28, 4, 8, 4); // Корона
    });

    // --- STRONGHOLD (варвары, сила, ярость) ---
    this.makeTexture('berserker', S, S, (g) => {
      // Берсерк
      g.fillStyle(0xc0c0c0, 1); g.fillRect(24, 24, 16, 20); // Тело
      g.fillStyle(0xff4500, 1); g.fillCircle(32, 16, 8); // Шлем
      g.fillStyle(0xffffff, 1); g.fillRect(24, 12, 4, 8); g.fillRect(36, 12, 4, 8); // Рога
      g.fillStyle(0x654321, 1); g.fillRect(44, 20, 4, 16); // Топор
    });

    this.makeTexture('centaur', S, S, (g) => {
      // Кентавр
      g.fillStyle(0x8b4513, 1); g.fillRect(16, 28, 32, 16); // Тело коня
      g.fillStyle(0xc0c0c0, 1); g.fillRect(24, 12, 16, 20); // Человек
      g.fillStyle(0x8b4513, 1); g.fillCircle(48, 24, 8); // Голова коня
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(32, 8, 6); // Голова человека
    });

    this.makeTexture('harpy', S, S, (g) => {
      // Гарпия
      g.fillStyle(0x8b0000, 1); g.fillCircle(32, 28, 10); // Тело
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(32, 16, 8); // Голова
      g.fillStyle(0x8b0000, 0.8); // Крылья
      g.fillTriangle(14, 20, 24, 28, 14, 36);
      g.fillTriangle(50, 20, 40, 28, 50, 36);
      g.fillStyle(0xffd700, 1); g.fillRect(28, 44, 8, 8); // Когти
    });

    this.makeTexture('ogre_mage_h4', S, S, (g) => {
      // Огр-маг
      g.fillStyle(0x8b4513, 1); g.fillRect(20, 20, 24, 24); // Тело
      g.fillStyle(0x8b4513, 1); g.fillCircle(32, 12, 10); // Голова
      g.fillStyle(0xff0000, 1); g.fillCircle(28, 10, 3); g.fillCircle(36, 10, 3); // Глаза
      g.fillStyle(0x4169e1, 1); g.fillCircle(32, 44, 6); // Магия
    });

    this.makeTexture('behemoth_h4', S, S, (g) => {
      // Бехемот
      g.fillStyle(0x8b4513, 1); g.fillRect(12, 20, 40, 24); // Огромное тело
      g.fillStyle(0x8b4513, 1); g.fillCircle(48, 16, 12); // Голова
      g.fillStyle(0xff0000, 1); g.fillCircle(44, 14, 3); g.fillCircle(52, 14, 3); // Глаза
      g.fillStyle(0xffffff, 1); g.fillRect(40, 20, 12, 4); // Клыки
      g.fillStyle(0x654321, 1); g.fillRect(12, 28, 4, 12); g.fillRect(48, 28, 4, 12); // Ноги
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

    // Шахта — детализированная
    this.makeTexture('mine', S, S, (g) => {
      // Гора
      g.fillStyle(0x654321, 1); g.fillTriangle(32, 8, 8, 52, 56, 52);
      g.fillStyle(0x8b7355, 1); g.fillTriangle(32, 16, 16, 52, 48, 52);
      // Вход
      g.fillStyle(0x000000, 1); g.fillRect(24, 36, 16, 16);
      g.fillStyle(0x1a1a1a, 1); g.fillRect(28, 40, 8, 12);
      // Золото
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 30, 6);
      g.fillStyle(0xffed4a, 1); g.fillCircle(30, 28, 3);
      // Рельсы
      g.fillStyle(0x654321, 1); g.fillRect(28, 48, 8, 4);
    });

    // Артефакт — сверкающий
    this.makeTexture('artifact', S, S, (g) => {
      // Основа
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 32, 16);
      g.fillStyle(0xffed4a, 1); g.fillCircle(32, 32, 12);
      // Лучи
      g.fillStyle(0xffd700, 0.8);
      g.fillRect(30, 8, 4, 12); g.fillRect(30, 44, 4, 12);
      g.fillRect(8, 30, 12, 4); g.fillRect(44, 30, 12, 4);
      // Диагональные лучи
      g.fillRect(14, 14, 8, 4); g.fillRect(42, 14, 8, 4);
      g.fillRect(14, 46, 8, 4); g.fillRect(42, 46, 8, 4);
      // Центр
      g.fillStyle(0xffffff, 0.9); g.fillCircle(32, 32, 6);
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 32, 3);
    });

    // Ресурс — мешок с золотом
    this.makeTexture('resource', S, S, (g) => {
      // Мешок
      g.fillStyle(0xc2b280, 1); g.fillRect(16, 28, 32, 24);
      g.fillStyle(0x8b7355, 1); g.fillRect(20, 20, 24, 12);
      // Завязка
      g.fillStyle(0x654321, 1); g.fillRect(28, 16, 8, 8);
      // Золото сверху
      g.fillStyle(0xffd700, 1); g.fillCircle(28, 24, 4); g.fillCircle(36, 22, 3);
      // Тень
      g.fillStyle(0x8b7355, 0.4); g.fillRect(20, 50, 24, 4);
    });

    // Портал — сверкающий
    this.makeTexture('portal', S, S, (g) => {
      // Внешнее кольцо
      g.fillStyle(0x9b59b6, 0.9); g.fillCircle(32, 32, 26);
      g.lineStyle(3, 0xbb77ff, 0.8); g.strokeCircle(32, 32, 26);
      // Среднее кольцо
      g.fillStyle(0xe74c3c, 0.6); g.fillCircle(32, 32, 18);
      g.lineStyle(2, 0xff6666, 0.6); g.strokeCircle(32, 32, 18);
      // Внутреннее кольцо
      g.fillStyle(0xffffff, 0.5); g.fillCircle(32, 32, 10);
      // Центр
      g.fillStyle(0xffffff, 0.8); g.fillCircle(32, 32, 4);
      // Сверкание
      g.fillStyle(0xffffff, 0.3); g.fillCircle(28, 28, 3);
    });

    // Школа магии — башня с книгами
    this.makeTexture('school', S, S, (g) => {
      // Башня
      g.fillStyle(0x4a4a8a, 1); g.fillRect(20, 20, 24, 36);
      g.fillStyle(0x6a6aaa, 1); g.fillRect(16, 16, 32, 8);
      // Крыша
      g.fillStyle(0x8b0000, 1); g.fillTriangle(32, 4, 12, 20, 52, 20);
      // Книга
      g.fillStyle(0xffd700, 1); g.fillRect(28, 28, 8, 12);
      g.fillStyle(0xffffff, 1); g.fillRect(30, 30, 4, 8);
      // Свечение
      g.fillStyle(0x6a6aaa, 0.3); g.fillCircle(32, 32, 16);
    });

    // Святилище — алтарь со свечением
    this.makeTexture('shrine', S, S, (g) => {
      // Основание
      g.fillStyle(0x8b7355, 1); g.fillRect(12, 44, 40, 12);
      g.fillStyle(0x654321, 1); g.fillRect(16, 40, 32, 8);
      // Колонна
      g.fillStyle(0x5a4a30, 1); g.fillRect(24, 20, 16, 24);
      g.fillStyle(0x6a5a40, 1); g.fillRect(20, 16, 24, 8);
      // Свечение
      g.fillStyle(0xffffff, 0.9); g.fillCircle(32, 12, 8);
      g.fillStyle(0xffd700, 0.6); g.fillCircle(32, 12, 4);
      // Лучи
      g.fillStyle(0xffffff, 0.3);
      g.fillRect(30, 2, 4, 8); g.fillRect(24, 6, 4, 4); g.fillRect(36, 6, 4, 4);
    });

    // Алтарь — каменный круг
    this.makeTexture('altar', S, S, (g) => {
      // Основание
      g.fillStyle(0x6b6b6b, 1); g.fillCircle(32, 36, 22);
      g.fillStyle(0x8b8b8b, 1); g.fillCircle(32, 36, 18);
      // Камни
      g.fillStyle(0x5a5a5a, 1);
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const x = 32 + Math.cos(angle) * 16;
        const y = 36 + Math.sin(angle) * 16;
        g.fillCircle(x, y, 4);
      }
      // Центр
      g.fillStyle(0xffd700, 1); g.fillCircle(32, 36, 6);
      g.fillStyle(0xffffff, 0.8); g.fillCircle(32, 36, 3);
    });

    // Обелиск — высокая колонна
    this.makeTexture('obelisk', S, S, (g) => {
      // Колонна
      g.fillStyle(0x5a5a5a, 1); g.fillRect(26, 8, 12, 44);
      g.fillStyle(0x6a6a6a, 1); g.fillRect(24, 12, 16, 36);
      // Основание
      g.fillStyle(0x4a4a4a, 1); g.fillRect(20, 48, 24, 8);
      // Вершина
      g.fillStyle(0x7a7a7a, 1); g.fillTriangle(32, 4, 24, 12, 40, 12);
      // Руны
      g.fillStyle(0xffd700, 0.6);
      g.fillRect(30, 20, 4, 4); g.fillRect(30, 28, 4, 4); g.fillRect(30, 36, 4, 4);
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

    // === 📜 МАГИЧЕСКИЙ СВИТОК (канон HoMM4) ===
    this.makeTexture('magic_scroll', S, S, (g) => {
      // Свечение (фиолетовый ореол)
      g.fillStyle(0x9966ff, 0.3);
      g.fillCircle(32, 32, 26);
      
      // Сам свиток (пергамент)
      g.fillStyle(0xf5deb3, 1); // Светло-бежевый
      g.fillRoundedRect(18, 20, 28, 32, 4);
      
      // Завитки сверху и снизу
      g.fillStyle(0xd2b48c, 1); // Темнее пергамент
      g.fillCircle(32, 18, 8); // Верхний завиток
      g.fillCircle(32, 52, 8); // Нижний завиток
      
      // Печать (красная)
      g.fillStyle(0x8b0000, 1);
      g.fillCircle(32, 36, 5);
      
      // Линии текста
      g.fillStyle(0x4a3a2a, 0.6);
      g.fillRect(22, 26, 20, 1);
      g.fillRect(22, 30, 20, 1);
      g.fillRect(22, 40, 20, 1);
      g.fillRect(22, 44, 20, 1);
      
      // Магическая искра
      g.fillStyle(0xffff00, 0.8);
      g.fillCircle(40, 22, 2);
      g.fillCircle(24, 48, 2);
    });

    // === ТАЙЛЫ БОЯ И ОСАДЫ ===
    const BTS = CONFIG.BATTLE_TILE_SIZE;

    // Стена (для осады)
    this.makeTexture('wall', BTS, BTS, (g) => {
      g.fillStyle(0x6b6b6b, 1); g.fillRect(0, 0, BTS, BTS);
      g.fillStyle(0x5a5a5a, 1); g.fillRect(4, 4, BTS - 8, BTS - 8);
      g.fillStyle(0x4a4a4a, 0.8);
      g.fillRect(8, 8, 16, 16); g.fillRect(BTS - 24, BTS - 24, 16, 16);
      g.lineStyle(1, 0x3a3a3a, 0.5); g.strokeRect(0, 0, BTS, BTS);
    });

    // Башня (для осады)
    this.makeTexture('tower', BTS, BTS, (g) => {
      g.fillStyle(0x6b6b6b, 1); g.fillRect(8, 4, BTS - 16, BTS - 8);
      g.fillStyle(0x8b8b8b, 1); g.fillRect(4, 0, BTS - 8, 8);
      g.fillStyle(0x5a5a5a, 1); g.fillRect(12, BTS - 12, BTS - 24, 12);
      g.fillStyle(0xff4500, 0.5); g.fillCircle(BTS / 2, BTS / 2, 6);
    });

    // Ворота
    this.makeTexture('gate', BTS, BTS, (g) => {
      g.fillStyle(0x6b6b6b, 1); g.fillRect(0, 0, BTS, BTS);
      g.fillStyle(0x4a3a2a, 1); g.fillRect(8, 8, BTS - 16, BTS - 16);
      g.fillStyle(0x3a2a1a, 1); g.fillRect(12, 12, BTS - 24, BTS - 24);
      g.fillStyle(0xffd700, 0.6); g.fillCircle(BTS / 2, BTS / 2, 4);
    });

    // Баллиста (осадная машина)
    this.makeTexture('ballista_machine', BTS, BTS, (g) => {
      g.fillStyle(0x8b4513, 1); g.fillRect(8, BTS - 16, BTS - 16, 12);
      g.fillStyle(0x654321, 1); g.fillRect(BTS / 2 - 4, 4, 8, BTS - 20);
      g.fillStyle(0xc0c0c0, 1); g.fillRect(BTS / 2 - 6, 2, 12, 6);
    });

    // Катапульта
    this.makeTexture('catapult_machine', BTS, BTS, (g) => {
      g.fillStyle(0x8b4513, 1); g.fillRect(8, BTS - 16, BTS - 16, 12);
      g.fillStyle(0x654321, 1); g.fillRect(BTS / 2 - 2, 8, 4, BTS - 24);
      g.fillStyle(0xc0c0c0, 1); g.fillCircle(BTS / 2, 6, 6);
    });

    // Палатка первой помощи
    this.makeTexture('first_aid_tent_machine', BTS, BTS, (g) => {
      g.fillStyle(0xffffff, 0.9); g.fillTriangle(BTS / 2, 4, 4, BTS - 8, BTS - 4, BTS - 8);
      g.fillStyle(0xff0000, 1); g.fillRect(BTS / 2 - 4, BTS / 2 - 4, 8, 8);
    });

    // === UI текстуры ===

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

    // === UI текстуры (улучшенные) ===
    
    // Подсветка выбора (зелёная)
    this.makeTexture('highlight', BTS, BTS, (g) => {
      g.fillStyle(0x2ecc71, 0.3); g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(3, 0x2ecc71, 0.9); g.strokeRect(2, 2, BTS - 4, BTS - 4);
      // Угловые маркеры
      g.fillStyle(0x2ecc71, 0.8);
      g.fillRect(0, 0, 8, 4); g.fillRect(0, 0, 4, 8);
      g.fillRect(BTS - 8, 0, 8, 4); g.fillRect(BTS - 4, 0, 4, 8);
      g.fillRect(0, BTS - 4, 8, 4); g.fillRect(0, BTS - 8, 4, 8);
      g.fillRect(BTS - 8, BTS - 4, 8, 4); g.fillRect(BTS - 4, BTS - 8, 4, 8);
    });

    // Цель атаки (красная)
    this.makeTexture('target', BTS, BTS, (g) => {
      g.fillStyle(0xe74c3c, 0.3); g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(3, 0xe74c3c, 0.9); g.strokeRect(2, 2, BTS - 4, BTS - 4);
      // Крест
      g.fillStyle(0xe74c3c, 0.8);
      g.fillRect(BTS / 2 - 2, 4, 4, BTS - 8);
      g.fillRect(4, BTS / 2 - 2, BTS - 8, 4);
    });

    // Зона размещения (тактика)
    this.makeTexture('deploy_zone', BTS, BTS, (g) => {
      g.fillStyle(0x4488ff, 0.2); g.fillRect(0, 0, BTS, BTS);
      g.lineStyle(2, 0x4488ff, 0.6); g.strokeRect(1, 1, BTS - 2, BTS - 2);
    });

    // Белый пиксель
    this.makeTexture('pixel', 4, 4, (g) => {
      g.fillStyle(0xffffff, 1); g.fillRect(0, 0, 4, 4);
    });

    // Частица для эффектов магии
    this.makeTexture('particle', 8, 8, (g) => {
      g.fillStyle(0xffffff, 1); g.fillCircle(4, 4, 4);
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
