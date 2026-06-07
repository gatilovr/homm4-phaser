import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Tile, TileType, Position, Hero } from '../types';
import { NoiseGenerator } from '../utils/NoiseGenerator';
import { Pathfinder } from '../utils/Pathfinder';
import { EventBus } from '../utils/EventBus';
import { VictorySystem, OwnerType } from '../systems/VictorySystem';
import { AISystem, AIPlayer } from '../systems/AISystem';

export class WorldScene extends Phaser.Scene {
  public map: Tile[][] = [];
  private tileSprites: Phaser.GameObjects.Sprite[][] = [];
  private objectSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private heroSprite!: Phaser.GameObjects.Sprite;
  private hero!: Hero;
  private currentPath: Position[] = [];
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private pathfinder!: Pathfinder;
  public camera!: Phaser.Cameras.Scene2D.Camera;
  private resourceDisplay: Phaser.GameObjects.Text[] = [];
  private isMoving: boolean = false;
  
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

  constructor() {
    super({ key: CONFIG.SCENES.WORLD });
  }

  create(): void {
    console.log('[WorldScene] === CREATE STARTED ===');
    
    // Сразу рисуем отладочный текст чтобы видеть что сцена запустилась
    const debugText = this.add.text(10, 10, '🗺️ WorldScene загружена!', {
      fontSize: '20px',
      color: '#00ff00',
      fontFamily: 'Segoe UI',
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    }).setScrollFactor(0).setDepth(999);

    try {
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

      // Pathfinder
      this.pathfinder = new Pathfinder(this.map);
      this.pathGraphics = this.add.graphics();

      // Запуск UIScene (мини-карта и управление)
      this.scene.launch(CONFIG.SCENES.UI, { worldScene: this });

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
    console.log(`[WorldScene] Generating map ${MAP_W}×${MAP_H} (seed: ${CONFIG.MAP_SEED})`);
    
    for (let y = 0; y < MAP_H; y++) {
      this.map[y] = [];
      for (let x = 0; x < MAP_W; x++) {
        const value = noise.normalizedNoise(x * 0.1, y * 0.1);
        const type = this.getTileType(value);
        
        this.map[y][x] = {
          x,
          y,
          type,
          passable: this.isPassableType(type),
          moveCost: this.getMoveCost(type),
          revealed: false
        };
      }
    }
    
    // Раскрываем область вокруг центра
    const cx = Math.floor(MAP_W / 2);
    const cy = Math.floor(MAP_H / 2);
    this.revealAround({ x: cx, y: cy }, 5);
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
    return !['water', 'rock', 'lava'].includes(type);
  }

  private getMoveCost(type: TileType): number {
    const costs: Record<TileType, number> = {
      grass: 1, sand: 1.5, water: 999, rock: 999,
      snow: 1.5, swamp: 2, lava: 999, forest: 1.5
    };
    return costs[type] || 1;
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
    
    this.hero = {
      id: 'hero_1',
      name: 'Сэр Гэвин',
      class: 'Рыцарь',
      faction: 'haven',
      level: 1,
      experience: 0,
      stats: { attack: 2, defense: 2, spellPower: 1, knowledge: 1, morale: 1, luck: 0 },
      skills: [],
      mana: 10,
      maxMana: 10,
      army: [
        { creatureId: 'pikeman', count: 20 },
        { creatureId: 'archer', count: 10 }
      ],
      equipment: {},
      spells: []
    };
    
    this.heroSprite = this.add.sprite(
      startX * TS,
      startY * TS,
      'hero'
    ).setOrigin(0, 0).setDepth(100);
    
    this.playerHeroes = [this.hero];
    this.playerHeroSprites.set(this.hero.id, this.heroSprite);
    this.currentHeroIndex = 0;
    
    console.log(`[WorldScene] Hero placed at ${startX},${startY}`);
  }

  private placeObjects(): void {
    const mapW = this.map[0].length;
    const mapH = this.map.length;
    const cx = Math.floor(mapW / 2);
    const cy = Math.floor(mapH / 2);
    
    this.placeObjectSafe('town_1', 'town', cx + 3, cy);
    this.placeObjectSafe('enemy_town_1', 'enemy_town', 5, 5);
    this.placeObjectSafe('mine_1', 'mine', 10, 10);
    this.placeObjectSafe('mine_2', 'mine', 30, 30);
    this.placeObjectSafe('artifact_1', 'artifact', 15, 20);
    this.placeObjectSafe('artifact_2', 'artifact', 25, 30);
    this.placeObjectSafe('creature_1', 'creature', 20, 15);
    this.placeObjectSafe('creature_2', 'creature', 28, 25);
    this.placeObjectSafe('resource_1', 'resource', 8, 25);
    this.placeObjectSafe('portal_1', 'portal', 3, 3);
    this.placeObjectSafe('portal_2', 'portal', 35, 35);
  }

  private placeObjectSafe(id: string, type: string, x: number, y: number): void {
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
    this.map[y][x].object = { id, type: type as any, x, y };
    
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
      if (tileX >= 0 && tileX < mapW && tileY >= 0 && tileY < mapH) {
        this.moveHeroTo({ x: tileX, y: tileY });
      }
    });

