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
import { WeeksSystem } from '../systems/WeeksSystem';
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
import { AdventureMagicSystem, ADVENTURE_SPELLS } from '../systems/AdventureMagicSystem';
import type { AdventureSpellId } from '../systems/AdventureMagicSystem';
import { AdventureMagicBook } from '../ui/AdventureMagicBook';
import { MagicScrollSystem } from '../systems/MagicScrollSystem';
import type { MagicScroll } from '../systems/MagicScrollSystem';
import { RandomEventsSystem, type RandomEvent } from '../systems/RandomEventsSystem';
import { RandomEventModal } from '../ui/RandomEventModal';
import { ExternalDwellingSystem } from '../systems/ExternalDwellingSystem';
import { DiplomacySystem } from '../systems/DiplomacySystem';
import { DiplomacyUI } from '../ui/DiplomacyUI';
import { DesertionSystem } from '../systems/DesertionSystem';
import { CaptureSystem } from '../systems/CaptureSystem';
import { RazeSystem } from '../systems/RazeSystem';
import { PotionSystem } from '../systems/PotionSystem';

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
  /** Система специальных недель (HoMM4) */
  private weeksSystem!: WeeksSystem;
  /** Система внешних жилищ (канон HoMM4 — еженедельный прирост, банк) */
  private dwellingSystem!: ExternalDwellingSystem;
  /** Система дипломатии с ИИ (канон HoMM4) */
  private diplomacySystem!: DiplomacySystem;
  /** Система дезертирства существ (канон HoMM4) */
  private desertionSystem!: DesertionSystem;
  /** Система захвата героев в плен (канон HoMM4) */
  private captureSystem!: CaptureSystem;
  /** Система разрушения городов (канон HoMM4) */
  private razeSystem!: RazeSystem;
  /** Система зелий (канон HoMM4) */
  private potionSystem!: PotionSystem;
  /** Флаг: игра загружена из сохранения */
  private loadedFromSave: boolean = false;
  
  // === МАГИЯ НА КАРТЕ (канон HoMM4) ===
  /** UI книга заклинаний на карте */
  private adventureMagicBook?: AdventureMagicBook;
  /** Режим выбора цели для заклинания (например, Dimension Door) */
  private spellTargetMode?: AdventureSpellId;
  /** Подсветка клеток для выбора цели заклинания */
  private spellTargetGraphics?: Phaser.GameObjects.Graphics;

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
      
      // Инициализация WeeksSystem (HoMM4 special weeks)
      this.weeksSystem = new WeeksSystem(CONFIG.MAP_SEED);
      this.weeksSystem.initialize(CONFIG.MAP_SEED);
      console.log('[WorldScene] ✓ WeeksSystem initialized');

      // Инициализация RandomEventsSystem (случайные события)
      RandomEventsSystem.init(CONFIG.MAP_SEED);
      console.log('[WorldScene] ✓ RandomEventsSystem initialized');

      // Инициализация ExternalDwellingSystem (внешние жилища, канон HoMM4)
      this.dwellingSystem = new ExternalDwellingSystem();
      console.log('[WorldScene] ✓ ExternalDwellingSystem initialized');

      // Инициализация DiplomacySystem (дипломатия с ИИ, канон HoMM4)
      this.diplomacySystem = new DiplomacySystem();
      console.log('[WorldScene] ✓ DiplomacySystem initialized');

      // Инициализация остальных систем (канон HoMM4)
      this.desertionSystem = new DesertionSystem();
      this.captureSystem = new CaptureSystem();
      this.razeSystem = new RazeSystem();
      this.potionSystem = new PotionSystem();
      console.log('[WorldScene] ✓ DesertionSystem, CaptureSystem, RazeSystem, PotionSystem initialized');
    
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
      
      // === МАГИЯ НА КАРТЕ (канон HoMM4) ===
      this.initAdventureMagic();

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
    // Канонические стоимости HoMM4
    const costs: Record<TileType, number> = {
      grass: 1,      // Трава: 1 (канон)
      sand: 1,       // Песок: 1 (канон, было 1.5)
      water: 999,    // Вода: непроходима
      rock: 999,     // Скала: непроходима
      snow: 2,       // Снег: 2 (канон, было 1.5)
      swamp: 2,      // Болото: 2 (канон)
      lava: 999,     // Лава: непроходима
      forest: 2,     // Лес: 2 (канон, было 1.5)
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
      { creatureId: 'squire', count: 20 },
      { creatureId: 'ballista', count: 10 }
    ];

    // Позиция
    (this.hero as any).x = startX;
    (this.hero as any).y = startY;

    // Начальные заклинания (knight не маг, но можно дать базовое)
    this.hero.spells = ['bless'];
    
    // === МАГИЯ НА КАРТЕ: даём стартовые заклинания для тестирования ===
    // В каноне HoMM4 герой-маг имеет заклинания, рыцарь получает их от зданий
    // Для тестирования даём базовый набор:
    if (!this.hero.spells.includes('townPortal')) this.hero.spells.push('townPortal');
    if (!this.hero.spells.includes('dimensionDoor')) this.hero.spells.push('dimensionDoor');
    if (!this.hero.spells.includes('fly')) this.hero.spells.push('fly');
    if (!this.hero.spells.includes('waterWalk')) this.hero.spells.push('waterWalk');
    if (!this.hero.spells.includes('visions')) this.hero.spells.push('visions');

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

      // Регистрируем внешние жилища в системе
      if (obj.type === 'dwelling' && obj.data?.definitionId) {
        this.dwellingSystem.createDwelling(
          obj.id,
          obj.data.definitionId,
          obj.x,
          obj.y,
          obj.data.owner || 'neutral'
        );
      }
    }
    
    // === МОРСКИЕ ОБЪЕКТЫ (канон HoMM4) ===
    this.generateShips();
    this.generateWhirlpools();
    
    // === МАГИЧЕСКИЕ СВИТКИ (канон HoMM4) ===
    this.generateMagicScrolls();
    
    console.log(`[WorldScene] Размещено ${objects.length} объектов на карте (+ морские + свитки)`);
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

    this.input.keyboard?.on('keydown-ENTER', () => {
      this.endTurn();
      // Сброс дневных эффектов магии при смене дня
      this.resetDailyMagicEffects();
    });
    this.input.keyboard?.on('keydown-H', () => this.showHeroInfo());
    this.input.keyboard?.on('keydown-D', () => this.openDiplomacy());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(CONFIG.SCENES.MENU));
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.switchToNextHero();
    });
    // === U — переключение между поверхностью и подземельем (канон HoMM4) ===
    this.input.keyboard?.on('keydown-U', () => {
      this.switchLevel();
    });
    // === G — улучшить внешнее жилище (канон HoMM4) ===
    this.input.keyboard?.on('keydown-G', () => {
      this.upgradeDwellingAtPosition();
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
      case 'dwelling':
        this.visitDwelling(obj.id, obj.data);
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
      // === МАГИЧЕСКИЕ СВИТКИ (канон HoMM4) ===
      case 'magic_scroll':
        this.collectMagicScroll(obj.id, obj.data);
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
    this.stopMovement();

    // Получаем данные существа из тайла карты
    const pos = this.getHeroPosition();
    const tile = this.map[pos.y]?.[pos.x];
    const mapObj = tile?.object;
    const actualCreatureId = mapObj?.data?.creatureId || creatureId;
    const creatureCount = mapObj?.data?.count || 1;

    // === ПРОВЕРКА ДИПЛОМАТИИ (Diplomacy skill) ===
    if (this.heroManager) {
      const diplomacyResult = this.heroManager.tryDiplomacy(this.hero);
      if (diplomacyResult.success) {
        const joinedCount = Math.min(diplomacyResult.joinedCount, creatureCount);

        // Добавляем в армию героя
        const existing = this.hero.army.find(s => s.creatureId === actualCreatureId);
        if (existing) {
          existing.count += joinedCount;
        } else {
          this.hero.army.push({ creatureId: actualCreatureId, count: joinedCount });
        }

        // Удаляем существо с карты (или уменьшаем количество)
        if (joinedCount >= creatureCount) {
          this.removeObject(creatureId, this.getHeroPosition());
        } else if (mapObj?.data) {
          mapObj.data.count -= joinedCount;
        }

        this.showNotification(`🤝 Дипломатия! ${joinedCount}×${actualCreatureId} присоединились к вам!`);
        return;
      }
    }

    // === ОБЫЧНЫЙ БОЙ ===
    this.showNotification(`⚔️ Бой с ${actualCreatureId} (${creatureCount} шт)!`);
    this.time.delayedCall(300, () => {
      this.scene.sleep();
      this.scene.launch(CONFIG.SCENES.BATTLE, {
        attacker: this.hero,
        defenderId: actualCreatureId,
        defenderCount: creatureCount,
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
    const tile = this.map[pos.y]?.[pos.x];
    const objData = tile?.object?.data;
    
    // Проверяем, является ли ресурс зельем (канон HoMM4)
    if (objData?.type === 'potion' && objData?.potionId) {
      // Добавляем зелье в инвентарь героя
      if (!this.hero.scrolls) this.hero.scrolls = [];
      this.hero.scrolls.push({
        id: objData.potionId,
        name: objData.potionName,
        effect: objData.effect,
        value: objData.value,
        duration: objData.duration,
        usableIn: 'both',
        rarity: 'common'
      });
      this.showNotification(`🧪 Подобрано: ${objData.potionName}!`);
    } else {
      // Обычный ресурс — золото
      const amount = Phaser.Math.Between(500, 2000);
      this.resources.gold += amount;
      this.showNotification(`💰 Получено ${amount} золота!`);
      this.updateResourceDisplay();
    }
    
    this.removeObject(id, pos);
    this.stopMovement();
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

  /**
   * Удалить разрушенный город с карты (канон HoMM4)
   */
  public removeRazedTown(townId: string): void {
    // Ищем объект города на карте
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[y].length; x++) {
        const obj = this.map[y][x].object;
        if (obj && (obj.id === townId || obj.id === `enemy_${townId}`)) {
          this.removeObject(obj.id, { x, y });
          return;
        }
      }
    }
  }

  // === НОВЫЕ МЕТОДЫ ВЗАИМОДЕЙСТВИЯ С ОБЪЕКТАМИ ===

  private visitSchool(id: string, data: any): void {
    // Школы магии HoMM4 (канон)
    const school = data?.school || 'chaos';
    const spellNames: Record<string, string> = {
      life: 'Исцеление', death: 'Проклятие', order: 'Ускорение',
      chaos: 'Огненный шар', natural: 'Полёт', tactics: 'Наступление'
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

  private visitDwelling(id: string, data: any): void {
    const dwelling = this.dwellingSystem.getDwelling(id);
    if (!dwelling) {
      this.showNotification('Жилище не найдено');
      return;
    }

    const dwellingName = dwelling.dwellingName;
    const bankedCreatures = dwelling.bankedCreatures;
    const owner = dwelling.owner;

    // Если жилище нейтральное — захватываем его при первом посещении
    if (owner === 'neutral') {
      this.dwellingSystem.captureDwelling(id, 'player');
      data.owner = 'player';
      this.showNotification(`🏰 ${dwellingName} захвачено! Теперь оно ваше.`);
    }

    // Показываем информацию о жилище
    const creatureName = dwelling.isUpgraded 
      ? (dwelling.upgradedCreatureName || dwelling.creatureName)
      : dwelling.creatureName;
    
    let info = `🏠 ${dwellingName}: ${bankedCreatures}× ${creatureName}`;
    
    // Показываем возможность улучшения (канон HoMM4)
    if (!dwelling.isUpgraded && dwelling.upgradedCreatureId) {
      const canUpgrade = this.dwellingSystem.canUpgradeDwelling(id, this.resources);
      const def = this.dwellingSystem.getDefinition(id);
      const upgradeCost = def?.upgradeCost || {};
      const costStr = Object.entries(upgradeCost).map(([k, v]) => `${k}: ${v}`).join(', ');
      
      if (canUpgrade) {
        info += ` | ⬆️ Улучшить (${costStr}) — нажмите [U]`;
      } else {
        info += ` | 🔒 Улучшение: ${costStr}`;
      }
    }
    
    this.showNotification(info);

    // Нанимаем существ из жилища
    if (bankedCreatures > 0) {
      const result = this.dwellingSystem.hireFromDwelling(this.hero, id, bankedCreatures, this.resources);
      if (result.success) {
        this.showNotification(`✅ ${result.message}`);
      } else {
        this.showNotification(`❌ ${dwellingName}: ${result.message}`);
      }
    } else {
      this.showNotification(`⏳ ${dwellingName}: банк пуст. Прирост через неделю.`);
    }

    this.stopMovement();
  }
  
  private openDiplomacy(): void {
    if (this.isMoving) return;
    const ui = new DiplomacyUI(this, this.diplomacySystem, this.resources);
    ui.show();
  }

  /**
   * Улучшить внешнее жилище на текущей позиции героя (канон HoMM4)
   */
  private upgradeDwellingAtPosition(): void {
    const heroPos = this.getHeroPosition();
    const tile = this.map[heroPos.y]?.[heroPos.x];
    const obj = tile?.object;
    
    if (!obj || obj.type !== 'dwelling') {
      this.showNotification('❌ Здесь нет внешнего жилища');
      return;
    }

    const dwelling = this.dwellingSystem.getDwelling(obj.id);
    if (!dwelling) {
      this.showNotification('❌ Жилище не найдено');
      return;
    }

    if (dwelling.isUpgraded) {
      this.showNotification('❌ Жилище уже улучшено');
      return;
    }

    if (!dwelling.upgradedCreatureId) {
      this.showNotification('❌ Это жилище нельзя улучшить');
      return;
    }

    const canUpgrade = this.dwellingSystem.canUpgradeDwelling(obj.id, this.resources);
    if (!canUpgrade) {
      const def = this.dwellingSystem.getDefinition(obj.id);
      const cost = def?.upgradeCost || {};
      const costStr = Object.entries(cost).map(([k, v]) => `${k}: ${v}`).join(', ');
      this.showNotification(`❌ Недостаточно ресурсов для улучшения (${costStr})`);
      return;
    }

    const result = this.dwellingSystem.upgradeDwelling(obj.id, this.resources);
    if (result.success) {
      this.showNotification(`⬆️ ${result.message}`);
      this.updateResourceDisplay();
    } else {
      this.showNotification(`❌ ${result.message}`);
    }
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
    // Добавляем бонус к очкам движения героя
    this.hero.movementPoints = Math.min(
      this.hero.maxMovementPoints,
      this.hero.movementPoints + bonus
    );
    this.showNotification(`🌴 Оазис: +${bonus} очков движения!`);
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private claimWindmill(id: string, data: any): void {
    const goldPerWeek = data?.goldPerWeek || 500;
    // Добавляем золото сразу (упрощённая модель - в каноне даёт раз в неделю)
    this.resources.gold += goldPerWeek;
    this.showNotification(`🌾 Ветряная мельница: +${goldPerWeek} золота!`);
    this.updateResourceDisplay();
    this.removeObject(id, { x: Math.floor(this.heroSprite.x / CONFIG.TILE_SIZE), y: Math.floor(this.heroSprite.y / CONFIG.TILE_SIZE) });
    this.stopMovement();
  }

  private claimWaterWheel(id: string, data: any): void {
    const goldPerWeek = data?.goldPerWeek || 750;
    // Добавляем золото сразу (упрощённая модель - в каноне даёт раз в неделю)
    this.resources.gold += goldPerWeek;
    this.showNotification(`💧 Водяное колесо: +${goldPerWeek} золота!`);
    this.updateResourceDisplay();
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
    // Интеграция с WeeksSystem: переход к следующему дню
    const weekChanged = this.weeksSystem.nextDay();
    
    this.day = this.weeksSystem.getState().currentDay;
    this.week = this.weeksSystem.getState().currentWeek;
    
    // Отображение новой недели
    if (weekChanged) {
      const specialWeek = this.weeksSystem.getState().specialWeek;
      this.showNotification(`📅 Новая неделя!\n${specialWeek.name}\n${specialWeek.description}`);
      
      // Применяем еженедельный прирост существ с учётом эффектов недели
      this.applyWeeklyGrowth();

      // Случайные события (канон HoMM4: 30% шанс каждую неделю)
      const event = RandomEventsSystem.tryGenerateEvent();
      if (event) {
        new RandomEventModal(this, event, () => {
          // После закрытия модалки — применяем эффекты
          this.applyRandomEventEffects(event);
        });
      }
    }

    // Обновление длительности активного события (каждый день)
    RandomEventsSystem.updateDaily();
    
    // === ДОХОД С ШАХТ (разные типы) ===
    const mineIncome = this.victorySystem.getDailyIncome();
    if (Object.keys(mineIncome).length > 0) {
      this.addResources(mineIncome);
      const incomeStr = Object.entries(mineIncome)
        .map(([res, val]) => {
          const icons: Record<string, string> = { gold: '💰', wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🔵' };
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
    
    // Применяем модификатор от специальной недели (gold_abundance)
    if (this.weeksSystem && townIncomeTotal > 0) {
      const goldBonusPercent = this.weeksSystem.getGoldIncomeBonusPercent();
      if (goldBonusPercent > 0) {
        const bonus = Math.floor(townIncomeTotal * goldBonusPercent / 100);
        townIncomeTotal += bonus;
      }
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
    
    // Обновить дипломатию (истечение перемирий)
    if (this.diplomacySystem) {
      this.diplomacySystem.updateTurn(this.day);
    }

    // Проверка дезертирства (канон HoMM4)
    if (this.desertionSystem) {
      const warning = this.desertionSystem.getDesertionWarning(this.hero);
      if (warning) {
        this.showNotification(warning);
      }

      const desertion = this.desertionSystem.checkDesertion(this.hero);
      if (desertion.deserted) {
        this.showNotification(desertion.message);
      }
    }

    // Попытка побега пленных (канон HoMM4)
    if (this.captureSystem) {
      const escapes = this.captureSystem.tryEscape(this.day);
      for (const escape of escapes) {
        this.showNotification(escape.message);
      }
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
   * - Цитадель (Citadel): +50% прирост (канон HoMM4)
   * - Замок (Castle): +100% прирост (канон HoMM4)
   * - Улучшенное жилище: +50% прирост
   */
  private applyWeeklyGrowth(): void {
    const playerTowns = this.victorySystem.getPlayerTowns();
    
    for (const town of playerTowns) {
      const hasCitadel = town.builtBuildings.includes('citadel');
      const hasCastle = town.builtBuildings.includes('castle');
      
      const growthDetails: string[] = [];
      
      // Рассчитываем прирост для каждого существа в городе
      for (const hireSlot of town.availableForHire) {
        const creatureId = hireSlot.creatureId;
        
        // Проверяем построено ли улучшенное жилище
        // Апгрейд увеличивает прирост на +50%
        const isUpgraded = false;
        
        // Используем центральную функцию из EconomySystem
        let growth = calculateWeeklyGrowth(creatureId, hasCitadel, hasCastle, isUpgraded);
        
        // Применяем модификатор от специальной недели (если есть)
        if (this.weeksSystem) {
          const weekMultiplier = this.weeksSystem.getCreatureGrowthMultiplier(creatureId);
          growth = Math.floor(growth * weekMultiplier);
        }

        // Применяем модификатор от случайного события (чума/двойной прирост)
        const eventGrowthMultiplier = RandomEventsSystem.getGrowthMultiplier();
        growth = Math.floor(growth * eventGrowthMultiplier);
        
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

    // === ЕЖЕНЕДЕЛЬНЫЙ ПРИРОСТ ВНЕШНИХ ЖИЛИЩ (канон HoMM4) ===
    if (this.dwellingSystem) {
      const weekMultiplier = this.weeksSystem?.getCreatureGrowthMultiplier('any') || 1.0;
      const eventMultiplier = RandomEventsSystem.getGrowthMultiplier();
      const totalMultiplier = weekMultiplier * eventMultiplier;

      const dwellingGrowth = this.dwellingSystem.applyWeeklyGrowth('player', this.day, totalMultiplier);
      for (const growth of dwellingGrowth) {
        const info = this.dwellingSystem.getDwelling(growth.dwellingId);
        const name = info?.dwellingName || growth.dwellingId;
        this.showNotification(`📈 ${name}: +${growth.growth}×${growth.creatureId} (банк: ${growth.newBankTotal})`);
      }
    }
  }

  /**
   * Применить эффекты случайного события к игровому состоянию
   */
  private applyRandomEventEffects(event: RandomEvent): void {
    // Ресурсные эффекты (мгновенные)
    this.resources = RandomEventsSystem.applyResourceEffect(this.resources) as typeof this.resources;
    this.updateResourceDisplay();

    // Эффекты к герою
    RandomEventsSystem.applyManaEffect(this.hero);
    RandomEventsSystem.applyLuckBonus(this.hero);
    RandomEventsSystem.applyMoraleBonus(this.hero);

    // Эффекты к другим героям
    for (const otherHero of this.playerHeroes) {
      RandomEventsSystem.applyManaEffect(otherHero);
      RandomEventsSystem.applyLuckBonus(otherHero);
      RandomEventsSystem.applyMoraleBonus(otherHero);
    }

    // Уведомление
    const prefix = event.positive ? '✅' : '❌';
    this.showNotification(`${prefix} ${event.name}: ${event.description}`);
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
    // Передаём текущее золото в VictorySystem для проверки условий
    this.victorySystem.setGold(this.resources.gold);
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
      captured: false,
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
            builtBuildings: ['citadel', 'necropolis_dwelling_1'],
            garrison: [
              { creatureId: 'skeleton_h4', count: 30 },
              { creatureId: 'imp_h4', count: 20 }
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
        captured: false,
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
      getDiplomacySystem: () => this.diplomacySystem,
      getDwellingSystem: () => this.dwellingSystem,
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
        stats: { attack: 2, defense: 2, spellPower: isNecro ? 3 : 1, knowledge: isNecro ? 3 : 1, hp: 20, maxHp: 20 },
        skills: [],
        mana: 20,
        maxMana: 20,
        army: isNecro
          ? [
              { creatureId: 'skeleton_h4', count: 40 },
              { creatureId: 'imp_h4', count: 25 }
            ]
          : [
              { creatureId: 'squire', count: 30 },
              { creatureId: 'ballista', count: 15 }
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

    // Инициализируем дипломатию с ИИ (канон HoMM4)
    for (const aiPlayer of this.aiSystem.getAIPlayers()) {
      this.diplomacySystem.initRelation(aiPlayer.id, aiPlayer.hero?.name || aiPlayer.name);
    }

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

  // ============================================================
  // === 📜 МАГИЧЕСКИЕ СВИТКИ (канон HoMM4) ===
  // ============================================================

  /**
   * Генерация магических свитков на карте
   * Размещает 5-8 свитков на проходимых клетках
   */
  private generateMagicScrolls(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const scrollCount = 6;
    let placed = 0;
    let attempts = 0;

    while (placed < scrollCount && attempts < 300) {
      attempts++;
      const x = Phaser.Math.Between(3, mapW - 4);
      const y = Phaser.Math.Between(3, mapH - 4);
      const tile = this.map[y]?.[x];

      // Свиток должен быть на проходимой клетке
      if (!tile || !tile.passable) continue;
      if (tile.object) continue;
      if (tile.type === 'water' || tile.type === 'rock' || tile.type === 'lava') continue;

      // Генерируем свиток через MagicScrollSystem
      const scroll = MagicScrollSystem.generateRandomScroll(1, 5);

      // Размещаем на карте
      const scrollId = `magic_scroll_${placed}`;
      this.placeObjectSafe(scrollId, 'magic_scroll', x, y, {
        scroll: scroll
      });
      placed++;
    }

    console.log(`[WorldScene] 📜 Размещено ${placed} магических свитков`);
  }

  /**
   * Подбор магического свитка
   */
  private collectMagicScroll(id: string, data: any): void {
    this.stopMovement();
    const pos = this.getHeroPosition();

    if (!data?.scroll) {
      this.showNotification('📜 Свиток пуст!');
      this.removeObject(id, pos);
      return;
    }

    const scroll: MagicScroll = data.scroll;
    
    // Добавляем свиток герою
    MagicScrollSystem.addScrollToHero(this.hero, scroll);

    // Красивое уведомление
    const schoolEmoji = MagicScrollSystem.getSchoolEmoji(scroll.school);
    const rarityColor = MagicScrollSystem.getRarityColor(scroll.rarity);
    const rarityName = MagicScrollSystem.getRarityName(scroll.rarity);
    
    this.showNotification(
      `📜 Найден свиток: ${schoolEmoji} ${scroll.spellName} (${rarityName}, ур.${scroll.level})\n` +
      `${scroll.description}`
    );

    console.log(`[WorldScene] 📜 Scroll collected: ${scroll.spellName} (${scroll.school}, lvl ${scroll.level})`);

    // Удаляем свиток с карты
    this.removeObject(id, pos);
  }
  
  // ============================================================
  // === МАГИЯ НА КАРТЕ (Adventure Magic - канон HoMM4) ===
  // ============================================================
  
  /**
   * Инициализация системы магии на карте:
   * - Создаёт UI книгу заклинаний
   * - Добавляет горячую клавишу M
   */
  private initAdventureMagic(): void {
    // Создаём книгу заклинаний
    this.adventureMagicBook = new AdventureMagicBook(
      this,
      this.hero,
      (spellId) => this.onSpellSelected(spellId)
    );
    
    // Горячая клавиша M - открыть книгу заклинаний
    this.input.keyboard?.on('keydown-M', () => {
      if (this.isMoving) return;
      this.adventureMagicBook?.toggle();
    });
    
    // ESC - отмена режима выбора цели
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.spellTargetMode) {
        this.cancelSpellTargetMode();
      }
    });
    
    console.log('[WorldScene] ✓ Adventure magic initialized (8 spells, key M)');
  }
  
  /**
   * Обработчик выбора заклинания из книги
   */
  private onSpellSelected(spellId: AdventureSpellId): void {
    const check = AdventureMagicSystem.canCastSpell(this.hero, spellId);
    if (!check.canCast) {
      this.showNotification(`❌ ${check.reason}`);
      return;
    }
    
    const spell = ADVENTURE_SPELLS[spellId];
    
    switch (spell.targetType) {
      case 'self':
        // Заклинания на себя - применяются сразу
        this.castSelfSpell(spellId);
        break;
      case 'town':
        // Town Portal - сразу в ближайший город
        this.castTownPortal();
        break;
      case 'tile':
        // Dimension Door - режим выбора клетки
        this.enterSpellTargetMode(spellId);
        break;
      case 'boat':
        // Summon Boat / Scuttle Boat
        this.castBoatSpell(spellId);
        break;
      case 'hero':
        // Identify Hero - нужно найти вражеского героя рядом
        this.castIdentifyHero();
        break;
    }
  }
  
  /**
   * Применение заклинаний на себя (Fly, Water Walk, Visions)
   */
  private castSelfSpell(spellId: AdventureSpellId): void {
    let result;
    
    switch (spellId) {
      case 'fly':
        result = AdventureMagicSystem.castFly(this.hero);
        break;
      case 'waterWalk':
        result = AdventureMagicSystem.castWaterWalk(this.hero);
        break;
      case 'visions':
        result = this.castVisionsImpl();
        break;
      default:
        return;
    }
    
    if (result.success) {
      this.showNotification(`✨ ${result.message}`);
      this.createMagicEffect(this.hero.x, this.hero.y);
      
      // Обновляем pathfinder для Fly/Water Walk
      if (spellId === 'fly' || spellId === 'waterWalk') {
        this.rebuildPathfinder();
      }
    } else {
      this.showNotification(`❌ ${result.message}`);
    }
  }
  
  /**
   * Реализация Visions (Видения) - показывает ближайших врагов
   */
  private castVisionsImpl(): any {
    // Собираем всех вражеских существ и героев в радиусе 10 клеток
    const nearbyEnemies: MapObject[] = [];
    const radius = 10;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = this.hero.x + dx;
        const ny = this.hero.y + dy;
        if (nx >= 0 && nx < this.map[0].length && ny >= 0 && ny < this.map.length) {
          const obj = this.map[ny][nx].object;
          if (obj && obj.type === 'creature') {
            nearbyEnemies.push(obj);
          }
        }
      }
    }
    
    const result = AdventureMagicSystem.castVisions(this.hero, nearbyEnemies);
    
    if (result.success && result.data?.enemies) {
      // Показываем информацию о каждом враге
      const enemies = result.data.enemies;
      let msg = `👁️ Обнаружено ${enemies.length} врагов:\n`;
      enemies.slice(0, 5).forEach((e: any) => {
        msg += `  • ${e.name} (${e.count} шт.) на (${e.position.x}, ${e.position.y})\n`;
      });
      if (enemies.length > 5) {
        msg += `  ...и ещё ${enemies.length - 5}`;
      }
      this.showNotification(msg);
    }
    
    return result;
  }
  
  /**
   * Применение Town Portal (телепорт в ближайший свой город)
   */
  private castTownPortal(): void {
    // Собираем свои города
    const playerTowns: Array<{ id: string; name: string; x: number; y: number }> = [];
    
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const obj = this.map[y][x].object;
        if (obj && obj.type === 'town' && obj.owner === 'player') {
          playerTowns.push({
            id: obj.id,
            name: (obj.data?.name as string) || 'Город',
            x,
            y
          });
        }
      }
    }
    
    const result = AdventureMagicSystem.castTownPortal(this.hero, playerTowns, this.map);
    
    if (result.success && result.data) {
      this.showNotification(result.message);
      this.createTeleportEffect(this.hero.x, this.hero.y);
      
      // Телепортируем героя
      this.tweens.add({
        targets: this.heroSprite,
        alpha: 0,
        duration: 300,
        onComplete: () => {
          this.hero.x = result.data.x;
          this.hero.y = result.data.y;
          this.heroSprite.setPosition(result.data.x * CONFIG.TILE_SIZE, result.data.y * CONFIG.TILE_SIZE);
          this.camera.scrollX = this.heroSprite.x - this.camera.width / 2;
          this.camera.scrollY = this.heroSprite.y - this.camera.height / 2;
          
          this.tweens.add({
            targets: this.heroSprite,
            alpha: 1,
            duration: 300
          });
          
          this.createTeleportEffect(result.data.x, result.data.y);
          this.refreshMapVisibility();
        }
      });
    } else {
      this.showNotification(`❌ ${result.message}`);
    }
  }
  
  /**
   * Войти в режим выбора цели для заклинания (Dimension Door)
   */
  private enterSpellTargetMode(spellId: AdventureSpellId): void {
    this.spellTargetMode = spellId;
    
    // Создаём графику для подсветки
    this.spellTargetGraphics = this.add.graphics();
    this.spellTargetGraphics.setDepth(500);
    
    // Показываем подсказку
    const spell = ADVENTURE_SPELLS[spellId];
    this.showNotification(`🎯 ${spell.name}: выберите цель (ESC - отмена)`);
    
    // Подсвечиваем доступные клетки
    this.highlightSpellTargets(spellId);
    
    // Временно переопределяем клик по карте
    this.input.on('gameobjectdown', this.onSpellTargetClick, this);
  }
  
  /**
   * Подсветка доступных клеток для Dimension Door
   */
  private highlightSpellTargets(spellId: AdventureSpellId): void {
    if (!this.spellTargetGraphics) return;
    this.spellTargetGraphics.clear();
    
    if (spellId === 'dimensionDoor') {
      const TS = CONFIG.TILE_SIZE;
      const range = 3; // DIMENSION_DOOR_RANGE
      
      for (let dy = -range; dy <= range; dy++) {
        for (let dx = -range; dx <= range; dx++) {
          if (dx === 0 && dy === 0) continue;
          
          const nx = this.hero.x + dx;
          const ny = this.hero.y + dy;
          
          if (nx >= 0 && nx < this.map[0].length && ny >= 0 && ny < this.map.length) {
            const tile = this.map[ny][nx];
            if (tile.type !== 'water' && tile.type !== 'rock' && tile.type !== 'lava' && tile.type !== 'cave_rock' && !tile.object) {
              // Доступная клетка
              this.spellTargetGraphics.fillStyle(0x00ff00, 0.3);
              this.spellTargetGraphics.fillRect(nx * TS, ny * TS, TS, TS);
              this.spellTargetGraphics.lineStyle(2, 0x00ff00, 0.8);
              this.spellTargetGraphics.strokeRect(nx * TS, ny * TS, TS, TS);
            }
          }
        }
      }
    }
  }
  
  /**
   * Клик по клетке в режиме выбора цели заклинания
   */
  private onSpellTargetClick = (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject): void => {
    if (!this.spellTargetMode) return;
    
    // Получаем координаты клика в мире
    const worldX = pointer.worldX;
    const worldY = pointer.worldY;
    const tileX = Math.floor(worldX / CONFIG.TILE_SIZE);
    const tileY = Math.floor(worldY / CONFIG.TILE_SIZE);
    
    if (tileX < 0 || tileX >= this.map[0].length || tileY < 0 || tileY >= this.map.length) return;
    
    // Применяем заклинание
    if (this.spellTargetMode === 'dimensionDoor') {
      this.castDimensionDoor(tileX, tileY);
    }
    
    this.cancelSpellTargetMode();
  };
  
  /**
   * Применение Dimension Door
   */
  private castDimensionDoor(targetX: number, targetY: number): void {
    const result = AdventureMagicSystem.castDimensionDoor(this.hero, targetX, targetY, this.map);
    
    if (result.success && result.data) {
      this.showNotification(result.message);
      this.createTeleportEffect(this.hero.x, this.hero.y);
      
      // Телепортация героя
      this.tweens.add({
        targets: this.heroSprite,
        alpha: 0,
        scale: 0.5,
        duration: 250,
        onComplete: () => {
          this.hero.x = targetX;
          this.hero.y = targetY;
          this.heroSprite.setPosition(targetX * CONFIG.TILE_SIZE, targetY * CONFIG.TILE_SIZE);
          this.heroSprite.setScale(1);
          this.camera.scrollX = this.heroSprite.x - this.camera.width / 2;
          this.camera.scrollY = this.heroSprite.y - this.camera.height / 2;
          
          this.tweens.add({
            targets: this.heroSprite,
            alpha: 1,
            duration: 250
          });
          
          this.createTeleportEffect(targetX, targetY);
          this.refreshMapVisibility();
        }
      });
    } else {
      this.showNotification(`❌ ${result.message}`);
    }
  }
  
  /**
   * Отмена режима выбора цели
   */
  private cancelSpellTargetMode(): void {
    this.spellTargetMode = undefined;
    
    if (this.spellTargetGraphics) {
      this.spellTargetGraphics.destroy();
      this.spellTargetGraphics = undefined;
    }
    
    this.input.off('gameobjectdown', this.onSpellTargetClick, this);
  }
  
  /**
   * Применение заклинаний на корабли (Summon Boat, Scuttle Boat)
   */
  private castBoatSpell(spellId: AdventureSpellId): void {
    // Собираем все корабли на карте
    const ships: MapObject[] = [];
    for (let y = 0; y < this.map.length; y++) {
      for (let x = 0; x < this.map[0].length; x++) {
        const obj = this.map[y][x].object;
        if (obj && obj.type === 'boat') {
          ships.push(obj);
        }
      }
    }
    
    if (spellId === 'summonBoat') {
      const result = AdventureMagicSystem.castSummonBoat(this.hero, ships, this.map);
      
      if (result.success && result.data) {
        this.showNotification(result.message);
        this.createMagicEffect(this.hero.x, this.hero.y);
        
        // Перемещаем спрайт корабля
        const shipSprite = this.objectSprites.get(result.data.shipId);
        if (shipSprite) {
          this.tweens.add({
            targets: shipSprite,
            x: result.data.toX * CONFIG.TILE_SIZE,
            y: result.data.toY * CONFIG.TILE_SIZE,
            duration: 800,
            ease: 'Sine.easeInOut'
          });
        }
        
        // Обновляем объект на карте
        const oldX = result.data.fromX;
        const oldY = result.data.fromY;
        const shipObj = this.map[oldY][oldX].object;
        if (shipObj) {
          this.map[oldY][oldX].object = undefined;
          this.map[result.data.toY][result.data.toX].object = {
            ...shipObj,
            x: result.data.toX,
            y: result.data.toY
          };
        }
      } else {
        this.showNotification(`❌ ${result.message}`);
      }
    } else if (spellId === 'scuttleBoat') {
      // Находим ближайший чужой корабль
      const enemyShips = ships.filter(s => s.owner !== this.hero.owner);
      if (enemyShips.length === 0) {
        this.showNotification('❌ Нет чужих кораблей');
        return;
      }
      
      // Берём ближайший
      let nearest = enemyShips[0];
      let minDist = Infinity;
      for (const ship of enemyShips) {
        const dist = Math.abs(this.hero.x - ship.x) + Math.abs(this.hero.y - ship.y);
        if (dist < minDist) {
          minDist = dist;
          nearest = ship;
        }
      }
      
      const result = AdventureMagicSystem.castScuttleBoat(this.hero, nearest);
      
      if (result.success && result.data) {
        this.showNotification(result.message);
        
        // Уничтожаем корабль с анимацией
        const shipSprite = this.objectSprites.get(result.data.shipId);
        if (shipSprite) {
          this.tweens.add({
            targets: shipSprite,
            alpha: 0,
            scale: 0.3,
            angle: 180,
            duration: 600,
            onComplete: () => shipSprite.destroy()
          });
        }
        
        this.objectSprites.delete(result.data.shipId);
        this.map[nearest.y][nearest.x].object = undefined;
      } else {
        this.showNotification(`❌ ${result.message}`);
      }
    }
  }
  
  /**
   * Применение Identify Hero (опознание вражеского героя)
   */
  private castIdentifyHero(): void {
    // Находим ближайшего вражеского героя в радиусе 5
    const radius = 5;
    let nearestEnemyHero: Hero | null = null;
    let minDist = Infinity;
    
    // Проверяем ИИ героев (через публичные данные)
    if (this.aiSystem && (this.aiSystem as any).players) {
      const players = (this.aiSystem as any).players;
      if (Array.isArray(players)) {
        for (const player of players) {
          if (player.heroes && Array.isArray(player.heroes)) {
            for (const aiHero of player.heroes) {
              const dist = Math.abs(this.hero.x - aiHero.x) + Math.abs(this.hero.y - aiHero.y);
              if (dist < minDist && dist <= radius) {
                minDist = dist;
                nearestEnemyHero = aiHero;
              }
            }
          }
        }
      }
    }
    
    if (!nearestEnemyHero) {
      this.showNotification('❌ Нет вражеских героев в радиусе');
      return;
    }
    
    const result = AdventureMagicSystem.castIdentifyHero(this.hero, nearestEnemyHero);
    
    if (result.success && result.data?.heroInfo) {
      const info = result.data.heroInfo;
      let msg = `🔍 ${info.name} (ур. ${info.level})\n`;
      msg += `⚔️ АТК: ${info.stats.attack} | 🛡️ ЗАЩ: ${info.stats.defense}\n`;
      msg += `✨ СП: ${info.stats.spellPower} | 📚 ЗН: ${info.stats.knowledge}\n`;
      msg += `👥 Армия:\n`;
      info.army.forEach((slot: any) => {
        msg += `  • ${slot.creature}: ${slot.count}\n`;
      });
      this.showNotification(msg);
    } else {
      this.showNotification(`❌ ${result.message}`);
    }
  }
  
  /**
   * Сброс дневных эффектов магии (Fly, Water Walk)
   * Вызывается в конце дня
   */
  private resetAdventureMagicDailyEffects(): void {
    const hadFly = AdventureMagicSystem.isFlying(this.hero);
    const hadWaterWalk = AdventureMagicSystem.isWaterWalking(this.hero);
    
    AdventureMagicSystem.resetDailyEffects(this.hero);
    
    if (hadFly || hadWaterWalk) {
      this.rebuildPathfinder();
      this.showNotification('🌅 Новый день: эффекты заклинаний сброшены');
    }
  }
  
  /**
   * Создание эффекта магической вспышки на клетке
   */
  private createMagicEffect(tileX: number, tileY: number): void {
    const TS = CONFIG.TILE_SIZE;
    const x = tileX * TS + TS / 2;
    const y = tileY * TS + TS / 2;
    
    const graphics = this.add.graphics();
    graphics.setDepth(600);
    graphics.setPosition(x, y);
    
    let radius = 5;
    
    const tween = this.tweens.addCounter({
      from: 5,
      to: TS,
      duration: 500,
      ease: 'Quad.easeOut',
      onUpdate: (tween) => {
        graphics.clear();
        const r = tween.getValue();
        const alpha = 1 - (r / TS);
        graphics.lineStyle(3, 0x9966ff, alpha);
        graphics.strokeCircle(0, 0, r);
        graphics.fillStyle(0xffd700, alpha * 0.5);
        graphics.fillCircle(0, 0, r * 0.3);
      },
      onComplete: () => {
        graphics.destroy();
      }
    });
  }
  
  /**
   * Создание эффекта телепортации (две вспышки)
   */
  private createTeleportEffect(tileX: number, tileY: number): void {
    const TS = CONFIG.TILE_SIZE;
    const x = tileX * TS + TS / 2;
    const y = tileY * TS + TS / 2;
    
    // Вращающиеся частицы
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.circle(x, y, 3, 0x00ffff);
      particle.setDepth(600);
      
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * TS,
        y: y + Math.sin(angle) * TS,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Quad.easeOut',
        onComplete: () => particle.destroy()
      });
    }
    
    // Центральная вспышка
    const flash = this.add.circle(x, y, 5, 0xffffff, 0.8);
    flash.setDepth(600);
    this.tweens.add({
      targets: flash,
      scale: 4,
      alpha: 0,
      duration: 400,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    });
  }
  
  /**
   * Публичный метод для сброса дневных эффектов магии.
   * Вызывается при смене дня (из endTurn / nextDay).
   */
  public resetDailyMagicEffects(): void {
    this.resetAdventureMagicDailyEffects();
    
    // Сброс для всех героев игрока
    for (const hero of this.playerHeroes) {
      AdventureMagicSystem.resetDailyEffects(hero);
    }
  }
}
