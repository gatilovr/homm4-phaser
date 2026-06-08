import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Tile, TileType, Position, Hero, SkillCategory, Resources, MapLevel, MapObject } from '../types';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { Pathfinder } from '../utils/Pathfinder';
import { EventBus } from '../utils/EventBus';
import { VictorySystem, OwnerType } from '../systems/VictorySystem';
import { AISystem, AIPlayer } from '../systems/AISystem';
import { EconomySystem, MINE_TYPES, getRandomMineType, calculateWeeklyGrowth, calculateTownDailyIncome } from '../systems/EconomySystem';
import { CaravanSystem } from '../systems/CaravanSystem';
import { MapObjectGenerator } from '../systems/MapObjectGenerator';
import { HeroManager } from '../systems/HeroManager';
import { SaveSystem } from '../systems/SaveSystem';
import { SaveLoadUI } from '../ui/SaveLoadUI';
import { UndergroundGenerator } from '../systems/UndergroundGenerator';
import {
  canBoardShip,
  canDisembark,
  canMoveOnWater,
  boardShip,
  disembark,
  createShipObject,
  SHIP_COSTS,
  getWaterMovementSpeed,
  sinkShip,
} from '../systems/NavalSystem';
import type { ShipType } from '../systems/NavalSystem';
import type { MineType } from '../systems/EconomySystem';

export class WorldScene extends Phaser.Scene {
  public map: Tile[][] = [];
  