    this.input.keyboard?.on('keydown-ENTER', () => this.endTurn());
    this.input.keyboard?.on('keydown-H', () => this.showHeroInfo());
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start(CONFIG.SCENES.MENU));
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      this.switchToNextHero();
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
    this.revealAround(pos, 4);
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
    }
  }

  private enterTown(townId: string): void {
    console.log('[WorldScene] Entering town:', townId);
    this.showNotification('🏰 Вход в город...');
    this.stopMovement();
    
    // Получаем данные о городе
    const townData = this.victorySystem?.getTown(townId);
    
    this.time.delayedCall(300, () => {
      this.scene.sleep();
      this.scene.launch(CONFIG.SCENES.TOWN, { 
        townId, 
        worldScene: this,
        townData // передаём данные о городе
      });
    });
  }

  private startBattle(creatureId: string): void {
    console.log('[WorldScene] Starting battle:', creatureId);
    this.showNotification('⚔️ Бой начинается!');
    this.stopMovement(); // Останавливаем движение
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
        this.showNotification('⛏️ Шахта захвачена! +500 золота/день');
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

  private stopMovement(): void {
    this.currentPath = [];
    this.isMoving = false;
    this.pathGraphics.clear();
    this.tweens.killTweensOf(this.heroSprite);
  }

  private showTileInfo(x: number, y: number): void {
    const mapW = this.map[0]?.length || 0;
    const mapH = this.map.length;
    if (x < 0 || x >= mapW || y < 0 || y >= mapH) return;
    
    const tile = this.map[y][x];
    const names: Record<TileType, string> = {
      grass: 'Трава', sand: 'Песок', water: 'Вода', rock: 'Скалы',
      snow: 'Снег', swamp: 'Болото', lava: 'Лава', forest: 'Лес'
    };
    
    let info = `${names[tile.type]} (${x},${y}) | Цена: ${tile.moveCost}`;
    if (tile.object) info += ` | Объект: ${tile.object.type}`;
    
    this.showNotification(info);
  }

  private showHeroInfo(): void {
    const army = this.hero.army.map(s => `${s.creatureId}: ${s.count}`).join(', ');
    this.showNotification(`🦸 ${this.hero.name} | Ур.${this.hero.level} | АТК:${this.hero.stats.attack} ЗАЩ:${this.hero.stats.defense} | ${army}`);
  }

  public endTurn(): void {
    this.day++;
    if (this.day > 7) {
      this.day = 1;
      this.week++;
      this.showNotification('📅 Новая неделя!');
    }
    
    // Доход с шахт
    const income = this.victorySystem.getDailyIncome();
    if (Object.keys(income).length > 0) {
      this.addResources(income);
    }
    
    // Базовый доход
    this.resources.gold += 500;
    this.dayText.setText(`День: ${this.day} | Неделя: ${this.week}`);
    this.updateResourceDisplay();
    this.showNotification(`⏭️ День ${this.day}`);
    
    // Обновляем состояние дня в VictorySystem
    this.victorySystem.setDay(this.day);
    
    // Ход ИИ противников
    this.aiSystem.executeTurn();
    this.updateAIHeroPositions();
    
    // Проверяем условия победы/поражения
    this.checkVictoryConditions();
  }

  private checkVictoryConditions(): void {
    // Передаём текущее золото для проверок
    const result = this.victorySystem.checkVictory();
    
    if (result.gameOver) {
      this.stopMovement();
      this.time.delayedCall(500, () => {
        this.showGameOverScreen(result.result, result.reason, result.stats);
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
          this.victorySystem.registerMine({
            id: obj.id,
            x, y,
            owner: 'neutral',
            resourceType: 'gold',
            dailyIncome: 500
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
   * Получить список всех героев игрока
   */
  public getPlayerHeroes(): Hero[] {
    return this.playerHeroes;
  }
  
  /**
   * Добавить нового героя на карту (для таверны)
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
    
    this.showNotification(`🦸 Новый герой ${newHero.name} появился рядом с городом!`);
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
    this.hero.experience += exp;
    // Проверка повышения уровня
    const expToLevel = this.hero.level * 1000;
    if (this.hero.experience >= expToLevel) {
      this.hero.level++;
      this.hero.stats.attack += 1;
      this.hero.stats.defense += 1;
      this.showNotification(`🎉 Уровень ${this.hero.level}! +1 АТК, +1 ЗАЩ`);
    }
  }
  
  public addResources(res: Partial<typeof this.resources>): void {
    for (const [key, value] of Object.entries(res)) {
      (this.resources as any)[key] += value as number;
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
        stats: { attack: 2, defense: 2, spellPower: isNecro ? 3 : 1, knowledge: isNecro ? 3 : 1, morale: 0, luck: 0 },
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
        movementPoints: 1500
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
}