  // === ДВУХУРОВНЕВАЯ КАРТА (канон HoMM4) ===
  /** Карта поверхности (surface level) */
  private surfaceMap: Tile[][] = [];
  /** Карта подземелья (underground level) */
  private undergroundMap: Tile[][] = [];
  /** Текущий активный уровень карты */
  private currentLevel: MapLevel = 'surface';
  /** Позиции subterranean gates на поверхности (id + координаты) */
  private surfaceGatePositions: Array<{ x: number; y: number; id: string }> = [];
  /** Позиции subterranean gates в подземелье (парные к surface) */
  private undergroundGatePositions: Array<{ x: number; y: number; id: string }> = [];
  /** UI индикатор текущего уровня */
  private levelIndicator!: Phaser.GameObjects.Text;
  /** Объекты подземелья (для размещения при переключении уровня) */
  private undergroundObjects: any[] = [];
  
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];
  private objectSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private heroSprite!: Phaser.GameObjects.Sprite;
  /** Спрайт корабля (отображается под героем когда onShipId != null) */
  private shipSprite?: Phaser.GameObjects.Sprite;
  private hero!: Hero;
  private currentPath: Position[] = [];
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private pathfinder!: Pathfinder;
  public camera!: Phaser.Cameras.Scene2D.Camera;
  private resourceDisplay: Phaser.GameObjects.Text[] = [];
  private isMoving: boolean = false;

  // === МОРСКАЯ СИСТЕМА (канон HoMM4) ===
  /** Пары водоворотов (whirlpool) для телепортации по воде */
  private whirlpoolPairs: Array<{ id1: string; id2: string; x1: number; y1: number; x2: number; y2: number }> = [];
  /** ID последнего использованного водоворота (чтобы не телепортировать обратно сразу) */
  private lastWhirlpoolId?: string;
  
  private resources = { ...CONFIG.STARTING_RESOURCES };
  private day: number = 1;
  private week: number = 1;
  private dayText!: Phaser.GameObjects.Text;
  private victorySystem!: VictorySystem;
  private aiSystem!: AISystem;
  private aiHeroSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private aiHeroNameTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  
  // === СИСТЕМА НЕСКОЛЬКИХ ГЕРОЕВ ===
  private playerHeroes: Hero[] = [];
  private playerHeroSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private currentHeroIndex: number = 0;
  
  // === ЭКОНОМИКА ===
  private caravanSystem: CaravanSystem = new CaravanSystem();
  /** Тип каждой шахты по ID */
  private mineTypes: Map<string, MineType> = new Map();
  /** Счётчик для генерации уникальных seed для шахт */
  private mineSeed: number = 12345;
  /** Менеджер героев (навыки и специализации) */
  private heroManager!: HeroManager;
  /** Система сохранения игры */
  private saveSystem!: SaveSystem;
  /** Флаг: игра загружена из сохранения */
  private loadedFromSave: boolean = false;

  constructor() {
    super({ key: CONFIG.SCENES.WORLD });
  }

  create(): void {
    console.log('[WorldScene] === CREATE STARTED ===');
    
    // === ПРОВЕРКА: ЗАГРУЗКА ИЗ СОХРАНЕНИЯ ===
    const initData = this.scene.settings.data as any;
    if (initData?.loadSave && initData?.saveData) {
      console.log('[WorldScene] 🔄 Загрузка из сохранения...');
      this.loadedFromSave = true;
    }
    
    // Инициализация SaveSystem
    this.saveSystem = SaveSystem.getInstance();
    
    // Сразу рисуем отладочный текст чтобы видеть что сцена запустилась
    const debugText = this.add.text(10, 10, '🗺️ WorldScene загружена!', {
      fontSize: '20px',
      color: '#00ff00',
      fontFamily: 'Segoe UI',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(999);

    try {
      // === ИНИЦИАЛИЗАЦИЯ HERO MANAGER ===
      this.heroManager = HeroManager.getInstance(CONFIG.MAP_SEED);
      const skillsData = this.registry.get('skills');
      if (skillsData) {
        this.heroManager.loadSkillsData(skillsData);
        console.log('[WorldScene] ✓ HeroManager initialized with skills');
      }

      // Генерация карты (уменьшенная 40×40)
      this.generateMap();
      console.log(`[WorldScene] ✓ Map generated (${CONFIG.MAP_WIDTH}×${CONFIG.MAP_HEIGHT})`);

      // Визуал карты
      this.createMapVisuals();
      console.log('[WorldScene] ✓ Map visuals created');

      // Герой
      this.createHero();
      console.log('[WorldScene] ✓ Hero created at', this.getHeroPosition());

      // Объекты
      this.placeObjects();
      console.log('[WorldScene] ✓ Objects placed:', this.objectSprites.size);

      // Камера
      this.setupCamera();
      console.log('[WorldScene] ✓ Camera setup');

      // Ввод
      this.setupInput();
      console.log('[WorldScene] ✓ Input setup');

      // UI
      this.createUI();
      console.log('[WorldScene] ✓ UI created');

      // Система победы
      this.victorySystem = new VictorySystem(
        { type: 'capture_all_towns' },
        { type: 'lose_all_heroes_and_towns' }
      );
      this.registerGameObjects();
      console.log('[WorldScene] ✓ Victory system initialized');

      // Система ИИ
      this.initAISystem();
      console.log('[WorldScene] ✓ AI system initialized');

      // Pathfinder с учётом состояния героя (корабль/Water Walk)
      this.rebuildPathfinder();
      this.pathGraphics = this.add.graphics();

      // Запуск UIScene (мини-карта и управление)
      this.scene.launch(CONFIG.SCENES.UI, { worldScene: this });

      // === ВОССТАНОВЛЕНИЕ ИЗ СОХРАНЕНИЯ ===
      if (this.loadedFromSave && initData?.saveData) {
        this.saveSystem.restoreGameState(this, initData.saveData);
        this.updateUI();
        console.log('[WorldScene] ✓ Состояние восстановлено из сохранения');
        this.showSaveNotification('✅ Игра загружена');
      } else {
        // Автосохранение новой игры
        this.time.delayedCall(1000, () => this.autoSave());
      }

      // === ГОРЯЧИЕ КЛАВИШИ СОХРАНЕНИЯ ===
      this.setupSaveHotkeys();

      console.log('[WorldScene] === CREATE COMPLETE ===');
      
      // Убираем debug текст через 3 секунды
      this.time.delayedCall(3000, () => {
        debugText.destroy();
      });

    } catch (error) {
      console.error('[WorldScene] !!! ERROR IN CREATE:', error);
      debugText.setText('❌ ОШИБКА: ' + String(error)).setColor('#ff0000');
    }
  }

  private generateMap(): void {
    const MAP_W = CONFIG.MAP_WIDTH;
    const MAP_H = CONFIG.MAP_HEIGHT;
    const noise = new NoiseGenerator(CONFIG.MAP_SEED);
    console.log(`[WorldScene] Generating dual-level map ${MAP_W}×${MAP_H} (seed: ${CONFIG.MAP_SEED})`);
    
    // === ШАГ 1: Генерация поверхности (surface) ===
    for (let y = 0; y < MAP_H; y++) {
      this.surfaceMap[y] = [];
      for (let x = 0; x < MAP_W; x++) {
        const value = noise.normalizedNoise(x * 0.1, y * 0.1);
        const type = this.getTileType(value);
        
        this.surfaceMap[y][x] = {
          x,
          y,
          type,
          passable: this.isPassableType(type),
          moveCost: this.getMoveCost(type),
          revealed: false,
          visible: false,
          visited: false,
          flyable: true,
          level: 'surface'
        };
      }
    }
    
    // Раскрываем область вокруг центра (стартовая позиция игрока)
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    this.revealAroundSurface(cx, cy, 5);
    
    // === ШАГ 2: Выбор позиций subterranean gates на поверхности ===
    // Размещаем 3 парных портала в разных углах карты (канон HoMM4)
    this.surfaceGatePositions = this.pickGatePositions(this.surfaceMap, 3, cx, cy);
    console.log(`[WorldScene] 🌋 ${this.surfaceGatePositions.length} subterranean gates на поверхности`);
    
    // === ШАГ 3: Генерация подземелья через UndergroundGenerator ===
    const undergroundGen = new UndergroundGenerator(CONFIG.MAP_SEED);
    const undergroundResult = undergroundGen.generate({
      width: MAP_W,
      height: MAP_H,
      seed: CONFIG.MAP_SEED,
      gateCount: this.surfaceGatePositions.length,
      surfaceGatePositions: this.surfaceGatePositions
    });
    
    this.undergroundMap = undergroundResult.map;
    this.undergroundGatePositions = undergroundResult.gatePositions;
    
    console.log(`[WorldScene] ✓ Underground generated (${undergroundResult.objects.length} objects)`);
    
    // === ШАГ 4: Размещение subterranean gates на поверхности ===
    for (let i = 0; i < this.surfaceGatePositions.length; i++) {
      const pos = this.surfaceGatePositions[i];
      const underPos = this.undergroundGatePositions[i];
      const gateId = `gate_surface_${i}`;
      const pairedId = `gate_underground_${i}`;
      
      // На поверхности
      this.surfaceMap[pos.y][pos.x].object = {
        id: gateId,
        type: 'subterranean_gate',
        x: pos.x,
        y: pos.y,
        level: 'surface',
        pairedGateId: pairedId,
        data: {
          targetLevel: 'underground',
          targetX: underPos.x,
          targetY: underPos.y,
          targetGateId: pairedId
        }
      };
      
      // В подземелье
      this.undergroundMap[underPos.y][underPos.x].object = {
        id: pairedId,
        type: 'subterranean_gate',
        x: underPos.x,
        y: underPos.y,
        level: 'underground',
        pairedGateId: gateId,
        data: {
          targetLevel: 'surface',
          targetX: pos.x,
          targetY: pos.y,
          targetGateId: gateId
        }
      };
    }
    
    // === ШАГ 5: Устанавливаем активную карту (по умолчанию — поверхность) ===
    this.map = this.surfaceMap;
    this.currentLevel = 'surface';
    
    // Сохраняем underground objects для последующего размещения
    this.undergroundObjects = undergroundResult.objects;
  }

  /**
   * Вспомогательный метод для раскрытия области на surface (до инициализации this.map)
   */
  private revealAroundSurface(cx: number, cy: number, radius: number): void {
    const MAP_W = this.surfaceMap[0].length;
    const MAP_H = this.surfaceMap.length;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < MAP_W && y >= 0 && y < MAP_H) {
          if (Math.abs(dx) + Math.abs(dy) <= radius + 1) {
            this.surfaceMap[y][x].revealed = true;
          }
        }
      }
    }
  }

  /**
   * Выбрать N позиций для subterranean gates на карте
   * Распределяем по разным частям карты для интересного геймплея
   */
  private pickGatePositions(
    map: Tile[][],
    count: number,
    playerStartX: number,
    playerStartY: number
  ): Array<{ x: number; y: number; id: string }> {
    const MAP_W = map[0].length;
    const MAP_H = map.length;
    const positions: Array<{ x: number; y: number; id: string }> = [];
    
    // Заранее определённые регионы для разнообразия
    const regions = [
      { minX: 5, minY: 5, maxX: 15, maxY: 15 },            // Верхний-левый
      { minX: MAP_W - 15, minY: 5, maxX: MAP_W - 5, maxY: 15 }, // Верхний-правый
      { minX: 5, minY: MAP_H - 15, maxX: 15, maxY: MAP_H - 5 }, // Нижний-левый
      { minX: MAP_W - 15, minY: MAP_H - 15, maxX: MAP_W - 5, maxY: MAP_H - 5 }, // Нижний-правый
      { minX: Math.floor(MAP_W/2) - 5, minY: 5, maxX: Math.floor(MAP_W/2) + 5, maxY: 15 }, // Верх-центр
    ];
    
    for (let i = 0; i < count && i < regions.length; i++) {
      const region = regions[i];
      let attempts = 0;
      let placed = false;
      
      while (attempts < 50 && !placed) {
        attempts++;
        const x = Phaser.Math.Between(region.minX, region.maxX);
        const y = Phaser.Math.Between(region.minY, region.maxY);
        
        // Проверки:
        // 1. Клетка проходима
        if (!map[y]?.[x]?.passable) continue;
        // 2. Нет объекта на клетке
        if (map[y][x].object) continue;
        // 3. Далеко от стартовой позиции игрока (>10 клеток)
        const dist = Math.abs(x - playerStartX) + Math.abs(y - playerStartY);
        if (dist < 10) continue;
        // 4. Далеко от других порталов (>8 клеток)
        let tooClose = false;
        for (const p of positions) {
          if (Math.abs(p.x - x) + Math.abs(p.y - y) < 8) {
            tooClose = true;
            break;
          }
        }
        if (tooClose) continue;
        
        positions.push({ x, y, id: `gate_${i}` });
        placed = true;
      }
    }
    
    return positions;
  }

  private getTileType(value: number): TileType {
    if (value < 0.25) return 'water';
    if (value < 0.3) return 'sand';
    if (value < 0.55) return 'grass';
    if (value < 0.65) return 'forest';
    if (value < 0.75) return 'swamp';
    if (value < 0.85) return 'rock';
    return 'snow';
  }

  private isPassableType(type: TileType): boolean {
    return !['water', 'rock', 'lava', 'cave_rock'].includes(type);
  }

  /**
   * Проверка проходимости тайла С УЧЁТОМ СОСТОЯНИЯ ГЕРОЯ
   * - На суше: всё кроме воды, скал, лавы
   * - На корабле: только вода (+ подземные реки)
   * - Water Walk: вода как суша
   */
  private isTilePassableForHero(type: TileType): boolean {
    // Если герой на корабле — может ходить только по воде
    if (this.hero?.onShipId) {
      return type === 'water' || type === 'subterranean_river' || type === 'underground_lake';
    }
    // Если есть Water Walk — вода проходима
    if (this.hero?.waterWalk && type === 'water') {
      return true;
    }
    // Стандартная проверка
    return !['water', 'rock', 'lava', 'cave_rock'].includes(type);
  }

  private getMoveCost(type: TileType): number {
    const costs: Record<TileType, number> = {
      grass: 1, sand: 1.5, water: 999, rock: 999,
      snow: 1.5, swamp: 2, lava: 999, forest: 1.5,
      // Подземные тайлы
      cave_floor: 1,
      cave_rock: 999,
      underground_lake: 2,
      mushroom_grove: 1.2,
      subterranean_river: 2
    };
    return costs[type] || 1;
  }

  /**
   * Стоимость движения с учётом состояния героя
   */
  private getMoveCostForHero(type: TileType): number {
    // На корабле: вода = 1, остальное невозможно
    if (this.hero?.onShipId) {
      if (type === 'water' || type === 'subterranean_river' || type === 'underground_lake') {
        return 1; // Базовая стоимость по воде
      }
      return 999; // Не может сходить с корабля на непроходимую клетку
    }
    // Water Walk: вода как обычная местность
    if (this.hero?.waterWalk && type === 'water') {
      return 2; // Замедление при ходьбе по воде
    }
    return this.getMoveCost(type);
  }

  private createMapVisuals(): void {
    const TS = CONFIG.TILE_SIZE;
    const mapW = this.map[0].length;
    const mapH = this.map.length;

    for (let y = 0; y < mapH; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < mapW; x++) {
        const tile = this.map[y][x];
        const textureKey = `tile_${tile.type}`;
        
        // Проверяем что текстура существует
        if (!this.textures.exists(textureKey)) {
          console.warn(`[WorldScene] Texture '${textureKey}' not found!`);
        }
        
        const sprite = this.add.sprite(x * TS, y * TS, textureKey).setOrigin(0, 0);
        this.tileSprites[y][x] = sprite;
        
        // Туман войны
        if (!tile.revealed) {
          sprite.setTint(0x111111);
          sprite.setAlpha(0.3);
        }
      }
    }
  }

  private createHero(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const TS = CONFIG.TILE_SIZE;

    let startX = Math.floor(mapW / 2);
    let startY = Math.floor(mapH / 2);

    // Ищем проходимую клетку
    if (!this.map[startY]?.[startX]?.passable) {
      let found = false;
      for (let r = 1; r < 15 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const nx = startX + dx;
            const ny = startY + dy;
            if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
              if (this.map[ny][nx].passable) {
                startX = nx;
                startY = ny;
                found = true;
              }
            }
          }
        }
      }
    }

    // === СОЗДАЁМ ГЕРОЯ ЧЕРЕЗ HERO MANAGER ===
    // Это даёт стартовые навыки, специализацию, правильные статы
    this.hero = this.heroManager.createHero({
      id: 'hero_1',
      name: 'Сэр Гэвин',
      heroClass: 'knight',
      faction: 'haven'
    });

    // Стартовая армия
    this.hero.army = [
      { creatureId: 'pikeman', count: 20 },
      { creatureId: 'archer', count: 10 }
    ];

    // Позиция
    (this.hero as any).x = startX;
    (this.hero as any).y = startY;

    // Начальные заклинания (knight не маг, но можно дать базовое)
    this.hero.spells = ['bless'];

    // Максимальные очки движения (с учётом Логистики)
    (this.hero as any).movementPoints = this.heroManager.getMaxMovementPoints(this.hero);
    (this.hero as any).maxMovementPoints = this.heroManager.getMaxMovementPoints(this.hero);

    this.heroSprite = this.add.sprite(
      startX * TS,
      startY * TS,
      'hero'
    ).setOrigin(0, 0).setDepth(100);

    this.playerHeroes = [this.hero];
    this.playerHeroSprites.set(this.hero.id, this.heroSprite);
    this.currentHeroIndex = 0;

    console.log(`[WorldScene] Hero created with skills:`, this.hero.skills.map(s => s.name));
    console.log(`[WorldScene] Hero specialization:`, this.hero.class);
  }

  private placeObjects(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const cx = Math.floor(mapW / 2);
    const cy = Math.floor(mapH / 2);
    
    // === ИСПОЛЬЗУЕМ ПРОЦЕДУРНЫЙ ГЕНЕРАТОР ===
    const generator = new MapObjectGenerator({
      mapWidth: mapW,
      mapHeight: mapH,
      playerStartX: cx,
      playerStartY: cy,
      enemyTownPositions: [
        { x: 5, y: 5 },
        { x: mapW - 5, y: mapH - 5 },
        { x: 5, y: mapH - 5 }
      ],
      seed: CONFIG.MAP_SEED
    });
    
    const objects = generator.getObjects();
    
    // Размещаем все объекты на карте
    for (const obj of objects) {
      // Сохраняем типы шахт
      if (obj.type === 'mine') {
        const mineType = (obj.data?.type || 'gold') as MineType;
        this.mineTypes.set(obj.id, mineType);
      }
      
      this.placeObjectSafe(obj.id, obj.type, obj.x, obj.y, obj.data);
    }
    
    // === МОРСКИЕ ОБЪЕКТЫ (канон HoMM4) ===
    this.generateShips();
    this.generateWhirlpools();
    
    console.log(`[WorldScene] Размещено ${objects.length} объектов на карте (+ морские)`);
  }

  private placeObjectSafe(id: string, type: string, x: number, y: number, data?: any): void {
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;
    if (x < 0 || x >= mapW || y < 0 || y >= mapH) return;
    if (!this.map[y]?.[x]?.passable) return;
    if (this.map[y][x].object) return;
    
    const TS = CONFIG.TILE_SIZE;
    const sprite = this.add.sprite(x * TS, y * TS, type)
      .setOrigin(0, 0)
      .setDepth(50)
      .setInteractive({ useHandCursor: true });
    
    this.objectSprites.set(id, sprite);
    this.map[y][x].object = { id, type: type as any, x, y, data, level: 'surface' };
    
    sprite.on('pointerover', () => sprite.setTint(0xffff00));
    sprite.on('pointerout', () => sprite.clearTint());
    sprite.on('pointerdown', () => this.handleObjectClick(id, type, x, y));
  }

  private handleObjectClick(id: string, type: string, x: number, y: number): void {
    console.log(`[WorldScene] Clicked: ${type} at ${x},${y}`);
    this.showNotification(`${type} (${x}, ${y})`);
  }

  private setupCamera(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const TS = CONFIG.TILE_SIZE;

    this.camera = this.cameras.main;
    this.camera.setBounds(0, 0, mapW * TS, mapH * TS);
    this.camera.startFollow(this.heroSprite, true, 0.08, 0.08);
    this.camera.setZoom(1);
    
    // Зум колесом мыши
    this.input.on('wheel', (_pointer: any, _gos: any, _dx: number, _dy: number, dz: number) => {
      const zoom = this.camera.zoom - dz * 0.001;
      this.camera.setZoom(Phaser.Math.Clamp(zoom, 0.5, 2.5));
    });
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        // ПКМ — инфо о тайле
        const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
        const tileX = Math.floor(worldPoint.x / CONFIG.TILE_SIZE);
        const tileY = Math.floor(worldPoint.y / CONFIG.TILE_SIZE);
        this.showTileInfo(tileX, tileY);
        return;
      }
      
      if (this.isMoving) return;
      
      const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPoint.x / CONFIG.TILE_SIZE);
      const tileY = Math.floor(worldPoint.y / CONFIG.TILE_SIZE);
      
      const mapW = this.map[0]?.length || 0;
      const mapH = this.map.length;
      if (tileX < 0 || tileX >= mapW || tileY < 0 || tileY >= mapH) return;

      const tile = this.map[tileY][tileX];

      // === ОСОБАЯ ЛОГИКА: посадка/высадка с корабля ===
      if (this.hero?.onShipId) {
        // Герой на корабле — клик по суше = попытка высадки
        if (tile.type !== 'water' && tile.type !== 'subterranean_river' && tile.type !== 'underground_lake') {
          if (this.tryDisembark(tileX, tileY)) {
            return;
          }
        }
      } else {
        // Герой на суше — клик на корабль рядом = посадка
        if (tile.object?.type === 'boat') {
          if (this.tryBoardShip(tile.object)) {
            return;
          }
        }
      }

      this.moveHeroTo({ x: tileX, y: tileY });
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.endTurn());
    this.input.keyboard?.on('keydown-H', () => this.showHeroInfo());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(CONFIG.SCENES.MENU));
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.switchToNextHero();
    });
    // === U — переключение между поверхностью и подземельем (канон HoMM4) ===
    this.input.keyboard?.on('keydown-U', () => {
      this.switchLevel();
    });
  }

  private moveHeroTo(target: Position): void {
    const heroPos = this.getHeroPosition();
    if (heroPos.x === target.x && heroPos.y === target.y) return;
    
    const path = this.pathfinder.findPath(heroPos, target);
    
    if (path.length > 1) {
      this.currentPath = path.slice(1);
      this.drawPath();
      this.followPath();
    }
  }

  public getHeroPosition(): Position {
    return {
      x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE),
      y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE)
    };
  }

  private drawPath(): void {
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(3, 0x2ecc71, 0.6);
    
    const heroPos = this.getHeroPosition();
    const TS = CONFIG.TILE_SIZE;
    let prevX = heroPos.x * TS + TS / 2;
    let prevY = heroPos.y * TS + TS / 2;
    
    for (const point of this.currentPath) {
      const x = point.x * TS + TS / 2;
      const y = point.y * TS + TS / 2;
      this.pathGraphics.lineBetween(prevX, prevY, x, y);
      prevX = x;
      prevY = y;
    }
  }

  private followPath(): void {
    if (this.currentPath.length === 0) {
      this.pathGraphics.clear();
      this.isMoving = false;
      return;
    }

    this.isMoving = true;
    const nextPos = this.currentPath.shift()!;
    const TS = CONFIG.TILE_SIZE;

    this.tweens.add({
      targets: this.heroSprite,
      x: nextPos.x * TS,
      y: nextPos.y * TS,
      duration: CONFIG.ANIM_DURATION.MOVEMENT,
      ease: 'Linear',
      onComplete: () => {
        this.onHeroMoved(nextPos);
        this.drawPath();
        this.followPath();
      }
    });
  }

  private onHeroMoved(pos: Position): void {
    // Используем радиус обзора с учётом навыка Разведка
    const visionRadius = this.heroManager?.getVisionRadius(this.hero) || 4;
    this.revealAround(pos, visionRadius);
    this.checkObjectCollision(pos);
    EventBus.emit('hero:moved', { heroId: this.hero.id, to: pos });
  }

  private revealAround(center: Position, radius: number): void {
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = center.x + dx;
        const y = center.y + dy;
        
        if (x >= 0 && x < mapW && y >= 0 && y < mapH) {
          if (Math.abs(dx) + Math.abs(dy) <= radius + 1) {
            this.map[y][x].revealed = true;
            const sprite = this.tileSprites[y]?.[x];
            if (sprite) {
              sprite.clearTint();
              sprite.setAlpha(1);
            }
          }
        }
      }
    }
  }

  private checkObjectCollision(pos: Position): void {
    const tile = this.map[pos.y]?.[pos.x];
    if (!tile?.object) return;

    const obj = tile.object;
    
    switch (obj.type) {
      case 'town':
      case 'enemy_town':
        this.enterTown(obj.id);
        break;
      case 'creature':
        this.startBattle(obj.id);
        break;
      case 'artifact':
        this.collectArtifact(obj.id, pos);
        break;
      case 'resource':
        this.collectResource(obj.id, pos);
        break;
      case 'mine':
        this.captureMine(obj.id);
        break;
      case 'portal':
        this.usePortal(obj.id);
        break;
      case 'school':
        this.visitSchool(obj.id, obj.data);
        break;
      case 'shrine':
        this.visitShrine(obj.id, obj.data);
        break;
      case 'altar':
        this.visitAltar(obj.id, obj.data);
        break;
      case 'obelisk':
        this.visitObelisk(obj.id, obj.data);
        break;
      case 'tavern':
        this.visitTavern(obj.id, obj.data);
        break;
      case 'witch_hut':
        this.visitWitchHut(obj.id, obj.data);
        break;
      case 'treasure_chest':
        this.openTreasureChest(obj.id, obj.data);
        break;
      case 'refugee_camp':
        this.visitRefugeeCamp(obj.id, obj.data);
        break;
      case 'garrison':
        this.visitGarrison(obj.id, obj.data);
        break;
      case 'library':
        this.visitLibrary(obj.id, obj.data);
        break;
      case 'magic_well':
        this.visitMagicWell(obj.id, obj.data);
        break;
      case 'oasis':
        this.visitOasis(obj.id, obj.data);
        break;
      case 'windmill':
        this.claimWindmill(obj.id, obj.data);
        break;
      case 'water_wheel':
        this.claimWaterWheel(obj.id, obj.data);
        break;
      // === ПОДЗЕМНЫЙ ПОРТАЛ (канон HoMM4) ===
      case 'subterranean_gate':
        this.useSubterraneanGate(obj.id, obj.data);
        break;
      // === МОРСКИЕ ОБЪЕКТЫ (канон HoMM4) ===
      case 'boat':
        this.tryBoardShip(obj);
        break;
      case 'whirlpool':
        this.useWhirlpool(obj.id, obj.data);
        break;
      case 'shipwreck':
        this.visitShipwreck(obj.id, obj.data);
        break;
      case 'sea_chest':
        this.collectSeaChest(obj.id, obj.data);
        break;
      case 'flotsam':
        this.collectFlotsam(obj.id, obj.data);
        break;
      case 'bottle':
        this.readBottle(obj.id, obj.data);
        break;
    }
  }

  private enterTown(townId: string): void {
    console.log('[WorldScene] Entering town:', townId);
    this.stopMovement();
    
    // Получаем данные о городе
    const townData = this.victorySystem?.getTown(townId);
    const ownership = townData?.owner;
    
    // === ОСАДНЫЙ БОЙ: если город вражеский ===
    if (ownership === 'ai') {
      console.log('[WorldScene] ⚔️ Вражеский город — ОСАДА!');
      this.showNotification('🏰⚔️ Осада города!');
      
      this.time.delayedCall(300, () => {
        this.scene.sleep();
        this.scene.launch(CONFIG.SCENES.BATTLE, {
          attacker: this.hero,
          defenderId: townId,
          defenderTown: townData,
          worldScene: this,
          battleType: 'siege'
        });
      });
      return;
    }
    
    // Свой город — открываем UI управления
    this.showNotification('🏰 Вход в город...');
    this.time.delayedCall(300, () => {
      this.scene.sleep();
      this.scene.launch(CONFIG.SCENES.TOWN, { 
        townId, 
        worldScene: this,
        townData
      });
    });
  }

  private startBattle(creatureId: string): void {
    console.log('[WorldScene] Starting battle:', creatureId);
    this.stopMovement(); // Останавливаем движение

    // === ПРОВЕРКА ДИПЛОМАТИИ (Diplomacy skill) ===
    if (this.heroManager) {
      const diplomacyResult = this.heroManager.tryDiplomacy(this.hero);
      if (diplomacyResult.success) {
        // Нейтралы присоединились!
        const creatureType = creatureId.replace('creature_', '').split('_')[0];
        const joinedCount = diplomacyResult.joinedCount;

        // Добавляем в армию героя
        const existing = this.hero.army.find(s => s.creatureId === creatureType);
        if (existing) {
          existing.count += joinedCount;
        } else {
          this.hero.army.push({ creatureId: creatureType, count: joinedCount });
        }

        // Удаляем существо с карты
        const pos = this.getHeroPosition();
        this.removeObject(creatureId, pos);

        this.showNotification(`🤝 Дипломатия! ${joinedCount}×${creatureType} присоединились к вам!`);
        return;
      }
    }

    this.showNotification('⚔️ Бой начинается!');
    this.time.delayedCall(300, () => {
      // Засыпаем WorldScene и запускаем BattleScene
      this.scene.sleep();
      this.scene.launch(CONFIG.SCENES.BATTLE, {
        attacker: this.hero,
        defenderId: creatureId,
        worldScene: this
      });
    });
  }

  private collectArtifact(id: string, pos: Position): void {
    const names = ['Меч силы', 'Щит защиты', 'Кольцо мудрости', 'Амулет удачи'];
    const name = names[Math.floor(Math.random() * names.length)];
    this.showNotification(`✨ Найден артефакт: ${name}!`);
    this.removeObject(id, pos);
    this.stopMovement(); // Останавливаем движение после подбора
  }

  private collectResource(id: string, pos: Position): void {
    const amount = Phaser.Math.Between(500, 2000);
    this.resources.gold += amount;
    this.showNotification(`💰 Получено ${amount} золота!`);
    this.removeObject(id, pos);
    this.updateResourceDisplay();
    this.stopMovement(); // Останавливаем движение после подбора
  }

  private captureMine(mineId: string): void {
    if (this.victorySystem) {
      const captured = this.victorySystem.captureMine(mineId, 'player');
      if (captured) {
        const mineType = this.mineTypes.get(mineId) || 'gold';
        const mineInfo = MINE_TYPES[mineType];
        this.showNotification(`⛏️ ${mineInfo.name} захвачена! +${mineInfo.dailyIncome} ${mineInfo.icon}/день`);
      }
    }
    this.stopMovement();
  }

  private usePortal(portalId: string): void {
    const otherPortalId = portalId === 'portal_1' ? 'portal_2' : 'portal_1';
    const otherSprite = this.objectSprites.get(otherPortalId);
    if (otherSprite) {
      this.stopMovement(); // Останавливаем движение
      const TS = CONFIG.TILE_SIZE;
      const newX = Math.floor(otherSprite.x / TS);
      const newY = Math.floor(otherSprite.y / TS);
      this.heroSprite.setPosition(newX * TS, newY * TS);
      this.revealAround({ x: newX, y: newY }, 5);
      this.showNotification('🌀 Телепортация!');
    }
  }

  private removeObject(id: string, pos: Position): void {
    const sprite = this.objectSprites.get(id);
    if (sprite) {
      sprite.destroy();
      this.objectSprites.delete(id);
    }
    if (this.map[pos.y]?.[pos.x]) {
      this.map[pos.y][pos.x].object = undefined;
    }
  }

  // === НОВЫЕ МЕТОДЫ ВЗАИМОДЕЙСТВИЯ С ОБЪЕКТАМИ ===

  private visitSchool(id: string, data: any): void {
    const school = data?.school || 'fire';
    const spellNames: Record<string, string> = {
      fire: 'Огненный шар', water: 'Ледяная стрела', earth: 'Каменная кожа',
      air: 'Молния', mind: 'Ослепление'
    };
    const spellName = spellNames[school] || 'Заклинание';
    
    if (!this.hero.spells.includes(spellName)) {
      this.hero.spells.push(spellName);
      this.showNotification(`🧙 Школа магии ${school}: изучено заклинание "${spellName}"!`);
    } else {
      this.showNotification(`🧙 Школа магии ${school}: вы уже знаете это заклинание`);
    }
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitShrine(id: string, data: any): void {
    const blessing = data?.blessing || 'attack';
    const value = data?.value || 1;
    
    const statNames: Record<string, string> = {
      attack: 'Атака', defense: 'Защита', spell_power: 'Сила магии', knowledge: 'Знания'
    };
    const statKey = blessing === 'spell_power' ? 'spellPower' : blessing;
    
    (this.hero.stats as any)[statKey] += value;
    this.showNotification(`⛪ Святилище: +${value} ${statNames[blessing]}!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitAltar(id: string, data: any): void {
    const bonus = data?.bonus || 'morale';
    const value = data?.value || 1;
    
    this.hero.stats[bonus as 'morale' | 'luck'] += value;
    const bonusName = bonus === 'morale' ? 'Мораль' : 'Удача';
    this.showNotification(`🗿 Алтарь: +${value} ${bonusName}!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitObelisk(id: string, data: any): void {
    const exp = data?.expReward || 500;
    this.addExperience(exp);
    this.showNotification(`🗼 Обелиск: получено ${exp} опыта!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitTavern(id: string, data: any): void {
    const rumor = data?.rumor || 'Слухи говорят о сокровищах на востоке...';
    this.showNotification(`🍺 Таверна: ${rumor}`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitWitchHut(id: string, data: any): void {
    const skill = data?.skill || 'offense';
    const skillNames: Record<string, string> = {
      offense: 'Наступление', defense: 'Оборона', archery: 'Стрельба',
      wisdom: 'Мудрость', logistics: 'Логистика', pathfinding: 'Следопыт'
    };
    
    const existing = this.hero.skills.find(s => s.id === skill);
    if (!existing) {
      const skillCategory: SkillCategory = 'combat';
      this.hero.skills.push({ 
        id: skill, 
        name: skillNames[skill] || skill, 
        level: 1,
        category: skillCategory,
        effects: []
      });
      this.showNotification(`🏚️ Хижина ведьмы: изучен навык "${skillNames[skill]}"!`);
    } else {
      this.showNotification(`🏚️ Хижина ведьмы: вы уже знаете этот навык`);
    }
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private openTreasureChest(id: string, data: any): void {
    const gold = data?.gold || 1500;
    const exp = data?.exp || 300;
    
    // Выбор: золото или опыт
    const choice = Math.random() > 0.5;
    if (choice) {
      this.resources.gold += gold;
      this.showNotification(`💰 Сундук: получено ${gold} золота!`);
    } else {
      this.addExperience(exp);
      this.showNotification(`✨ Сундук: получено ${exp} опыта!`);
    }
    this.updateResourceDisplay();
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitRefugeeCamp(id: string, data: any): void {
    const creature = data?.creature || 'pikeman';
    const count = data?.count || 5;
    
    // Добавляем в армию
    const existing = this.hero.army.find(s => s.creatureId === creature);
    if (existing) {
      existing.count += count;
    } else {
      this.hero.army.push({ creatureId: creature, count });
    }
    
    this.showNotification(`🏕️ Лагерь беженцев: присоединились ${count}×${creature}!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitGarrison(id: string, data: any): void {
    const creatures = data?.creatures || [];
    
    for (const c of creatures) {
      const existing = this.hero.army.find(s => s.creatureId === c.id);
      if (existing) {
        existing.count += c.count;
      } else {
        this.hero.army.push({ creatureId: c.id, count: c.count });
      }
    }
    
    const creatureStr = creatures.map((c: any) => `${c.count}×${c.id}`).join(', ');
    this.showNotification(`🏰 Гарнизон: получены ${creatureStr}!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitLibrary(id: string, data: any): void {
    const spell = data?.spell || 'fireball';
    const spellNames: Record<string, string> = {
      fireball: 'Огненный шар', lightning: 'Молния', heal: 'Лечение',
      bless: 'Благословение', curse: 'Проклятие', haste: 'Ускорение', slow: 'Замедление'
    };
    
    const spellName = spellNames[spell] || spell;
    if (!this.hero.spells.includes(spellName)) {
      this.hero.spells.push(spellName);
      this.showNotification(`📚 Библиотека: изучено заклинание "${spellName}"!`);
    } else {
      this.showNotification(`📚 Библиотека: вы уже знаете это заклинание`);
    }
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitMagicWell(id: string, data: any): void {
    const manaRestore = data?.manaRestore || 15;
    const restored = Math.min(manaRestore, this.hero.maxMana - this.hero.mana);
    this.hero.mana = Math.min(this.hero.maxMana, this.hero.mana + manaRestore);
    this.showNotification(`⛲ Волшебный колодец: восстановлено ${restored} маны!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private visitOasis(id: string, data: any): void {
    const bonus = data?.movementBonus || 500;
    // TODO: добавить систему очков движения
    this.showNotification(`🌴 Оазис: +${bonus} очков движения на следующий ход!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private claimWindmill(id: string, data: any): void {
    const goldPerWeek = data?.goldPerWeek || 500;
    // TODO: добавить систему еженедельного дохода
    this.showNotification(`🌾 Ветряная мельница захвачена: +${goldPerWeek} золота/неделю!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private claimWaterWheel(id: string, data: any): void {
    const goldPerWeek = data?.goldPerWeek || 750;
    // TODO: добавить систему еженедельного дохода
    this.showNotification(`💧 Водяное колесо захвачено: +${goldPerWeek} золота/неделю!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private stopMovement(): void {
    this.currentPath = [];
    this.isMoving = false;
    this.pathGraphics.clear();
    this.tweens.killTweensOf(this.heroSprite);
  }

  // ============================================================
  // === 🌋 ДВУХУРОВНЕВАЯ КАРТА (канон HoMM4) ===
  // ============================================================

  /**
   * Переключение между поверхностью и подземельем
   * В HoMM4 можно было переключаться в любой момент через кнопку интерфейса
   */
  private switchLevel(): void {
    if (this.isMoving) {
      this.showNotification('⏳ Нельзя переключить уровень во время движения');
      return;
    }

    // Меняем уровень
    const newLevel: MapLevel = this.currentLevel === 'surface' ? 'underground' : 'surface';
    
    // Сохраняем текущую позицию героя
    const heroPos = this.getHeroPosition();
    
    // Переключаем активную карту
    this.currentLevel = newLevel;
    this.map = newLevel === 'surface' ? this.surfaceMap : this.undergroundMap;
    
    // Перерисовываем карту
    this.redrawMap();
    
    // Перестраиваем pathfinder для новой карты
    this.pathfinder = new Pathfinder(this.map);
    
    // Перемещаем героя на ту же позицию (если проходима) или ищем ближайшую проходимую
    let targetX = heroPos.x;
    let targetY = heroPos.y;
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;
    
    if (targetX < mapW && targetY < mapH && !this.map[targetY][targetX].passable) {
      // Ищем ближайшую проходимую клетку
      for (let r = 1; r < 10; r++) {
        let found = false;
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const nx = heroPos.x + dx;
            const ny = heroPos.y + dy;
            if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
              if (this.map[ny][nx].passable) {
                targetX = nx;
                targetY = ny;
                found = true;
              }
            }
          }
        }
        if (found) break;
      }
    }
    
    // Обновляем позицию героя
    const TS = CONFIG.TILE_SIZE;
    this.heroSprite.setPosition(targetX * TS, targetY * TS);
    
    // Открываем область вокруг героя
    this.revealAround({ x: targetX, y: targetY }, this.heroManager?.getVisionRadius(this.hero) || 4);
    
    // Обновляем UI
    this.updateLevelIndicator();
    
    // Уведомление
    const levelName = newLevel === 'surface' ? '☀️ Поверхность' : '🌋 Подземелье';
    this.showNotification(`🗺️ Переключение на уровень: ${levelName}`);
    
    // Анимация затемнения (fade)
    this.camera.fade(300, 0, 0, 0, false);
    this.time.delayedCall(150, () => {
      this.camera.fade(300, 0, 0, 0, true);
    });
  }

  /**
   * Использование подземного портала (Subterranean Gate)
   * Телепортирует героя между уровнями в парный портал
   */
  private useSubterraneanGate(gateId: string, data: any): void {
    if (!data) {
      this.showNotification('🌀 Портал неактивен');
      return;
    }
    
    const targetLevel: MapLevel = data.targetLevel;
    const targetX: number = data.targetX;
    const targetY: number = data.targetY;
    
    if (!targetLevel || targetX === undefined || targetY === undefined) {
      this.showNotification('🌀 Портал повреждён');
      return;
    }
    
    // Останавливаем движение
    this.stopMovement();
    
    // Переключаем уровень если нужно
    if (targetLevel !== this.currentLevel) {
      this.currentLevel = targetLevel;
      this.map = targetLevel === 'surface' ? this.surfaceMap : this.undergroundMap;
      this.pathfinder = new Pathfinder(this.map);
    }
    
    // Перерисовываем карту
    this.redrawMap();
    
    // Телепортируем героя
    const TS = CONFIG.TILE_SIZE;
    this.heroSprite.setPosition(targetX * TS, targetY * TS);
    
    // Обновляем позицию героя
    (this.hero as any).x = targetX;
    (this.hero as any).y = targetY;
    (this.hero as any).mapLevel = targetLevel;
    
    // Открываем область вокруг героя
    this.revealAround({ x: targetX, y: targetY }, this.heroManager?.getVisionRadius(this.hero) || 5);
    
    // Обновляем UI
    this.updateLevelIndicator();
    
    // Уведомление
    const levelName = targetLevel === 'surface' ? '☀️ Поверхность' : '🌋 Подземелье';
    this.showNotification(`🌀 Subterranean Gate → ${levelName} (${targetX}, ${targetY})`);
    
    // Анимация телепортации
    this.camera.fade(400, 100, 50, 150, false);
    this.time.delayedCall(200, () => {
      this.camera.fade(400, 100, 50, 150, true);
    });
    
    // EventBus
    EventBus.emit('hero:teleported', {
      heroId: this.hero.id,
      fromLevel: data.fromLevel || this.currentLevel,
      toLevel: targetLevel,
      to: { x: targetX, y: targetY }
    });
  }

  /**
   * Перерисовка карты при переключении уровня
   * Очищает старые спрайты и создаёт новые
   */
  private redrawMap(): void {
    const TS = CONFIG.TILE_SIZE;
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    
    // Удаляем старые тайлы
    for (let y = 0; y < this.tileSprites.length; y++) {
      for (let x = 0; x < (this.tileSprites[y]?.length || 0); x++) {
        this.tileSprites[y]?.[x]?.destroy();
      }
    }
    this.tileSprites = [];
    
    // Удаляем старые объекты
    for (const sprite of this.objectSprites.values()) {
      sprite.destroy();
    }
    this.objectSprites.clear();
    
    // Удаляем старые ИИ-герои (они останутся только на surface)
    for (const sprite of this.aiHeroSprites.values()) {
      sprite.setVisible(this.currentLevel === 'surface');
    }
    for (const text of this.aiHeroNameTexts.values()) {
      text.setVisible(this.currentLevel === 'surface');
    }
    
    // Создаём новые тайлы
    for (let y = 0; y < mapH; y++) {
      this.tileSprites[y] = [];
      for (let x = 0; x < mapW; x++) {
        const tile = this.map[y][x];
        const textureKey = `tile_${tile.type}`;
        
        const sprite = this.add.sprite(x * TS, y * TS, textureKey).setOrigin(0, 0);
        this.tileSprites[y][x] = sprite;
        
        // Туман войны
        if (!tile.revealed) {
          sprite.setTint(0x111111);
          sprite.setAlpha(0.2);
        } else if (!tile.visible) {
          sprite.setAlpha(0.6);
          sprite.setTint(0x555555);
        }
      }
    }
    
    // Размещаем объекты текущего уровня
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const obj = this.map[y][x].object;
        if (!obj) continue;
        if (obj.level !== this.currentLevel) continue;
        
        const textureKey = obj.type;
        if (!this.textures.exists(textureKey)) continue;
        
        const sprite = this.add.sprite(x * TS, y * TS, textureKey)
          .setOrigin(0, 0)
          .setDepth(50)
          .setInteractive({ useHandCursor: true });
        
        this.objectSprites.set(obj.id, sprite);
        
        sprite.on('pointerover', () => sprite.setTint(0xffff00));
        sprite.on('pointerout', () => sprite.clearTint());
        sprite.on('pointerdown', () => this.handleObjectClick(obj.id, obj.type, obj.x, obj.y));
        
        // Туман войны для объектов
        const tile = this.map[y][x];
        if (!tile.revealed) {
          sprite.setVisible(false);
        } else if (!tile.visible) {
          sprite.setAlpha(0.5);
        }
      }
    }
    
    // Обновляем границы камеры
    this.camera.setBounds(0, 0, mapW * TS, mapH * TS);
    
    // Обновляем фон камеры для подземелья
    if (this.currentLevel === 'underground') {
      this.camera.setBackgroundColor('#1a0a1a'); // Тёмно-фиолетовый для подземелья
    } else {
      this.camera.setBackgroundColor('#000000'); // Стандартный чёрный для поверхности
    }
    
    console.log(`[WorldScene] ✓ Redrawn map for level: ${this.currentLevel}`);
  }

  /**
   * Обновить UI индикатор текущего уровня
   */
  private updateLevelIndicator(): void {
    if (!this.levelIndicator) return;
    
    const icon = this.currentLevel === 'surface' ? '☀️' : '🌋';
    const name = this.currentLevel === 'surface' ? 'Поверхность' : 'Подземелье';
    this.levelIndicator.setText(`${icon} ${name} (U - сменить)`);
    this.levelIndicator.setColor(this.currentLevel === 'surface' ? '#ffd700' : '#c77dff');
  }

  /**
   * Публичный метод для получения текущего уровня
   */
  public getCurrentLevel(): MapLevel {
    return this.currentLevel;
  }

  private showTileInfo(x: number, y: number): void {
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;
    if (x < 0 || x >= mapW || y < 0 || y >= mapH) return;
    
    const tile = this.map[y][x];
    const names: Record<TileType, string> = {
      // Поверхность
      grass: 'Трава', sand: 'Песок', water: 'Вода', rock: 'Скалы',
      snow: 'Снег', swamp: 'Болото', lava: 'Лава', forest: 'Лес',
      // Подземелье
      cave_floor: 'Пол пещеры',
      cave_rock: 'Скала (непроход)',
      underground_lake: 'Подземное озеро',
      mushroom_grove: 'Грибная роща',
      subterranean_river: 'Подземная река'
    };
    
    const levelIcon = this.currentLevel === 'surface' ? '☀️' : '🌋';
    let info = `${levelIcon} ${names[tile.type] || tile.type} (${x},${y}) | Цена: ${tile.moveCost}`;
    if (tile.object) info += ` | Объект: ${tile.object.type}`;
    
    this.showNotification(info);
  }

  private showHeroInfo(): void {
    if (!this.heroManager) {
      // Fallback если HeroManager не инициализирован
      const army = this.hero.army.map(s => `${s.creatureId}: ${s.count}`).join(', ');
      this.showNotification(`🦸 ${this.hero.name} | Ур.${this.hero.level} | АТК:${this.hero.stats.attack} ЗАЩ:${this.hero.stats.defense} | ${army}`);
      return;
    }
    // Показываем полную панель с навыками и бонусами
    this.heroManager.showHeroInfoPanel(this, this.hero);
  }

  public endTurn(): void {
    this.day++;
    
    // === ЕЖЕНЕДЕЛЬНЫЙ ПРИРОСТ (каждые 7 дней) ===
    if (this.day > 7) {
      this.day = 1;
      this.week++;
      this.showNotification('📅 Новая неделя!');
      this.applyWeeklyGrowth();
    }
    
    // === ДОХОД С ШАХТ (разные типы) ===
    const mineIncome = this.victorySystem.getDailyIncome();
    if (Object.keys(mineIncome).length > 0) {
      this.addResources(mineIncome);
      const incomeStr = Object.entries(mineIncome)
        .map(([res, val]) => {
          const icons: Record<string, string> = { gold: '💰', wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸' };
          return `${icons[res] || ''}+${val}`;
        })
        .join(' ');
      this.showNotification(`⛏️ Доход с шахт: ${incomeStr}`);
    }
    
    // === ДОХОД С ГОРОДОВ (с учётом зданий) ===
    const playerTowns = this.victorySystem.getPlayerTowns();
    let townIncomeTotal = 0;
    for (const town of playerTowns) {
      const townIncome = calculateTownDailyIncome(town.builtBuildings);
      townIncomeTotal += townIncome;
    }
    if (townIncomeTotal > 0) {
      this.resources.gold += townIncomeTotal;
      this.showNotification(`🏰 Доход с городов: +${townIncomeTotal} 💰`);
    }

    // === ДОХОД ОТ НАВЫКА ПОМЕСТЬЕ (Estates) ===
    if (this.heroManager) {
      const estatesIncome = this.heroManager.getDailyGoldIncome(this.hero);
      if (estatesIncome > 0) {
        this.resources.gold += estatesIncome;
        this.showNotification(`🏠 Поместье: +${estatesIncome} 💰`);
      }

      // Доход от всех героев игрока
      for (const otherHero of this.playerHeroes) {
        if (otherHero.id === this.hero.id) continue;
        const heroIncome = this.heroManager.getDailyGoldIncome(otherHero);
        if (heroIncome > 0) {
          this.resources.gold += heroIncome;
        }
      }
    }
    
    this.dayText.setText(`День: ${this.day} | Неделя: ${this.week}`);
    this.updateResourceDisplay();
    
    // Обновляем состояние дня в VictorySystem
    this.victorySystem.setDay(this.day);
    
    // === КАРАВАНЫ ===
    const arrivedCaravans = this.caravanSystem.updateDay(this.day);
    for (const caravan of arrivedCaravans) {
      this.handleCaravanArrival(caravan);
    }
    
    // Ход ИИ противников
    this.aiSystem.executeTurn();
    this.updateAIHeroPositions();
    
    // Проверяем условия победы/поражения
    this.checkVictoryConditions();
    
    // 💾 Автосохранение после каждого хода
    this.autoSave();
  }
  
  /**
   * Применить еженедельный прирост существ во всех городах игрока
   * 
   * Использует EconomySystem.calculateWeeklyGrowth() с учётом:
   * - Цитадель (Citadel/Capitol): +25% прирост
   * - Улучшенное жилище: +50% прирост
   */
  private applyWeeklyGrowth(): void {
    const playerTowns = this.victorySystem.getPlayerTowns();
    
    for (const town of playerTowns) {
      const hasCitadel = town.builtBuildings.includes('citadel') || 
                         town.builtBuildings.includes('capitol');
      
      const growthDetails: string[] = [];
      
      // Рассчитываем прирост для каждого существа в городе
      for (const hireSlot of town.availableForHire) {
        const creatureId = hireSlot.creatureId;
        
        // Проверяем построено ли улучшенное жилище
        // Апгрейд увеличивает прирост на +50%
        const isUpgraded = this.isDwellingUpgraded(town.builtBuildings, creatureId);
        
        // Используем центральную функцию из EconomySystem
        const growth = calculateWeeklyGrowth(creatureId, hasCitadel, isUpgraded);
        
        if (growth > 0) {
          hireSlot.count += growth;
          growthDetails.push(`${growth}×${creatureId}`);
        }
      }
      
      // Показываем уведомление только если был прирост
      if (growthDetails.length > 0) {
        this.showNotification(`📈 Прирост в ${town.name}: ${growthDetails.join(', ')}`);
      }
    }
  }
  
  /**
   * Проверить построено ли улучшенное жилище для существа
   * 
   * Маппинг жилище → существо. Улучшенное жилище даёт +50% прироста.
   */
  private isDwellingUpgraded(builtBuildings: string[], creatureId: string): boolean {
    // Таблица улучшенных жилищ по фракциям
    const upgradedDwellings: Record<string, string[]> = {
      // Haven
      pikeman: ['upg_barracks', 'halberdier_dwelling'],
      archer: ['upg_archery_range', 'marksman_dwelling'],
      griffin: ['upg_griffin_tower', 'royal_griffin_dwelling'],
      swordsman: ['upg_swordsmith', 'crusader_dwelling'],
      cavalier: ['upg_jousting_arena', 'champion_dwelling'],
      angel: ['upg_portal_of_glory', 'archangel_dwelling'],
      // Necropolis
      skeleton: ['upg_cursed_temple', 'skeleton_warrior_dwelling'],
      zombie: ['upg_graveyard', 'plague_zombie_dwelling'],
      vampire: ['upg_mausoleum', 'vampire_lord_dwelling'],
      lich: ['upg_tomb', 'arch_lich_dwelling'],
      blackKnight: ['upg_estate', 'dread_knight_dwelling'],
      boneDragon: ['upg_dragon_vault', 'ghost_dragon_dwelling'],
      // Preserve
      wolf: ['upg_wolf_pen', 'dire_wolf_dwelling'],
      elf: ['upg_hunters_lodge', 'grand_elf_dwelling'],
      unicorn: ['upg_unicorn_grove', 'silver_pegasus_dwelling'],
      // Asylum
      imp: ['upg_imp_crucible', 'familiar_dwelling'],
      goblin: ['upg_goblin_barracks', 'hobgoblin_dwelling'],
      // Academy
      gremlin: ['upg_workshop', 'master_gremlin_dwelling'],
      golem: ['upg_golem_factory', 'diamond_golem_dwelling'],
      mage: ['upg_mage_tower', 'arch_mage_dwelling'],
      genie: ['upg_altar_of_wishes', 'master_genie_dwelling'],
      titan: ['upg_cloud_temple', 'thunder_titan_dwelling'],
      // Stronghold
      goblinS: ['upg_hall_of_strength', 'hobgoblin_dwelling'],
      wolfRider: ['upg_wolf_stable', 'wolf_raider_dwelling'],
      ogreChief: ['upg_ogre_fortress', 'ogre_lord_dwelling'],
      behemoth: ['upg_behemoth_lair', 'ancient_behemoth_dwelling'],
    };
    
    const dwellingList = upgradedDwellings[creatureId];
    if (!dwellingList) return false;
    
    return dwellingList.some(dw => builtBuildings.includes(dw));
  }
  
  /**
   * Обработка прибытия каравана
   */
  private handleCaravanArrival(caravan: any): void {
    const town = this.victorySystem.getTown(caravan.toTownId);
    if (!town) return;
    
    // Добавляем существ в гарнизон
    for (const unit of caravan.units) {
      const existing = town.garrison.find(s => s.creatureId === unit.creatureId);
      if (existing) {
        existing.count += unit.count;
      } else {
        town.garrison.push({ creatureId: unit.creatureId, count: unit.count });
      }
    }
    
    this.showNotification(`🚚 Караван прибыл в ${town.name}!`);
  }

  private checkVictoryConditions(): void {
    const result = this.victorySystem.checkVictory();
    
    if (result.gameOver) {
      this.stopMovement();
      this.time.delayedCall(500, () => {
        this.showGameOverScreen(result.result as 'victory' | 'defeat', result.reason, result.stats);
      });
    }
  }

  private showGameOverScreen(
    result: 'victory' | 'defeat', 
    reason: string, 
    stats: { playerTowns: number; playerHeroes: number; aiTowns: number; aiHeroes: number; day: number }
  ): void {
    const { width, height } = this.scale;
    const isVictory = result === 'victory';
    
    // Затемняем всё
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
      .setScrollFactor(0)
      .setDepth(1000);
    
    // Панель
    const panelColor = isVictory ? 0x2d5016 : 0x8b0000;
    const panel = this.add.rectangle(width / 2, height / 2, 500, 400, panelColor, 0.95)
      .setStrokeStyle(4, 0xd4af37)
      .setScrollFactor(0)
      .setDepth(1001);
    
    // Заголовок
    const titleEmoji = isVictory ? '🏆' : '💀';
    const titleText = isVictory ? 'ПОБЕДА!' : 'ПОРАЖЕНИЕ';
    const title = this.add.text(width / 2, height / 2 - 150, `${titleEmoji} ${titleText} ${titleEmoji}`, {
      fontSize: '48px',
      color: isVictory ? '#ffd700' : '#ff4444',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    
    // Причина
    this.add.text(width / 2, height / 2 - 80, reason, {
      fontSize: '18px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      align: 'center',
      wordWrap: { width: 450 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    
    // Статистика
    const statsText = [
      `📅 Дней прошло: ${stats.day}`,
      `🏰 Ваши города: ${stats.playerTowns}`,
      `🦸 Ваши герои: ${stats.playerHeroes}`,
      `🏴 Вражеские города: ${stats.aiTowns}`,
      `👹 Вражеские герои: ${stats.aiHeroes}`,
      `💰 Золото: ${this.resources.gold}`
    ].join('\n');
    
    this.add.text(width / 2, height / 2 + 20, statsText, {
      fontSize: '16px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      lineSpacing: 8
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1002);
    
    // Кнопка "В меню"
    const menuBtn = this.add.rectangle(width / 2, height / 2 + 150, 200, 50, 0x8b4513, 0.95)
      .setStrokeStyle(2, 0xd4af37)
      .setScrollFactor(0)
      .setDepth(1002)
      .setInteractive({ useHandCursor: true });
    
    this.add.text(width / 2, height / 2 + 150, '🏠 В ГЛАВНОЕ МЕНЮ', {
      fontSize: '16px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(1003);
    
    menuBtn.on('pointerover', () => menuBtn.setFillStyle(0xa0522d, 1));
    menuBtn.on('pointerout', () => menuBtn.setFillStyle(0x8b4513, 0.95));
    menuBtn.on('pointerdown', () => {
      // Удаляем все сцены и возвращаемся в меню
      this.scene.stop(CONFIG.SCENES.UI);
      this.scene.start(CONFIG.SCENES.MENU);
    });
    
    // Анимация появления
    [overlay, panel, title].forEach(obj => {
      obj.setAlpha(0);
      this.tweens.add({ targets: obj, alpha: obj === overlay ? 0.85 : 1, duration: 500 });
    });
  }

  private registerGameObjects(): void {
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;
    
    // Регистрируем героя
    const heroPos = this.getHeroPosition();
    this.victorySystem.registerHero({
      id: this.hero.id,
      hero: this.hero,
      owner: 'player',
      alive: true,
      x: heroPos.x,
      y: heroPos.y
    });
    
    // Регистрируем все объекты на карте
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const obj = this.map[y]?.[x]?.object;
        if (!obj) continue;
        
        if (obj.type === 'town') {
          this.victorySystem.registerTown({
            id: obj.id,
            name: 'Серебряный Замок',
            faction: 'haven',
            x, y,
            owner: 'player',
            builtBuildings: ['citadel', 'barracks'],
            garrison: [],
            availableForHire: [],
            lastGrowthDay: 1
          });
        } else if (obj.type === 'enemy_town') {
          this.victorySystem.registerTown({
            id: obj.id,
            name: 'Тёмная Крепость',
            faction: 'necropolis',
            x, y,
            owner: 'ai',
            builtBuildings: ['citadel', 'cursed_temple'],
            garrison: [
              { creatureId: 'skeleton', count: 30 },
              { creatureId: 'zombie', count: 20 }
            ],
            availableForHire: [],
            lastGrowthDay: 1
          });
        } else if (obj.type === 'mine') {
          const mineType = this.mineTypes.get(obj.id) || 'gold';
          const mineInfo = MINE_TYPES[mineType];
          this.victorySystem.registerMine({
            id: obj.id,
            x, y,
            owner: 'neutral',
            resourceType: mineType as any,
            dailyIncome: mineInfo.dailyIncome,
            mineName: mineInfo.name,
            icon: mineInfo.icon
          });
        }
      }
    }
    
    console.log('[WorldScene] Registered:', this.victorySystem.getStats());
  }

  public getVictorySystem(): VictorySystem {
    return this.victorySystem;
  }

  public getMap(): Tile[][] { return this.map; }
  public getMapSize(): { w: number; h: number } { 
    return { w: this.map[0]?.length || 0, h: this.map.length }; 
  }

  private createUI(): void {
    const { width } = this.scale;
    
    // Панель ресурсов
    this.add.rectangle(width / 2, 25, width - 40, 40, 0x1a1a2e, 0.9)
      .setStrokeStyle(2, 0xd4af37)
      .setScrollFactor(0)
      .setDepth(200);

    const resources = [
      { icon: '💰', value: this.resources.gold },
      { icon: '🪵', value: this.resources.wood },
      { icon: '⛏️', value: this.resources.ore },
      { icon: '💎', value: this.resources.crystal },
      { icon: '💠', value: this.resources.gems },
      { icon: '🟡', value: this.resources.sulfur },
      { icon: '🩸', value: this.resources.mercury }
    ];

    const startX = 80;
    const spacing = 150;
    
    resources.forEach((res, i) => {
      const text = this.add.text(startX + i * spacing, 25, `${res.icon} ${res.value}`, {
        fontSize: '15px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(201);
      this.resourceDisplay.push(text);
    });

    this.dayText = this.add.text(width - 20, 25, `День: ${this.day} | Неделя: ${this.week}`, {
      fontSize: '15px', color: '#d4af37', fontFamily: 'Segoe UI'
    }).setOrigin(1, 0.5).setScrollFactor(0).setDepth(201);

    // Кнопка конца хода
    const btnX = width - 120;
    const btnY = this.scale.height - 50;
    const btn = this.add.rectangle(btnX, btnY, 180, 44, 0x8b4513, 0.95)
      .setStrokeStyle(2, 0xd4af37)
      .setScrollFactor(0)
      .setDepth(200)
      .setInteractive({ useHandCursor: true });

    this.add.text(btnX, btnY, '⏭️ КОНЕЦ ХОДА', {
      fontSize: '15px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(201);

    btn.on('pointerdown', () => this.endTurn());
    btn.on('pointerover', () => btn.setFillStyle(0xa0522d, 1));
    btn.on('pointerout', () => btn.setFillStyle(0x8b4513, 0.95));

    // === UI индикатор текущего уровня (surface/underground) ===
    this.levelIndicator = this.add.text(20, this.scale.height - 50, '☀️ Поверхность (U - сменить)', {
      fontSize: '16px',
      color: '#ffd700',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
      backgroundColor: '#1a1a2ecc',
      padding: { x: 12, y: 8 }
    }).setOrigin(0, 0.5).setScrollFactor(0).setDepth(201);
  }

  private updateResourceDisplay(): void {
    const values = [
      this.resources.gold, this.resources.wood, this.resources.ore,
      this.resources.crystal, this.resources.gems, this.resources.sulfur, this.resources.mercury
    ];
    const icons = ['💰', '🪵', '⛏️', '💎', '💠', '🟡', '🩸'];
    
    this.resourceDisplay.forEach((text, i) => {
      if (text) text.setText(`${icons[i]} ${values[i]}`);
    });
  }

  private showNotification(text: string): void {
    const { width, height } = this.scale;
    
    const panel = this.add.rectangle(width / 2, height - 80, 500, 50, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37)
      .setScrollFactor(0)
      .setDepth(300);
    
    const msg = this.add.text(width / 2, height - 80, text, {
      fontSize: '15px', color: '#f0e6d2', fontFamily: 'Segoe UI',
      align: 'center', wordWrap: { width: 480 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    this.tweens.add({
      targets: [panel, msg],
      alpha: 0,
      delay: 2500,
      duration: 500,
      onComplete: () => { panel.destroy(); msg.destroy(); }
    });
  }

  public getHero(): Hero { return this.hero; }
  public getResources(): typeof this.resources { return this.resources; }
  
  /**
   * Получить систему караванов (для TownScene)
   */
  public getCaravanSystem(): CaravanSystem {
    return this.caravanSystem;
  }
  
  /**
   * Получить текущий день
   */
  public getCurrentDay(): number {
    return this.day;
  }
  
  /**
   * Получить список всех героев игрока
   */
  public getPlayerHeroes(): Hero[] {
    return this.playerHeroes;
  }
  
  /**
   * Добавить нового героя на карту (для таверны)
   * Использует HeroManager для создания с навыками и специализацией
   */
  public addNewHero(newHero: Hero, townX: number, townY: number): void {
    const TS = CONFIG.TILE_SIZE;
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;

    // Ищем проходимую клетку рядом с городом
    let spawnX = townX + 1;
    let spawnY = townY;
    if (!this.map[spawnY]?.[spawnX]?.passable) {
      spawnX = townX;
      spawnY = townY + 1;
    }
    if (!this.map[spawnY]?.[spawnX]?.passable) {
      spawnX = townX - 1;
      spawnY = townY;
    }
    if (!this.map[spawnY]?.[spawnX]?.passable) {
      // Ищем в радиусе
      for (let r = 2; r < 5; r++) {
        let found = false;
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            const nx = townX + dx;
            const ny = townY + dy;
            if (nx >= 0 && nx < mapW && ny >= 0 && ny < mapH) {
              if (this.map[ny][nx].passable && !this.map[ny][nx].object) {
                spawnX = nx;
                spawnY = ny;
                found = true;
              }
            }
          }
        }
        if (found) break;
      }
    }

    // Создаём спрайт героя
    const sprite = this.add.sprite(spawnX * TS, spawnY * TS, 'hero')
      .setOrigin(0, 0)
      .setDepth(100)
      .setTint(0x4488ff); // Голубой оттенок для новых героев

    // Обновляем позицию героя
    (newHero as any).x = spawnX;
    (newHero as any).y = spawnY;

    this.playerHeroes.push(newHero);
    this.playerHeroSprites.set(newHero.id, sprite);

    // Регистрируем в VictorySystem
    if (this.victorySystem) {
      this.victorySystem.registerHero({
        id: newHero.id,
        hero: newHero,
        owner: 'player',
        alive: true,
        x: spawnX,
        y: spawnY
      });
    }

    // Логируем навыки нового героя
    const skillsStr = newHero.skills.map(s => `${s.name} (lvl ${s.level})`).join(', ') || 'нет навыков';
    this.showNotification(`🦸 Новый герой ${newHero.name}! Навыки: ${skillsStr}`);
    console.log(`[WorldScene] New hero added: ${newHero.name} at ${spawnX},${spawnY}. Total heroes: ${this.playerHeroes.length}`);
  }
  
  /**
   * Переключиться на следующего героя
   */
  private switchToNextHero(): void {
    if (this.playerHeroes.length <= 1) {
      this.showNotification('У вас только один герой');
      return;
    }
    
    this.currentHeroIndex = (this.currentHeroIndex + 1) % this.playerHeroes.length;
    this.hero = this.playerHeroes[this.currentHeroIndex];
    
    // Меняем спрайт активного героя
    const newSprite = this.playerHeroSprites.get(this.hero.id);
    if (newSprite) {
      this.heroSprite = newSprite;
      this.camera.startFollow(this.heroSprite, true, 0.08, 0.08);
    }
    
    this.showNotification(`🦸 Активный герой: ${this.hero.name} (${this.currentHeroIndex + 1}/${this.playerHeroes.length})`);
  }
  
  public addExperience(exp: number): void {
    if (!this.heroManager) {
      // Fallback без HeroManager
      this.hero.experience += exp;
      const expToLevel = this.hero.level * 1000;
      if (this.hero.experience >= expToLevel) {
        this.hero.level++;
        this.hero.stats.attack += 1;
        this.hero.stats.defense += 1;
        this.showNotification(`🎉 Уровень ${this.hero.level}! +1 АТК, +1 ЗАЩ`);
      }
      return;
    }

    // Используем HeroManager с UI выбора навыка
    this.heroManager.addExperience(
      this,
      this.hero,
      exp,
      (msg) => this.showNotification(msg)
    );
  }
  
  public addResources(res: Partial<Resources>): void {
    for (const [key, value] of Object.entries(res)) {
      (this.resources as any)[key] = ((this.resources as any)[key] || 0) + (value as number);
    }
    this.updateResourceDisplay();
  }

  /**
   * Инициализация системы ИИ (полноценная версия)
   */
  private initAISystem(): void {
    // Собираем все объекты карты
    const objects: any[] = [];
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const obj = this.map[y]?.[x]?.object;
        if (obj) {
          objects.push(obj);
        }
      }
    }

    // Создаём систему ИИ с коллбэками
    this.aiSystem = new AISystem(this.map, objects, {
      getVictorySystem: () => this.victorySystem,
      getPlayerHero: () => this.hero,
      getPlayerPosition: () => this.getHeroPosition(),
      getTownData: (townId: string) => this.getTownDataForAI(townId),
      onAIAttackHero: (aiHero) => this.handleAIAttackHero(aiHero),
      onAIAttackCreature: (aiHero, creatureId) => this.handleAIAttackCreature(aiHero, creatureId),
      onAIMove: (aiId, x, y) => this.animateAIHeroMove(aiId, x, y),
      onAICaptureTown: (aiId, townId) => this.handleAICaptureTown(aiId, townId),
      onAICaptureMine: (aiId, mineId) => this.handleAICaptureMine(aiId, mineId),
      onAINotification: (msg) => this.showNotification(msg)
    });

    // Получаем вражеские города
    const aiTowns = this.victorySystem.getAITowns();

    // Создаём ИИ героев для каждого города
    for (let i = 0; i < aiTowns.length; i++) {
      const town = aiTowns[i];
      const TS = CONFIG.TILE_SIZE;

      // Ищем проходимую клетку рядом с городом
      let spawnX = town.x + 1;
      let spawnY = town.y;
      if (!this.map[spawnY]?.[spawnX]?.passable) {
        spawnX = town.x;
        spawnY = town.y + 1;
      }

      const isNecro = town.faction === 'necropolis';
      const hero: Hero = {
        id: `ai_hero_${i}`,
        name: isNecro ? 'Лорд Мортис' : 'Тёмный Рыцарь',
        class: isNecro ? 'Некромант' : 'Рыцарь',
        faction: town.faction,
        level: 1,
        experience: 0,
        stats: { attack: 2, defense: 2, spellPower: isNecro ? 3 : 1, knowledge: isNecro ? 3 : 1 },
        skills: [],
        mana: 20,
        maxMana: 20,
        army: isNecro
          ? [
              { creatureId: 'skeleton', count: 40 },
              { creatureId: 'zombie', count: 25 }
            ]
          : [
              { creatureId: 'pikeman', count: 30 },
              { creatureId: 'archer', count: 15 }
            ],
        equipment: {},
        spells: [],
        x: spawnX,
        y: spawnY,
        movementPoints: 1500,
        maxMovementPoints: 1500,
        morale: 0,
        luck: 0,
        owner: 'enemy',
        mapLevel: 'surface'
      };

      // Создаём спрайт ИИ героя
      const sprite = this.add.sprite(spawnX * TS, spawnY * TS, 'hero')
        .setOrigin(0, 0)
        .setDepth(100)
        .setTint(0xff4444);

      // Добавляем имя
      const nameText = this.add.text(spawnX * TS + TS / 2, spawnY * TS - 5, hero.name, {
        fontSize: '11px',
        color: '#ff4444',
        fontFamily: 'Segoe UI',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(101);

      this.aiHeroSprites.set(hero.id, sprite);
      this.aiHeroNameTexts.set(hero.id, nameText);
    }

    // Инициализируем ИИ игроков с данными о городах
    this.aiSystem.initAIPlayers(aiTowns, []);

    console.log(`[AI] Инициализировано ${aiTowns.length} ИИ противников`);
  }

  /**
   * Получить данные о городе для ИИ
   */
  private getTownDataForAI(townId: string): any {
    return this.victorySystem.getTown(townId);
  }

  /**
   * ИИ атакует героя игрока
   */
  private handleAIAttackHero(aiHero: Hero): void {
    console.log('[AI] Атака героя игрока!', aiHero.name);
    this.showNotification(`⚔️ ${aiHero.name} нападает на вас!`);

    // Останавливаем движение игрока
    this.stopMovement();

    // Запускаем бой (ИИ — атакующий, игрок — защитник)
    this.time.delayedCall(500, () => {
      this.scene.sleep();
      this.scene.launch(CONFIG.SCENES.BATTLE, {
        attacker: aiHero,           // ИИ атакует
        defenderHero: this.hero,   // Игрок защищается
        isAIAttack: true,
        worldScene: this
      });
    });
  }

  /**
   * ИИ атакует нейтральное существо
   */
  private handleAIAttackCreature(aiHero: Hero, creatureId: string): void {
    console.log(`[AI] ${aiHero.name} атакует ${creatureId}`);
    // Удаляем существо с карты
    this.removeObject(creatureId, { x: aiHero.x!, y: aiHero.y! });
  }

  /**
   * Анимация движения ИИ героя
   */
  private animateAIHeroMove(aiId: string, x: number, y: number): void {
    const sprite = this.aiHeroSprites.get(aiId);
    const nameText = this.aiHeroNameTexts.get(aiId);
    if (!sprite) return;

    const TS = CONFIG.TILE_SIZE;
    this.tweens.add({
      targets: sprite,
      x: x * TS,
      y: y * TS,
      duration: 400,
      ease: 'Linear'
    });

    if (nameText) {
      this.tweens.add({
        targets: nameText,
        x: x * TS + TS / 2,
        y: y * TS - 5,
        duration: 400,
        ease: 'Linear'
      });
    }
  }

  /**
   * ИИ захватил город игрока
   */
  private handleAICaptureTown(aiId: string, townId: string): void {
    console.log(`[AI] Захвачен город ${townId}`);
    // Обновляем цвет спрайта города на красный
    const sprite = this.objectSprites.get(townId);
    if (sprite) {
      sprite.setTint(0xff4444);
    }
  }

  /**
   * ИИ захватил шахту игрока
   */
  private handleAICaptureMine(aiId: string, mineId: string): void {
    console.log(`[AI] Захвачена шахта ${mineId}`);
    const sprite = this.objectSprites.get(mineId);
    if (sprite) {
      sprite.setTint(0xff4444);
    }
  }

  /**
   * Обновление позиций ИИ героев на карте (после хода)
   */
  private updateAIHeroPositions(): void {
    const aiPlayers = this.aiSystem.getAIPlayers();
    const TS = CONFIG.TILE_SIZE;

    for (const ai of aiPlayers) {
      const sprite = this.aiHeroSprites.get(ai.hero.id);
      const nameText = this.aiHeroNameTexts.get(ai.hero.id);
      if (sprite) {
        sprite.setPosition(ai.hero.x! * TS, ai.hero.y! * TS);
      }
      if (nameText) {
        nameText.setPosition(ai.hero.x! * TS + TS / 2, ai.hero.y! * TS - 5);
      }
    }
  }

  // ============================================================
  // === 💾 СИСТЕМА СОХРАНЕНИЯ ===
  // ============================================================

  /**
   * Настройка горячих клавиш для сохранения/загрузки
   */
  private setupSaveHotkeys(): void {
    // F5 — быстрое сохранение в слот 1
    this.input.keyboard?.on('keydown-F5', (event: KeyboardEvent) => {
      event.preventDefault();
      this.quickSave();
    });

    // F9 — быстрая загрузка из слота 1
    this.input.keyboard?.on('keydown-F9', (event: KeyboardEvent) => {
      event.preventDefault();
      this.quickLoad();
    });

    // Ctrl+S — открыть диалог сохранения
    this.input.keyboard?.on('keydown-S', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.openSaveDialog();
      }
    });

    // Ctrl+L — открыть диалог загрузки
    this.input.keyboard?.on('keydown-L', (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.openLoadDialog();
      }
    });

    console.log('[WorldScene] ✓ Save/Load hotkeys: F5, F9, Ctrl+S, Ctrl+L');
  }

  /**
   * Быстрое сохранение (F5) — в слот 1
   */
  private quickSave(): void {
    const saveData = this.saveSystem.collectSaveData(this);
    const success = this.saveSystem.saveGame(1, saveData);
    
    if (success) {
      this.showSaveNotification('💾 Быстрое сохранение (слот 1)');
    } else {
      this.showSaveNotification('❌ Ошибка сохранения');
    }
  }

  /**
   * Быстрая загрузка (F9) — из слота 1
   */
  private quickLoad(): void {
    if (!this.saveSystem.hasSave(1)) {
      this.showSaveNotification('💭 Слот 1 пуст');
      return;
    }
    
    const saveData = this.saveSystem.loadGame(1);
    if (saveData) {
      this.scene.start(CONFIG.SCENES.WORLD, {
        loadSave: true,
        saveData: saveData,
        seed: saveData.seed,
      });
    }
  }

  /**
   * Открыть диалог сохранения (Ctrl+S)
   */
  private openSaveDialog(): void {
    const ui = new SaveLoadUI(this, 'save');
    ui.show();
  }

  /**
   * Открыть диалог загрузки (Ctrl+L)
   */
  private openLoadDialog(): void {
    const ui = new SaveLoadUI(this, 'load');
    ui.show();
  }

  /**
   * Автосохранение (вызывается при конце хода)
   */
  public autoSave(): void {
    try {
      const saveData = this.saveSystem.collectSaveData(this);
      this.saveSystem.autoSave(saveData);
    } catch (error) {
      console.error('[WorldScene] Ошибка автосохранения:', error);
    }
  }

  /**
   * Показать уведомление о сохранении
   */
  private showSaveNotification(text: string): void {
    const { width, height } = this.scale;
    
    const toast = this.add.text(width / 2, height - 60, text, {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Segoe UI',
      backgroundColor: '#000000cc',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setScrollFactor(0).setDepth(10000);

    this.tweens.add({
      targets: toast,
      alpha: 0,
      y: height - 120,
      duration: 2000,
      delay: 1000,
      onComplete: () => toast.destroy(),
    });
  }

  /**
   * Обновление UI (вызывается после загрузки из сохранения)
   */
  private updateUI(): void {
    // Обновить отображение дня/недели
    if (this.dayText) {
      this.dayText.setText(`📅 Неделя ${this.week}, День ${this.day}`);
    }
    
    // Обновить отображение ресурсов
    this.updateResourceDisplay();
    
    // Обновить видимость карты
    this.refreshMapVisibility();
  }

  /**
   * Обновить видимость карты (туман войны)
   */
  private refreshMapVisibility(): void {
    const TS = CONFIG.TILE_SIZE;
    
    // Обновить спрайты тайлов
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        const tile = this.map[y][x];
        const sprite = this.tileSprites[y]?.[x];
        
        if (sprite) {
          if (tile.visible) {
            sprite.setAlpha(1);
            sprite.clearTint();
          } else if (tile.visited) {
            sprite.setAlpha(0.6);
            sprite.setTint(0x555555);
          } else {
            sprite.setAlpha(0.2);
            sprite.setTint(0x000000);
          }
        }
        
        // Обновить объекты
        if (tile.object) {
          const objSprite = this.objectSprites.get(tile.object.id);
          if (objSprite) {
            if (tile.visible) {
              objSprite.setAlpha(1);
              objSprite.setVisible(true);
            } else if (tile.visited) {
              objSprite.setAlpha(0.5);
              objSprite.setVisible(true);
            } else {
              objSprite.setVisible(false);
            }
          }
        }
      }
    }
  }

  /**
   * Получить текущий seed карты
   */
  public get seed(): number {
    return CONFIG.MAP_SEED;
  }

  // ============================================================
  // === ⚓ МОРСКАЯ СИСТЕМА (канон HoMM4) ===
  // ============================================================

  /**
   * Перестроить Pathfinder с учётом текущего состояния героя
   * Вызывается после посадки/высадки с корабля и изменения заклинаний
   */
  private rebuildPathfinder(): void {
    const hero = this.hero;
    this.pathfinder = new Pathfinder(this.map, {
      passableOverride: (tile) => this.isTilePassableForHero(tile.type),
      moveCostOverride: (tile) => this.getMoveCostForHero(tile.type),
    });
  }

  /**
   * Генерация кораблей на карте
   * Размещает 3-5 лодок на воде рядом с берегом
   */
  private generateShips(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const shipCount = 4;
    let placed = 0;
    let attempts = 0;

    while (placed < shipCount && attempts < 300) {
      attempts++;
      const x = Phaser.Math.Between(2, mapW - 3);
      const y = Phaser.Math.Between(2, mapH - 3);
      const tile = this.map[y]?.[x];

      // Корабль должен быть на воде
      if (!tile || tile.type !== 'water') continue;
      if (tile.object) continue;

      // И рядом должна быть суша (берег)
      let hasLandNearby = false;
      for (let dy = -2; dy <= 2 && !hasLandNearby; dy++) {
        for (let dx = -2; dx <= 2 && !hasLandNearby; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          const ny = y + dy;
          const n = this.map[ny]?.[nx];
          if (n && n.type !== 'water' && n.type !== 'rock' && n.passable) {
            hasLandNearby = true;
          }
        }
      }
      if (!hasLandNearby) continue;

      // Размещаем корабль
      const shipObj = createShipObject(x, y, 'boat');
      this.placeObjectSafe(shipObj.id, 'boat', x, y, shipObj.data);
      placed++;
    }

    console.log(`[WorldScene] ⚓ Размещено ${placed} кораблей (из ${shipCount})`);
  }

  /**
   * Генерация водоворотов (Whirlpool)
   * 2 парных водоворота для телепортации между частями карты
   */
  private generateWhirlpools(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const pairCount = 2;
    let pairsPlaced = 0;
    let attempts = 0;

    const usedPositions = new Set<string>();

    while (pairsPlaced < pairCount && attempts < 200) {
      attempts++;
      // Ищем 2 позиции на воде далеко друг от друга
      const x1 = Phaser.Math.Between(5, Math.floor(mapW / 2) - 3);
      const y1 = Phaser.Math.Between(5, mapH - 5);
      const x2 = Phaser.Math.Between(Math.floor(mapW / 2) + 3, mapW - 5);
      const y2 = Phaser.Math.Between(5, mapH - 5);

      const t1 = this.map[y1]?.[x1];
      const t2 = this.map[y2]?.[x2];
      if (!t1 || t1.type !== 'water' || t1.object) continue;
      if (!t2 || t2.type !== 'water' || t2.object) continue;

      const key1 = `${x1},${y1}`;
      const key2 = `${x2},${y2}`;
      if (usedPositions.has(key1) || usedPositions.has(key2)) continue;

      const id1 = `whirlpool_a_${pairsPlaced}`;
      const id2 = `whirlpool_b_${pairsPlaced}`;

      this.placeObjectSafe(id1, 'whirlpool', x1, y1, {
        pairedId: id2,
        targetX: x2,
        targetY: y2,
      });
      this.placeObjectSafe(id2, 'whirlpool', x2, y2, {
        pairedId: id1,
        targetX: x1,
        targetY: y1,
      });

      this.whirlpoolPairs.push({ id1, id2, x1, y1, x2, y2 });
      usedPositions.add(key1);
      usedPositions.add(key2);
      pairsPlaced++;
    }

    console.log(`[WorldScene] 🌀 Размещено ${pairsPlaced} пар водоворотов`);
  }

  /**
   * Попытка посадки героя на корабль
   */
  private tryBoardShip(shipObject: MapObject): boolean {
    if (!canBoardShip(this.hero, shipObject, this.map)) {
      this.showNotification('⚓ Нельзя сесть на этот корабль');
      return false;
    }

    this.stopMovement();

    const result = boardShip(this.hero, shipObject);
    this.hero = result.hero;

    // Обновляем ссылку в playerHeroes
    const idx = this.playerHeroes.findIndex(h => h.id === this.hero.id);
    if (idx >= 0) this.playerHeroes[idx] = this.hero;

    // Удаляем спрайт корабля с карты
    const shipSprite = this.objectSprites.get(shipObject.id);
    if (shipSprite) {
      shipSprite.destroy();
      this.objectSprites.delete(shipObject.id);
    }
    if (this.map[shipObject.y]?.[shipObject.x]) {
      this.map[shipObject.y][shipObject.x].object = undefined;
    }

    // Показываем shipSprite под героем
    this.updateShipSpriteVisibility();

    // Перестраиваем pathfinder для морского режима
    this.rebuildPathfinder();

    this.showNotification('⚓ Герой сел на корабль!');
    return true;
  }

  /**
   * Попытка высадки с корабля на берег
   */
  private tryDisembark(targetX: number, targetY: number): boolean {
    if (!canDisembark(this.hero, targetX, targetY, this.map)) {
      return false;
    }

    this.stopMovement();

    const result = disembark(this.hero, targetX, targetY);
    this.hero = result.hero;

    // Обновляем ссылку в playerHeroes
    const idx = this.playerHeroes.findIndex(h => h.id === this.hero.id);
    if (idx >= 0) this.playerHeroes[idx] = this.hero;

    // Размещаем корабль обратно на карте (на старой позиции героя)
    if (result.shipObject) {
      this.placeObjectSafe(
        result.shipObject.id,
        'boat',
        result.shipObject.x,
        result.shipObject.y,
        result.shipObject.data
      );
    }

    // Обновляем позицию героя и его спрайта
    const TS = CONFIG.TILE_SIZE;
    this.heroSprite.setPosition(targetX * TS, targetY * TS);
    this.updateShipSpriteVisibility();

    // Перестраиваем pathfinder для сухопутного режима
    this.rebuildPathfinder();

    this.showNotification('🏖️ Герой высадился на берег');
    return true;
  }

  /**
   * Использование водоворота (Whirlpool)
   * В каноне HoMM4: 25% шанс потерять слабейший отряд при телепортации
   */
  private useWhirlpool(objId: string, data: any): void {
    if (!data || !data.targetX || !data.targetY) {
      this.showNotification('🌀 Водоворот неактивен');
      return;
    }

    // Защита от мгновенного возврата
    if (this.lastWhirlpoolId === data.pairedId) {
      this.showNotification('🌀 Водоворот ещё не восстановился');
      return;
    }

    this.stopMovement();

    // 25% шанс потерять слабейший отряд (канон HoMM4)
    if (this.hero.army.length > 0 && Math.random() < 0.25) {
      // Находим слабейший отряд (с минимальным count)
      let weakestIdx = 0;
      let weakestCount = this.hero.army[0].count;
      for (let i = 1; i < this.hero.army.length; i++) {
        if (this.hero.army[i].count < weakestCount) {
          weakestCount = this.hero.army[i].count;
          weakestIdx = i;
        }
      }
      const lost = this.hero.army[weakestIdx];
      this.hero.army.splice(weakestIdx, 1);
      this.showNotification(`🌀 Водоворот! Потеряно: ${lost.count}×${lost.creatureId}`);
    } else {
      this.showNotification('🌀 Водоворот: телепортация!');
    }

    // Телепортация
    const TS = CONFIG.TILE_SIZE;
    const targetX = data.targetX;
    const targetY = data.targetY;
    this.heroSprite.setPosition(targetX * TS, targetY * TS);
    if (this.shipSprite) {
      this.shipSprite.setPosition(targetX * TS, targetY * TS);
    }
    (this.hero as any).x = targetX;
    (this.hero as any).y = targetY;

    this.revealAround({ x: targetX, y: targetY }, this.heroManager?.getVisionRadius(this.hero) || 4);
    this.lastWhirlpoolId = objId;

    // Сброс lastWhirlpoolId через 1 секунду
    this.time.delayedCall(1000, () => {
      this.lastWhirlpoolId = undefined;
    });

    // Анимация
    this.camera.shake(300, 0.005);
  }

  /**
   * Обновление видимости shipSprite (синхронизация с heroSprite)
   */
  private updateShipSpriteVisibility(): void {
    const TS = CONFIG.TILE_SIZE;
    const heroPos = this.getHeroPosition();

    if (this.hero?.onShipId) {
      // Герой на корабле — показываем лодку
      if (!this.shipSprite) {
        this.shipSprite = this.add.sprite(
          heroPos.x * TS,
          heroPos.y * TS,
          'boat'
        ).setOrigin(0, 0).setDepth(99); // Под героем (depth 100)
      }
      this.shipSprite.setVisible(true);
      this.shipSprite.setPosition(this.heroSprite.x, this.heroSprite.y);
    } else {
      // Герой на суше — скрываем лодку
      if (this.shipSprite) {
        this.shipSprite.setVisible(false);
      }
    }
  }

  /**
   * Посещение затонувшего корабля (Shipwreck)
   * В каноне HoMM4: бой с призраками, награда — золото/артефакт
   */
  private visitShipwreck(id: string, data: any): void {
    this.stopMovement();
    const pos = this.getHeroPosition();

    // 50% — найти сокровище без боя, 50% — бой с призраками
    if (Math.random() < 0.5) {
      const gold = Phaser.Math.Between(1000, 3000);
      this.resources.gold += gold;
      this.updateResourceDisplay();
      this.showNotification(`🚢 Затонувший корабль: найдено ${gold} золота!`);
      this.removeObject(id, pos);
    } else {
      this.showNotification(`🚢⚔️ Призраки охраняют корабль! Начинается бой!`);
      this.time.delayedCall(300, () => {
        this.scene.sleep();
        this.scene.launch(CONFIG.SCENES.BATTLE, {
          attacker: this.hero,
          defenderId: 'ghosts_shipwreck',
          worldScene: this,
        });
      });
    }
  }

  /**
   * Подбор морского сундука (Sea Chest)
   */
  private collectSeaChest(id: string, data: any): void {
    this.stopMovement();
    const pos = this.getHeroPosition();
    const gold = Phaser.Math.Between(1000, 2500);
    this.resources.gold += gold;
    this.updateResourceDisplay();
    this.showNotification(`📦 Морской сундук: +${gold} золота!`);
    this.removeObject(id, pos);
  }

  /**
   * Подбор плавающего мусора (Flotsam)
   * Может содержать дерево или ничего
   */
  private collectFlotsam(id: string, data: any): void {
    this.stopMovement();
    const pos = this.getHeroPosition();
    const roll = Math.random();
    if (roll < 0.4) {
      const wood = Phaser.Math.Between(2, 5);
      this.resources.wood += wood;
      this.showNotification(`🌊 Мусор: найдено ${wood} дерева!`);
    } else if (roll < 0.6) {
      const gold = Phaser.Math.Between(200, 800);
      this.resources.gold += gold;
      this.showNotification(`🌊 Мусор: найдено ${gold} золота!`);
    } else {
      this.showNotification('🌊 Мусор: ничего ценного');
    }
    this.updateResourceDisplay();
    this.removeObject(id, pos);
  }

  /**
   * Чтение бутылки с посланием
   */
  private readBottle(id: string, data: any): void {
    this.stopMovement();
    const pos = this.getHeroPosition();
    const messages = [
      'В древние времена здесь затонул корабль с сокровищами...',
      'Остерегайтесь водоворотов — они могут унести ваших воинов!',
      'На острове к югу спрятан могучий артефакт...',
      'Морские чудовища обитают в глубоких водах...',
      'Ищите корабль у берегов — он доставит вас куда угодно!',
    ];
    const msg = data?.message || messages[Math.floor(Math.random() * messages.length)];
    this.showNotification(`🍾 Бутылка: "${msg}"`);
    this.removeObject(id, pos);
  }
}
