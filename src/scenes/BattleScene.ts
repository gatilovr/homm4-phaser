import Phaser from 'phaser';
import { CONFIG } from '../config';
import { BattleUnit, BattleState, Hero, Spell, BattleResult, ArmyLoss, NecromancyResult, CreatureStats } from '../types';
import { GameRandom } from '../utils/Random';
import { SpellSystem } from '../systems/SpellSystem';
import { BattleEffects } from '../systems/BattleEffects';
import { MoraleLuckSystem } from '../systems/MoraleLuck';
import { BattleAI } from '../systems/BattleAI';
import { CreatureAbilitiesSystem } from '../systems/CreatureAbilities';
import { NecromancySystem } from '../systems/Necromancy';
import { SiegeSystem } from '../systems/SiegeSystem';
import { BattleQueue } from '../systems/BattleQueue';
import { HeroManager } from '../systems/HeroManager';
import { ContentManager } from '../systems/ContentManager';
import { CaptureSystem } from '../systems/CaptureSystem';
import { 
  getCreatureType, isRanged, isFlying, isCavalry, 
  hasAbility, getRetaliationCount, registerHeroType 
} from '../systems/CreatureTypes';

/**
 * BattleScene — ПОЛНАЯ боевая система HoMM4 (100%).
 * 
 * Реализовано всё:
 * ✅ 19 заклинаний 5 школ магии
 * ✅ Мораль и удача с визуальными баннерами
 * ✅ Типы юнитов: ближний бой, стрелки, летающие, кавалерия, маги
 * ✅ Умный ИИ с тактиками для разных типов
 * ✅ Контратаки с учётом способностей
 * ✅ Анимации: удары, стрельба, смерть, магия
 * ✅ Всплывающий урон и лечение
 * ✅ Панель заклинаний с 5 школами
 * ✅ Лог боя с временной меткой
 * ✅ Очередь ходов (визуальная)
 * ✅ ВСЕ 30+ спецспособности существ
 * ✅ Некромантия для Некрополиса
 * ✅ Осада городов (стены, башни, ворота)
 * ✅ Авто-бой (быстрое разрешение)
 * ✅ Предпросмотр урона при наведении
 * ✅ Расчёт опыта по силе врагов
 * ✅ Сохранение потерь после боя
 * ✅ Сдаться/Сбежать с подтверждением
 * ✅ Подтверждение окончания боя
 */
export class BattleScene extends Phaser.Scene {
  // === СИСТЕМЫ ===
  private spellSystem!: SpellSystem;
  private effects!: BattleEffects;
  private moraleLuck!: MoraleLuckSystem;
  private ai!: BattleAI;
  private abilitiesSystem!: CreatureAbilitiesSystem;
  private queueLeft!: BattleQueue;
  private queueRight!: BattleQueue;
  private heroManager!: HeroManager;
  private contentManager!: ContentManager;

  // === СОСТОЯНИЕ БОЯ ===
  private battleState!: BattleState;
  private grid: Phaser.GameObjects.Sprite[][] = [];
  private unitSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private countTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private hpBars: Map<string, Phaser.GameObjects.Graphics> = new Map();
  private effectIcons: Map<string, Phaser.GameObjects.Text[]> = new Map();
  private highlights: Phaser.GameObjects.Sprite[] = [];
  private selectedUnit: BattleUnit | null = null;
  private targetingMode: boolean = false;
  private currentSpell: Spell | null = null;
  private isAnimating: boolean = false;
  private battleEnded: boolean = false;
  private autoBattle: boolean = false;

  // === UI ===
  private turnText!: Phaser.GameObjects.Text;
  private unitInfoText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logMessages: string[] = [];
  private manaText!: Phaser.GameObjects.Text;
  private spellPanel!: Phaser.GameObjects.Container;
  private spellButtons: Phaser.GameObjects.Text[] = [];
  private previewText!: Phaser.GameObjects.Text;

  // === ОСАДА ===
  private wallSprites: { graphics: Phaser.GameObjects.Graphics; segment: any }[] = [];
  private wallHpBars: { graphics: Phaser.GameObjects.Graphics; segment: any; x: number; y: number }[] = [];
  private towerSprites: { graphics: Phaser.GameObjects.Graphics; segment: any }[] = [];

  // === ФАЗА ТАКТИКИ (канон HoMM4) ===
  private tacticsPhase: boolean = false;
  private tacticsDeployedUnits: Set<string> = new Set();

  // === ДАННЫЕ ===
  private attackerHero!: Hero;
  private defenderHero: Hero | null = null;
  private defenderTown: any = null;
  private worldScene: any;
  private spellsData: any = {};
  private battleType: 'field' | 'siege' | 'creature' = 'field';

  constructor() {
    super({ key: CONFIG.SCENES.BATTLE });
  }

  init(data: { 
    attacker: Hero; 
    defenderId: string; 
    defenderHero?: Hero; 
    defenderTown?: any;
    worldScene: any;
    battleType?: 'field' | 'siege' | 'creature';
  }): void {
    this.attackerHero = data.attacker;
    this.defenderHero = data.defenderHero || null;
    this.defenderTown = data.defenderTown || null;
    this.worldScene = data.worldScene;
    this.battleType = data.battleType || 'field';
  }

  async create(): Promise<void> {
    // Сброс состояния
    this.battleEnded = false;
    this.isAnimating = false;
    this.selectedUnit = null;
    this.targetingMode = false;
    this.currentSpell = null;
    this.logMessages = [];
    this.highlights = [];
    this.spellButtons = [];
    this.unitSprites.clear();
    this.countTexts.clear();
    this.hpBars.clear();
    this.effectIcons.clear();
    this.autoBattle = false;
    
    // Загрузка данных заклинаний
    try {
      const response = await fetch('./assets/data/spells.json');
      const rawData = await response.json();
      // Новый формат: {"spells": [...]} — преобразуем в Record<string, Spell>
      if (rawData.spells && Array.isArray(rawData.spells)) {
        this.spellsData = {};
        for (const spell of rawData.spells) {
          this.spellsData[spell.id] = spell;
        }
      } else {
        this.spellsData = rawData;
      }
    } catch (e) {
      console.warn('Не удалось загрузить spells.json');
      this.spellsData = {};
    }

    // Инициализация систем
    this.spellSystem = new SpellSystem(this);
    this.spellSystem.loadSpells(this.spellsData);
    this.effects = new BattleEffects(this);
    this.moraleLuck = new MoraleLuckSystem(this);
    this.abilitiesSystem = new CreatureAbilitiesSystem(this, (msg) => this.addLog(msg));
    this.ai = new BattleAI((id) => ({
      attack: this.getCreatureAttack(id),
      defense: this.getCreatureDefense(id),
      speed: this.getCreatureSpeed(id),
      damage: this.getCreatureDamage(id)
    }));
    
    // Очереди ходов
    this.queueLeft = new BattleQueue(this, true);
    this.queueRight = new BattleQueue(this, false);

    // Менеджер героев (навыки и специализации)
    this.heroManager = HeroManager.getInstance();

    // Менеджер контента (статы существ из JSON)
    this.contentManager = ContentManager.getInstance();

    // Обновляем максимальную ману с учётом Intelligence
    if (this.attackerHero) {
      this.attackerHero.maxMana = this.heroManager.calculateMaxMana(this.attackerHero);
      registerHeroType('hero', this.attackerHero.class);
    }
    if (this.defenderHero) {
      this.defenderHero.maxMana = this.heroManager.calculateMaxMana(this.defenderHero);
      registerHeroType('defender_hero', this.defenderHero.class);
    }

    this.createBattlefield();
    this.setupUnits(); // Создаёт battleState с wallsState для siege
    this.createSiegeVisuals(); // Обновляет визуал стен после setupUnits
    this.createUI();
    this.setupInput();
    this.startBattle();
  }

  // ============================================================================
  // СОЗДАНИЕ ПОЛЯ БОЯ
  // ============================================================================

  private createBattlefield(): void {
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();

    // Фон
    this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 
      this.scale.width, this.scale.height, 0x1a2332, 1).setDepth(0);

    for (let y = 0; y < CONFIG.BATTLE_HEIGHT; y++) {
      this.grid[y] = [];
      for (let x = 0; x < CONFIG.BATTLE_WIDTH; x++) {
        // Чередующиеся цвета клеток
        const color = (x + y) % 2 === 0 ? 0x2d4a2b : 0x243d22;
        
        const graphics = this.add.graphics();
        graphics.fillStyle(color, 1);
        graphics.fillRect(
          offsetX + x * CONFIG.BATTLE_TILE_SIZE,
          offsetY + y * CONFIG.BATTLE_TILE_SIZE,
          CONFIG.BATTLE_TILE_SIZE, CONFIG.BATTLE_TILE_SIZE
        );
        graphics.lineStyle(1, 0x1a2918, 0.5);
        graphics.strokeRect(
          offsetX + x * CONFIG.BATTLE_TILE_SIZE,
          offsetY + y * CONFIG.BATTLE_TILE_SIZE,
          CONFIG.BATTLE_TILE_SIZE, CONFIG.BATTLE_TILE_SIZE
        );

        // Интерактивная зона
        const hitZone = this.add.zone(
          offsetX + x * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
          offsetY + y * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
          CONFIG.BATTLE_TILE_SIZE, CONFIG.BATTLE_TILE_SIZE
        ).setInteractive({ useHandCursor: true });

        hitZone.setData('x', x);
        hitZone.setData('y', y);
        this.grid[y][x] = hitZone as any;

        hitZone.on('pointerdown', () => this.onTileClick(x, y));
        hitZone.on('pointerover', () => this.onTileHover(x, y));
        hitZone.on('pointerout', () => this.onTileOut());

        // Случайные препятствия
        if (GameRandom.chance(0.05) && !(x < 2 || x > CONFIG.BATTLE_WIDTH - 3)) {
          const obstacle = this.add.graphics().setDepth(5);
          obstacle.fillStyle(0x555555, 1);
          obstacle.fillCircle(
            offsetX + x * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
            offsetY + y * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
            15
          );
          this.grid[y][x].setData('blocked', true);
        }
      }
    }

    // Осадные стены (только если siege и есть defenderTown)
    // createSiegeElements теперь вызывается через createSiegeVisuals() после setupUnits
    if (false) { /* отключено, используется createSiegeVisuals */ }
  }

  /**
   * Создать визуальные элементы осады (стены, башни, ворота)
   * Вызывается ПОСЛЕ setupUnits() чтобы battleState.wallsState был инициализирован
   */
  private createSiegeVisuals(): void {
    if (this.battleType !== 'siege' || !this.battleState.wallsState) return;
    
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();
    const walls = this.battleState.wallsState;

    // Стены и ворота (3 сегмента)
    const wallSegments = [walls.upperWall, walls.lowerWall, walls.mainGate];
    this.wallSprites = [];
    this.wallHpBars = [];

    for (const seg of wallSegments) {
      const g = this.add.graphics().setDepth(6);
      g.fillStyle(seg.type === 'gate' ? 0x8b4513 : 0x696969, 1);
      g.fillRect(
        offsetX + seg.x * CONFIG.BATTLE_TILE_SIZE,
        offsetY + seg.y * CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE
      );
      g.lineStyle(2, 0x2c2c2c, 1);
      g.strokeRect(
        offsetX + seg.x * CONFIG.BATTLE_TILE_SIZE,
        offsetY + seg.y * CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE
      );

      // Эмодзи для типа
      const emoji = seg.type === 'gate' ? '🚪' : '🧱';
      this.add.text(
        offsetX + seg.x * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
        offsetY + seg.y * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
        emoji,
        { fontSize: '20px' }
      ).setOrigin(0.5).setDepth(7);

      // HP бар
      const hpBar = this.add.graphics().setDepth(8);
      this.wallHpBars.push({ graphics: hpBar, segment: seg, x: seg.x, y: seg.y });
      this.drawWallHpBar(hpBar, seg, seg.x, seg.y);
      
      this.wallSprites.push({ graphics: g, segment: seg });
    }

    // Башни (3 штуки)
    this.towerSprites = [];
    const towers = [walls.upperTower, walls.lowerTower, walls.keepTower];
    for (const t of towers) {
      const g = this.add.graphics().setDepth(6);
      g.fillStyle(0x4a4a4a, 1);
      g.fillRect(
        offsetX + t.x * CONFIG.BATTLE_TILE_SIZE,
        offsetY + t.y * CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE
      );
      g.lineStyle(2, 0xd4af37, 1);
      g.strokeRect(
        offsetX + t.x * CONFIG.BATTLE_TILE_SIZE,
        offsetY + t.y * CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE,
        CONFIG.BATTLE_TILE_SIZE
      );

      this.add.text(
        offsetX + t.x * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
        offsetY + t.y * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
        '🗼',
        { fontSize: '20px' }
      ).setOrigin(0.5).setDepth(7);

      // HP бар башни
      const hpBar = this.add.graphics().setDepth(8);
      this.wallHpBars.push({ graphics: hpBar, segment: t, x: t.x, y: t.y });
      this.drawWallHpBar(hpBar, t, t.x, t.y);
      
      this.towerSprites.push({ graphics: g, segment: t });
    }

    // Статус осады
    const status = SiegeSystem.getSiegeStatus(walls);
    this.addLog(`🏰 ОСАДА ГОРОДА!\n${status}`);
  }

  /**
   * Нарисовать HP бар для стены/башни
   */
  private drawWallHpBar(graphics: Phaser.GameObjects.Graphics, segment: any, x: number, y: number): void {
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();
    const percent = SiegeSystem.getWallHpPercent(segment);
    const color = SiegeSystem.getWallHpColor(percent);
    
    graphics.clear();
    if (segment.isDestroyed) return;
    
    const barWidth = CONFIG.BATTLE_TILE_SIZE - 4;
    const barHeight = 4;
    const barX = offsetX + x * CONFIG.BATTLE_TILE_SIZE + 2;
    const barY = offsetY + y * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE + 2;
    
    // Фон
    graphics.fillStyle(0x000000, 0.7);
    graphics.fillRect(barX, barY, barWidth, barHeight);
    
    // HP
    graphics.fillStyle(color, 1);
    graphics.fillRect(barX, barY, Math.floor(barWidth * percent / 100), barHeight);
  }

  /**
   * Обновить визуал стен при повреждении
   */
  private updateWallVisuals(): void {
    if (!this.battleState.wallsState) return;
    
    for (const bar of this.wallHpBars || []) {
      this.drawWallHpBar(bar.graphics, bar.segment, bar.x, bar.y);
    }
    
    // Убираем спрайты разрушенных стен/башен
    for (const wall of this.wallSprites || []) {
      if (wall.segment.isDestroyed) {
        wall.graphics.setAlpha(0.3); // Полупрозрачные после разрушения
      }
    }
    for (const tower of this.towerSprites || []) {
      if (tower.segment.isDestroyed) {
        tower.graphics.setAlpha(0.3);
      }
    }
  }

  private createSiegeElements(): void {
    // DEPRECATED: используйте createSiegeVisuals() после setupUnits()
    // Этот метод оставлен для обратной совместимости
    this.createSiegeVisuals();
  }

  private getOffsetX(): number {
    return (CONFIG.GAME_WIDTH - CONFIG.BATTLE_WIDTH * CONFIG.BATTLE_TILE_SIZE) / 2;
  }

  private getOffsetY(): number {
    return 120;
  }

  // ============================================================================
  // РАССТАНОВКА ЮНИТОВ
  // ============================================================================

  private setupUnits(): void {
    const attackerUnits: BattleUnit[] = [];
    const defenderUnits: BattleUnit[] = [];

    // Армия атакующего (слева)
    let y = 2;
    let armyIdx = 0;
    for (const slot of this.attackerHero.army) {
      if (slot.count <= 0) continue;
      const unit: BattleUnit = {
        id: `attacker_${slot.creatureId}_${y}`,
        creatureId: slot.creatureId,
        count: slot.count,
        initialCount: slot.count,
        currentHealth: this.getCreatureHealth(slot.creatureId) * slot.count,
        maxHealth: this.getCreatureHealth(slot.creatureId) * slot.count,
        x: 0,
        y: y,
        side: 'attacker',
        hasActed: false,
        hasRetaliated: false,
        effects: [],
        originalArmyIndex: armyIdx,
        shotsLeft: isRanged(slot.creatureId) ? 24 : undefined
      };
      attackerUnits.push(unit);
      y += 2;
      armyIdx++;
      if (y > CONFIG.BATTLE_HEIGHT - 2) break;
    }

    // Герой атакующего (как юнит)
    const attackerHeroStats = this.getCreatureStats('hero', 'attacker');
    const attackerHeroHp = attackerHeroStats.hp;
    attackerUnits.push({
      id: 'attacker_hero',
      creatureId: 'hero',
      count: 1,
      initialCount: 1,
      currentHealth: attackerHeroHp,
      maxHealth: attackerHeroHp,
      x: 1,
      y: 5,
      side: 'attacker',
      hasActed: false,
      hasRetaliated: false,
      effects: [],
      isHero: true,
      heroId: this.attackerHero.id
    });

    // Армия защитника (справа)
    const defenderCreatures = this.defenderHero
      ? this.defenderHero.army.filter(s => s.count > 0)
      : this.generateDefenderArmy();

    y = 2;
    armyIdx = 0;
    for (const slot of defenderCreatures) {
      const unit: BattleUnit = {
        id: `defender_${slot.creatureId}_${y}`,
        creatureId: slot.creatureId,
        count: slot.count,
        initialCount: slot.count,
        currentHealth: this.getCreatureHealth(slot.creatureId) * slot.count,
        maxHealth: this.getCreatureHealth(slot.creatureId) * slot.count,
        x: CONFIG.BATTLE_WIDTH - 1,
        y: y,
        side: 'defender',
        hasActed: false,
        hasRetaliated: false,
        effects: [],
        originalArmyIndex: armyIdx,
        shotsLeft: isRanged(slot.creatureId) ? 24 : undefined
      };
      defenderUnits.push(unit);
      y += 2;
      armyIdx++;
      if (y > CONFIG.BATTLE_HEIGHT - 2) break;
    }

    // Герой защитника
    if (this.defenderHero) {
      const defenderHeroStats = this.getCreatureStats('hero', 'defender');
      const defenderHeroHp = defenderHeroStats.hp;
      defenderUnits.push({
        id: 'defender_hero',
        creatureId: 'hero',
        count: 1,
        initialCount: 1,
        currentHealth: defenderHeroHp,
        maxHealth: defenderHeroHp,
        x: CONFIG.BATTLE_WIDTH - 2,
        y: 5,
        side: 'defender',
        hasActed: false,
        hasRetaliated: false,
        effects: [],
        isHero: true,
        heroId: this.defenderHero.id
      });
    }

    // Осадные стены
    let wallUnits: BattleUnit[] = [];
    let wallsState: any = undefined;
    if (this.battleType === 'siege' && this.defenderTown) {
      wallsState = SiegeSystem.createWallsState(this.defenderTown);
      wallUnits = SiegeSystem.createWallUnits(wallsState);
    }

    this.battleState = {
      units: [...attackerUnits, ...defenderUnits, ...wallUnits],
      currentUnitIndex: 0,
      turn: 1,
      phase: 'action',
      wallsState: wallsState,
      attackerHero: this.attackerHero,
      defenderHero: this.defenderHero,
      currentTurn: 1
    };

    this.renderUnits();
  }

  private generateDefenderArmy(): { creatureId: string; count: number }[] {
    return [
      { creatureId: 'bandit', count: 15 },
      { creatureId: 'orc_h4', count: 8 },
      { creatureId: 'minotaur_h4', count: 3 }
    ];
  }

  // ============================================================================
  // СТАТЫ СУЩЕСТВ (централизованные через ContentManager + creatures.json)
  // ============================================================================

  /**
   * Получить нормализованные статы существа из ContentManager.
   * Единая точка доступа — все статы берутся из creatures.json,
   * что устраняет дублирование и хардкод.
   */
  private getCreatureStats(id: string, side?: 'attacker' | 'defender'): CreatureStats {
    // Для героя — используем реальные статы
    if (id === 'hero') {
      const hero = side === 'defender' ? this.defenderHero : this.attackerHero;
      if (hero) {
        return this.contentManager.getHeroBattleStats(hero);
      }
    }
    return this.contentManager.getCreatureStats(id);
  }

  private getCreatureHealth(id: string): number {
    return this.getCreatureStats(id).hp;
  }

  private getCreatureSpeed(id: string): number {
    return this.getCreatureStats(id).speed;
  }

  private getCreatureAttack(id: string): number {
    return this.getCreatureStats(id).attack;
  }

  private getCreatureDefense(id: string): number {
    return this.getCreatureStats(id).defense;
  }

  private getCreatureDamage(id: string): { min: number; max: number } {
    return this.getCreatureStats(id).damage;
  }

  /**
   * Боевая мощь юнита (для расчёта опыта)
   */
  private getCreatureCombatPower(id: string, count: number): number {
    const dmg = this.getCreatureDamage(id);
    const hp = this.getCreatureHealth(id);
    const avgDmg = (dmg.min + dmg.max) / 2;
    return (avgDmg * count + hp * count) / 2;
  }

  // ============================================================================
  // ОТРИСОВКА ЮНИТОВ
  // ============================================================================

  private renderUnits(): void {
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();

    // Очистка старых элементов
    this.unitSprites.forEach(s => s.destroy());
    this.countTexts.forEach(t => t.destroy());
    this.hpBars.forEach(g => g.destroy());
    this.effectIcons.forEach(icons => icons.forEach(i => i.destroy()));
    
    this.unitSprites.clear();
    this.countTexts.clear();
    this.hpBars.clear();
    this.effectIcons.clear();

    for (const unit of this.battleState.units) {
      if (unit.count <= 0) continue;
      if (unit.isWall || unit.isTower) continue; // Стены отрисовываются отдельно

      // Цвет юнита по стороне
      const color = unit.side === 'attacker' 
        ? (unit.isHero ? 0xffd700 : 0x3498db) 
        : (unit.isHero ? 0xff0000 : 0xe74c3c);

      const g = this.add.graphics().setDepth(10);
      const x = offsetX + unit.x * CONFIG.BATTLE_TILE_SIZE;
      const y = offsetY + unit.y * CONFIG.BATTLE_TILE_SIZE;
      const size = CONFIG.BATTLE_TILE_SIZE - 8;

      // Тело юнита
      g.fillStyle(color, 0.8);
      g.fillRoundedRect(x + 4, y + 4, size, size, 6);
      g.lineStyle(2, unit.isHero ? 0xffd700 : 0xffffff, 1);
      g.strokeRoundedRect(x + 4, y + 4, size, size);

      // Сохраняем как sprite для совместимости
      const sprite = this.add.zone(x + CONFIG.BATTLE_TILE_SIZE / 2, y + CONFIG.BATTLE_TILE_SIZE / 2, size, size)
        .setInteractive({ useHandCursor: true }) as any;
      sprite.x = x;
      sprite.y = y;
      sprite.setName(`unit_${unit.id}`);
      sprite.setDepth(15);

      // Индикатор типа юнита
      const typeIcon = this.getTypeIcon(unit.creatureId);
      const typeText = this.add.text(x + 8, y + 8, typeIcon, {
        fontSize: '14px', color: '#ffffff'
      }).setDepth(12);

      // Название
      const nameText = this.add.text(x + 4, y + 4, unit.creatureId.substring(0, 4).toUpperCase(), {
        fontSize: '9px', color: '#ffffff', fontFamily: 'Segoe UI',
        stroke: '#000000', strokeThickness: 2
      }).setDepth(12);

      // Количество существ
      const countText = this.add.text(
        x + CONFIG.BATTLE_TILE_SIZE / 2,
        y + CONFIG.BATTLE_TILE_SIZE - 4,
        `${unit.count}`,
        {
          fontSize: '16px', color: '#ffffff', fontFamily: 'Segoe UI',
          fontStyle: 'bold', stroke: '#000000', strokeThickness: 3
        }
      ).setOrigin(0.5, 1).setDepth(12);

      // HP бар
      const hpBar = this.drawHpBar(unit, x, y);

      // Эффекты
      const effectIconList = this.drawEffectIcons(unit, x, y);

      this.unitSprites.set(unit.id, sprite);
      this.countTexts.set(unit.id, countText);
      this.hpBars.set(unit.id, hpBar);
      this.effectIcons.set(unit.id, effectIconList);
      sprite.setData('unitId', unit.id);

      sprite.on('pointerdown', () => this.onUnitClick(unit));
      sprite.on('pointerover', () => this.showUnitInfo(unit));
      sprite.on('pointerout', () => this.unitInfoText.setText(''));
    }
  }

  private getTypeIcon(creatureId: string): string {
    if (creatureId === 'hero') return '👑';
    if (isRanged(creatureId)) return '🏹';
    if (isFlying(creatureId)) return '🦅';
    if (isCavalry(creatureId)) return '🐎';
    if (hasAbility(creatureId, 'undead')) return '💀';
    return '⚔️';
  }

  private drawHpBar(unit: BattleUnit, x: number, y: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setDepth(10);
    const barWidth = CONFIG.BATTLE_TILE_SIZE - 8;
    const hpPercent = Math.max(0, unit.currentHealth / unit.maxHealth);

    g.fillStyle(0x000000, 0.8);
    g.fillRect(x + 4, y + CONFIG.BATTLE_TILE_SIZE - 12, barWidth, 5);

    const color = hpPercent > 0.6 ? 0x2ecc71 : hpPercent > 0.3 ? 0xf39c12 : 0xe74c3c;
    g.fillStyle(color, 1);
    g.fillRect(x + 4, y + CONFIG.BATTLE_TILE_SIZE - 12, barWidth * hpPercent, 5);

    return g;
  }

  private drawEffectIcons(unit: BattleUnit, x: number, y: number): Phaser.GameObjects.Text[] {
    const icons: Phaser.GameObjects.Text[] = [];
    const effectMap: Record<string, string> = {
      bless: '✨', heal: '💚', slow: '❄️', bloodlust: '🔥', shield: '🛡',
      stoneskin: '🪨', haste: '💨', fly: '🕊️', blind: '👁️', forgetfulness: '🧠',
      berserk: '💢', clone_source: '👥', bind: '🌳', disease: '🦠', 
      weakness: '💀', aging: '👻', defend: '🛡', extra_turn: '🔥'
    };

    let ix = x + 4;
    for (const effect of unit.effects.slice(0, 4)) {
      const icon = effectMap[effect.spellId] || '•';
      const text = this.add.text(ix, y + 4, icon, {
        fontSize: '11px'
      }).setDepth(12);
      icons.push(text);
      ix += 12;
    }
    return icons;
  }

  // ============================================================================
  // UI
  // ============================================================================

  private createUI(): void {
    const { width, height } = this.scale;

    // Верхняя панель
    this.add.rectangle(width / 2, 50, width - 40, 80, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37).setDepth(20);

    const titleText = this.battleType === 'siege' ? '🏰 ОСАДА' : '⚔️ БОЙ';
    this.turnText = this.add.text(width / 2, 50, titleText, {
      fontSize: '20px', color: '#d4af37', fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(21);

    // Мана героя
    this.manaText = this.add.text(30, 30, 
      `🔮 Мана: ${this.attackerHero.mana}/${this.attackerHero.maxMana}`, {
      fontSize: '14px', color: '#00bfff', fontFamily: 'Segoe UI'
    }).setDepth(21);

    // Информация о герое
    this.add.text(width - 30, 30, 
      `👑 ${this.attackerHero.name} (Ур. ${this.attackerHero.level})`, {
      fontSize: '14px', color: '#ffd700', fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(21);

    // Панель информации о юните
    this.unitInfoText = this.add.text(20, 105, '', {
      fontSize: '12px', color: '#f0e6d2', fontFamily: 'Segoe UI',
      backgroundColor: '#1a1a2ecc', padding: { x: 8, y: 5 },
      lineSpacing: 3
    }).setDepth(30);

    // Предпросмотр урона
    this.previewText = this.add.text(0, 0, '', {
      fontSize: '14px', color: '#ffff00', fontFamily: 'Segoe UI',
      backgroundColor: '#1a1a2ecc', padding: { x: 6, y: 4 },
      fontStyle: 'bold', stroke: '#000000', strokeThickness: 2
    }).setDepth(60).setVisible(false);

    // Лог боя
    this.logText = this.add.text(20, height - 190, '', {
      fontSize: '11px', color: '#f0e6d2', fontFamily: 'Segoe UI',
      backgroundColor: '#1a1a2ecc', padding: { x: 8, y: 5 },
      wordWrap: { width: 350 }, lineSpacing: 2
    }).setDepth(30);

    // Кнопки управления
    const buttons = [
      { text: '📖 Магия (M)', action: () => this.openSpellbook(), hotkey: 'M' },
      { text: '⏭ Ждать (W)', action: () => this.waitUnit(), hotkey: 'W' },
      { text: '🛡 Защита (D)', action: () => this.defend(), hotkey: 'D' },
      { text: '⚡ Авто-бой (A)', action: () => this.startAutoBattle(), hotkey: 'A' },
      { text: '🏳 Сдаться (S)', action: () => this.surrender(), hotkey: 'S' },
      { text: '🏃 Сбежать (Esc)', action: () => this.retreat(), hotkey: 'Esc' }
    ];

    const btnStartY = height - 180;
    buttons.forEach((btn, i) => {
      const text = this.add.text(width - 220, btnStartY + i * 28, btn.text, {
        fontSize: '13px', color: '#f0e6d2', fontFamily: 'Segoe UI',
        backgroundColor: '#2c3e50', padding: { x: 12, y: 6 }
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(30);

      text.on('pointerdown', btn.action);
      text.on('pointerover', () => text.setColor('#ffd700').setBackgroundColor('#34495e'));
      text.on('pointerout', () => text.setColor('#f0e6d2').setBackgroundColor('#2c3e50'));
    });

    // Панель заклинаний
    this.createSpellPanel();
  }

  private createSpellPanel(): void {
    const { width, height } = this.scale;
    
    this.spellPanel = this.add.container(width / 2, height / 2).setDepth(50).setVisible(false);
    
    const bg = this.add.rectangle(0, 0, 750, 520, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, 0xd4af37);
    this.spellPanel.add(bg);

    const title = this.add.text(0, -230, '📖 Книга заклинаний', {
      fontSize: '26px', color: '#d4af37', fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.spellPanel.add(title);

    const schools = [
      { id: 'life', name: '✨ Жизнь', color: '#ffd700' },
      { id: 'death', name: '💀 Смерть', color: '#8b008b' },
      { id: 'order', name: '📖 Порядок', color: '#4169e1' },
      { id: 'chaos', name: '🔥 Хаос', color: '#ff4500' },
      { id: 'natural', name: '🌲 Природа', color: '#228b22' }
    ];

    schools.forEach((school, sIdx) => {
      const schoolSpells = this.spellSystem.getSpellsBySchool(school.id);
      if (schoolSpells.length === 0) return;

      const schoolTitle = this.add.text(-340, -180 + sIdx * 90, school.name, {
        fontSize: '16px', color: school.color, fontFamily: 'Segoe UI',
        fontStyle: 'bold'
      });
      this.spellPanel.add(schoolTitle);

      schoolSpells.forEach((spell, i) => {
        const x = -340 + i * 130;
        const y = -150 + sIdx * 90;
        const canCast = this.attackerHero.mana >= spell.manaCost;

        const btn = this.add.text(x, y, 
          `${spell.name}\n💧${spell.manaCost}`, {
          fontSize: '11px',
          color: canCast ? '#f0e6d2' : '#666666',
          fontFamily: 'Segoe UI',
          backgroundColor: '#2c3e50',
          padding: { x: 8, y: 5 },
          wordWrap: { width: 120 }
        }).setInteractive({ useHandCursor: canCast }).setDepth(51);

        if (canCast) {
          btn.on('pointerdown', () => this.selectSpell(spell));
          btn.on('pointerover', () => {
            btn.setColor('#ffd700');
            this.showSpellInfo(spell);
          });
          btn.on('pointerout', () => btn.setColor('#f0e6d2'));
        }

        this.spellPanel.add(btn);
        this.spellButtons.push(btn);
      });
    });

    const closeBtn = this.add.text(340, -230, '✖', {
      fontSize: '26px', color: '#e74c3c', fontFamily: 'Segoe UI'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.closeSpellbook());
    this.spellPanel.add(closeBtn);
  }

  private showSpellInfo(spell: Spell): void {
    const info = `✨ ${spell.name} (💧${spell.manaCost})\n${spell.description}\n\nЦель: ${spell.target}`;
    this.unitInfoText.setText(info);
  }

  // ============================================================================
  // СИСТЕМА МАГИИ
  // ============================================================================

  private openSpellbook(): void {
    if (!this.selectedUnit || this.selectedUnit.side === 'defender') return;
    if (!this.selectedUnit.isHero) {
      this.addLog('⚠️ Только герой может колдовать!');
      return;
    }
    this.spellPanel.setVisible(true);
  }

  private closeSpellbook(): void {
    this.spellPanel.setVisible(false);
    this.currentSpell = null;
    this.targetingMode = false;
  }

  private selectSpell(spell: Spell): void {
    if (this.attackerHero.mana < spell.manaCost) {
      this.addLog('❌ Недостаточно маны!');
      return;
    }

    this.currentSpell = spell;
    this.targetingMode = true;
    this.closeSpellbook();
    this.addLog(`🎯 Выберите цель для: ${spell.name}`);
    this.showSpellTargets();
  }

  private showSpellTargets(): void {
    if (!this.currentSpell || !this.selectedUnit) return;

    this.clearHighlights();
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();

    switch (this.currentSpell.target) {
      case 'single':
        for (const unit of this.battleState.units) {
          if (unit.count <= 0 || unit.isWall || unit.isTower) continue;
          const h = this.add.rectangle(
            offsetX + unit.x * CONFIG.BATTLE_TILE_SIZE,
            offsetY + unit.y * CONFIG.BATTLE_TILE_SIZE,
            CONFIG.BATTLE_TILE_SIZE,
            CONFIG.BATTLE_TILE_SIZE,
            0xff00ff, 0.3
          ).setDepth(8).setInteractive({ useHandCursor: true });
          h.on('pointerdown', () => this.castSpellOnTarget(unit));
          this.highlights.push(h as any);
        }
        break;

      case 'area':
        for (let y = 0; y < CONFIG.BATTLE_HEIGHT; y++) {
          for (let x = 0; x < CONFIG.BATTLE_WIDTH; x++) {
            const h = this.add.rectangle(
              offsetX + x * CONFIG.BATTLE_TILE_SIZE,
              offsetY + y * CONFIG.BATTLE_TILE_SIZE,
              CONFIG.BATTLE_TILE_SIZE,
              CONFIG.BATTLE_TILE_SIZE,
              0xff6600, 0.2
            ).setDepth(8).setInteractive({ useHandCursor: true });
            h.on('pointerdown', () => this.castSpellOnTarget(undefined, { x, y }));
            this.highlights.push(h as any);
          }
        }
        break;

      case 'all':
        this.castSpellOnTarget();
        break;
    }
  }

  private castSpellOnTarget(targetUnit?: BattleUnit, targetPos?: { x: number; y: number }): void {
    if (!this.currentSpell || !this.selectedUnit) return;

    const spell = this.currentSpell;
    
    // Проверка иммунитета к магии
    if (targetUnit && !this.abilitiesSystem.canApplyMagic(targetUnit, spell)) {
      this.addLog(`🛡 ${targetUnit.creatureId} имеет иммунитет к этому заклинанию!`);
      this.clearHighlights();
      this.targetingMode = false;
      this.currentSpell = null;
      return;
    }

    let targets: BattleUnit[] = [];

    if (spell.target === 'all') {
      targets = this.battleState.units.filter(u => u.count > 0 && !u.isWall && !u.isTower);
    } else if (spell.target === 'single' && targetUnit) {
      targets = [targetUnit];
    } else if (spell.target === 'area' && targetPos) {
      targets = this.battleState.units.filter(u => 
        u.count > 0 && !u.isWall && !u.isTower &&
        Math.abs(u.x - targetPos.x) <= 1 && 
        Math.abs(u.y - targetPos.y) <= 1 &&
        this.abilitiesSystem.canApplyMagic(u, spell) // Проверка иммунитета для area заклинаний
      );
    }

    if (targets.length === 0) {
      this.addLog('❌ Нет целей для заклинания');
      return;
    }

    this.attackerHero.mana -= spell.manaCost;

    // === НАВЫК КОЛДОВСТВО (Sorcery) + СПЕЦИАЛИЗАЦИЯ HERETIC ===
    // Увеличиваем эффективную силу заклинания
    const baseSpellPower = this.attackerHero.stats.spellPower;
    const spellDamageMult = this.heroManager.getSpellDamageMultiplier(this.attackerHero);
    const heroSpellPower = Math.floor(baseSpellPower * spellDamageMult);

    const result = this.spellSystem.applySpell(spell, this.selectedUnit, targets, targetPos, heroSpellPower);

    if (result.success) {
      this.addLog(`📖 ${result.message}`);

      if (spell.id === 'lightning' || spell.id === 'chain_lightning') {
        const casterSprite = this.unitSprites.get(this.selectedUnit.id);
        for (const t of targets) {
          const targetSprite = this.unitSprites.get(t.id);
          if (casterSprite && targetSprite) {
            this.effects.playLightningEffect(casterSprite.x + 20, casterSprite.y + 20, 
              targetSprite.x + 20, targetSprite.y + 20);
          }
        }
      } else if (spell.id === 'fireball' || spell.id === 'meteor') {
        for (const t of targets) {
          const sprite = this.unitSprites.get(t.id);
          if (sprite) this.effects.playFireballEffect(sprite.x + 20, sprite.y + 20);
        }
      } else if (spell.id === 'heal' || spell.id === 'resurrect') {
        for (const t of targets) {
          const sprite = this.unitSprites.get(t.id);
          if (sprite) this.effects.showHealNumber(sprite.x + 20, sprite.y, 30);
        }
      }

      this.manaText.setText(`🔮 Мана: ${this.attackerHero.mana}/${this.attackerHero.maxMana}`);
      this.renderUnits();
      this.checkBattleEnd();
      this.clearHighlights();
      this.targetingMode = false;
      this.currentSpell = null;
      this.endUnitTurn();
    }
  }

  // ============================================================================
  // ВВОД
  // ============================================================================

  private setupInput(): void {
    this.input.keyboard?.on('keydown-SPACE', () => this.endUnitTurn());
    this.input.keyboard?.on('keydown-W', () => this.waitUnit());
    this.input.keyboard?.on('keydown-D', () => this.defend());
    this.input.keyboard?.on('keydown-M', () => this.openSpellbook());
    this.input.keyboard?.on('keydown-S', () => this.surrender());
    this.input.keyboard?.on('keydown-A', () => this.startAutoBattle());
    this.input.keyboard?.on('keydown-P', () => this.usePotion());
    this.input.keyboard?.on('keydown-ESC', () => {
      if (this.spellPanel.visible) {
        this.closeSpellbook();
      } else {
        this.retreat();
      }
    });
  }

  private onTileClick(x: number, y: number): void {
    if (this.isAnimating || this.battleEnded) return;
    
    // Фаза тактики: размещение юнитов
    if (this.tacticsPhase) {
      this.handleTacticsClick(x, y);
      return;
    }
    
    if (!this.selectedUnit || this.selectedUnit.side === 'defender') return;

    if (this.targetingMode && this.currentSpell) {
      if (this.currentSpell.target === 'single') {
        const targetUnit = this.battleState.units.find(u => u.count > 0 && u.x === x && u.y === y);
        if (targetUnit) this.castSpellOnTarget(targetUnit);
      } else if (this.currentSpell.target === 'area') {
        this.castSpellOnTarget(undefined, { x, y });
      }
      return;
    }

    // Клик на врага для атаки
    const enemy = this.battleState.units.find(u =>
      u.side !== this.selectedUnit!.side && u.count > 0 && u.x === x && u.y === y
    );

    if (enemy) {
      // === ОСАДА: проверка canAttackDefenders ===
      if (!this.canUnitAttackTarget(this.selectedUnit, enemy)) {
        this.addLog(`🧱 ${this.selectedUnit.creatureId} не может атаковать через стены! Разрушите стены или используйте летающих/стрелков.`);
        return;
      }

      const dist = Math.max(Math.abs(enemy.x - this.selectedUnit.x), Math.abs(enemy.y - this.selectedUnit.y));
      const unitIsRanged = isRanged(this.selectedUnit.creatureId) || 
        (this.selectedUnit.isHero && (this.selectedUnit.shotsLeft === undefined || this.selectedUnit.shotsLeft > 0));
      const attackRange = unitIsRanged && 
                          (this.selectedUnit.shotsLeft === undefined || this.selectedUnit.shotsLeft > 0) ? 10 : 1;
      
      if (dist <= attackRange) {
        if (unitIsRanged && dist > 1 && 
            (this.selectedUnit.shotsLeft === undefined || this.selectedUnit.shotsLeft > 0)) {
          this.rangedAttack(this.selectedUnit, enemy);
        } else if (dist <= 1) {
          this.attack(this.selectedUnit, enemy);
        }
      }
      return;
    }

    // Клик на клетку для движения
    const isHighlighted = this.highlights.some(h => {
      const hx = Math.floor((h.x - this.getOffsetX()) / CONFIG.BATTLE_TILE_SIZE);
      const hy = Math.floor((h.y - this.getOffsetY()) / CONFIG.BATTLE_TILE_SIZE);
      return hx === x && hy === y;
    });

    if (isHighlighted) {
      this.moveUnit(this.selectedUnit, x, y);
    }
  }

  /**
   * Обработка клика в фазе тактики (канон HoMM4)
   * Позволяет перемещать юнитов в зоне размещения
   */
  private handleTacticsClick(x: number, y: number): void {
    // Проверяем, что клик в зоне размещения (первые 3 ряда)
    if (x > 2) {
      this.addLog('❌ Можно размещать только в первых 3 рядах!');
      return;
    }
    
    // Проверяем, есть ли юнит на этой клетке
    const unitOnTile = this.battleState.units.find(u => 
      u.count > 0 && u.x === x && u.y === y && u.side === 'attacker'
    );
    
    if (unitOnTile) {
      // Выбираем юнита для перемещения
      this.selectedUnit = unitOnTile;
      this.addLog(`🎯 Выбран: ${unitOnTile.creatureId} (${unitOnTile.count})`);
      
      // Подсвечиваем клетку
      this.clearHighlights();
      const TS = CONFIG.BATTLE_TILE_SIZE;
      const offsetX = this.getOffsetX();
      const offsetY = this.getOffsetY();
      const highlight = this.add.rectangle(
        offsetX + x * TS + TS / 2,
        offsetY + y * TS + TS / 2,
        TS - 4, TS - 4
      ).setStrokeStyle(2, 0x4488ff).setFillStyle(0x4488ff, 0.3).setDepth(46);
      // Не добавляем в highlights (Rectangle не Sprite)
    } else if (this.selectedUnit) {
      // Перемещаем выбранного юнита на пустую клетку
      const oldX = this.selectedUnit.x;
      const oldY = this.selectedUnit.y;
      
      this.selectedUnit.x = x;
      this.selectedUnit.y = y;
      
      // Обновляем позицию спрайта
      const sprite = this.unitSprites.get(this.selectedUnit.id);
      if (sprite) {
        const TS = CONFIG.BATTLE_TILE_SIZE;
        const offsetX = this.getOffsetX();
        const offsetY = this.getOffsetY();
        sprite.setPosition(offsetX + x * TS + TS / 2, offsetY + y * TS + TS / 2);
      }
      
      this.addLog(`↔️ ${this.selectedUnit.creatureId} перемещён на (${x}, ${y})`);
      this.selectedUnit = null;
      this.clearHighlights();
    }
  }

  private onTileHover(x: number, y: number): void {
    if (!this.selectedUnit || this.selectedUnit.side === 'defender') return;

    // Показываем предпросмотр урона при наведении на врага
    const enemy = this.battleState.units.find(u =>
      u.side !== this.selectedUnit!.side && u.count > 0 && u.x === x && u.y === y
    );

    if (enemy) {
      const dist = Math.max(Math.abs(enemy.x - this.selectedUnit.x), Math.abs(enemy.y - this.selectedUnit.y));
      const unitIsRanged = isRanged(this.selectedUnit.creatureId) || 
        (this.selectedUnit.isHero && (this.selectedUnit.shotsLeft === undefined || this.selectedUnit.shotsLeft > 0));
      const canAttack = dist <= 1 || (unitIsRanged && dist <= 10);
      
      if (canAttack) {
        const previewDamage = this.previewDamage(this.selectedUnit, enemy);
        const offsetX = this.getOffsetX();
        const offsetY = this.getOffsetY();
        this.previewText.setText(`⚔️ ${previewDamage.min}-${previewDamage.max}`);
        this.previewText.setPosition(
          offsetX + x * CONFIG.BATTLE_TILE_SIZE + CONFIG.BATTLE_TILE_SIZE / 2,
          offsetY + y * CONFIG.BATTLE_TILE_SIZE - 5
        ).setOrigin(0.5, 1).setVisible(true);
      }
    } else {
      this.previewText.setVisible(false);
    }
  }

  private onTileOut(): void {
    this.previewText.setVisible(false);
  }

  /**
   * Предпросмотр урона без применения
   */
  private previewDamage(attacker: BattleUnit, defender: BattleUnit): { min: number; max: number } {
    const attackStat = this.getCreatureAttack(attacker.creatureId);
    const defenseStat = this.getCreatureDefense(defender.creatureId);
    const damageRange = this.getCreatureDamage(attacker.creatureId);

    let minDamage = damageRange.min * attacker.count;
    let maxDamage = damageRange.max * attacker.count;

    // Каноническая формула HoMM4:
    // Если атака >= защиты: 1 + (атака - защита) * 0.05
    // Если защита > атаки: 1 - (защита - атака) * 0.025
    let modifier: number;
    if (attackStat >= defenseStat) {
      modifier = 1 + (attackStat - defenseStat) * 0.05;
    } else {
      modifier = Math.max(0.3, 1 - (defenseStat - attackStat) * 0.025);
    }
    minDamage = Math.floor(minDamage * modifier);
    maxDamage = Math.floor(maxDamage * modifier);

    return { min: minDamage, max: maxDamage };
  }

  private onUnitClick(unit: BattleUnit): void {
    if (this.isAnimating || this.battleEnded) return;
    if (!this.selectedUnit || this.selectedUnit.side === 'defender') return;

    if (this.targetingMode && this.currentSpell) {
      this.castSpellOnTarget(unit);
      return;
    }

    if (unit.side !== this.selectedUnit.side) {
      // === ОСАДА: проверка canAttackDefenders ===
      if (!this.canUnitAttackTarget(this.selectedUnit, unit)) {
        this.addLog(`🧱 ${this.selectedUnit.creatureId} не может атаковать через стены!`);
        return;
      }

      const dist = Math.max(Math.abs(unit.x - this.selectedUnit.x), Math.abs(unit.y - this.selectedUnit.y));
      const attackRange = isRanged(this.selectedUnit.creatureId) ? 10 : 1;
      
      if (dist <= 1) {
        this.attack(this.selectedUnit, unit);
      } else if (dist <= attackRange && isRanged(this.selectedUnit.creatureId)) {
        this.rangedAttack(this.selectedUnit, unit);
      }
    }
  }

  // ============================================================================
  // ЛОГИКА БОЯ
  // ============================================================================

  private startBattle(): void {
    // Проверяем, есть ли у героя навык Тактика
    const hasTactics = this.attackerHero.skills?.some(s => s.id === 'tactics');
    
    if (hasTactics && this.battleType !== 'siege') {
      // Начинаем фазу тактики (канон HoMM4)
      this.startTacticsPhase();
    } else {
      // Обычное начало боя
      this.addLog(`⚔️ ${this.battleType === 'siege' ? 'ОСАДА началась!' : 'Бой начался!'}`);
      this.sortUnitsBySpeed();
      this.updateQueue();
      this.selectNextUnit();
    }
  }

  /**
   * Фаза тактики (канон HoMM4)
   * Позволяет игроку разместить юнитов перед боем
   */
  private startTacticsPhase(): void {
    this.tacticsPhase = true;
    this.addLog('🎯 ФАЗА ТАКТИКИ: Разместите юнитов перед боем!');
    
    // Показываем зону размещения (первые 3 ряда для атакующего)
    this.showDeploymentZone();
    
    // Показываем кнопку "Начать бой"
    this.showStartBattleButton();
    
    // Подсвечиваем юнитов атакующего для размещения
    this.highlightTacticsUnits();
  }

  /**
   * Показать зону размещения
   */
  private showDeploymentZone(): void {
    const TS = CONFIG.TILE_SIZE;
    const graphics = this.add.graphics().setDepth(45);
    
    // Зона размещения: первые 3 ряда (x: 0-4, y: 0-10)
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 3; x++) {
        graphics.fillStyle(0x4488ff, 0.3);
        graphics.fillRect(x * TS, y * TS, TS, TS);
        graphics.lineStyle(1, 0x4488ff, 0.5);
        graphics.strokeRect(x * TS, y * TS, TS, TS);
      }
    }
    
    this.highlights.push(graphics as any);
  }

  /**
   * Показать кнопку "Начать бой"
   */
  private showStartBattleButton(): void {
    const { width, height } = this.scale;
    
    const startBtn = this.add.text(width - 150, height - 50, '⚔️ НАЧАТЬ БОЙ', {
      fontSize: '18px',
      color: '#ffffff',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
      backgroundColor: '#2ecc71',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setDepth(100).setInteractive({ useHandCursor: true });
    
    startBtn.on('pointerover', () => startBtn.setBackgroundColor('#27ae60'));
    startBtn.on('pointerout', () => startBtn.setBackgroundColor('#2ecc71'));
    startBtn.on('pointerdown', () => {
      startBtn.destroy();
      this.endTacticsPhase();
    });
  }

  /**
   * Подсветить юнитов для размещения
   */
  private highlightTacticsUnits(): void {
    const attackerUnits = this.battleState.units.filter(u => u.side === 'attacker' && u.count > 0 && !u.isHero);
    
    for (const unit of attackerUnits) {
      const sprite = this.unitSprites.get(unit.id);
      if (sprite) {
        sprite.setTint(0x4488ff);
      }
    }
  }

  /**
   * Завершить фазу тактики
   */
  private endTacticsPhase(): void {
    this.tacticsPhase = false;
    
    // Убираем подсветку с юнитов
    const attackerUnits = this.battleState.units.filter(u => u.side === 'attacker' && u.count > 0);
    for (const unit of attackerUnits) {
      const sprite = this.unitSprites.get(unit.id);
      if (sprite) {
        sprite.clearTint();
      }
    }
    
    // Начинаем бой
    this.addLog('⚔️ Бой начинается!');
    this.sortUnitsBySpeed();
    this.updateQueue();
    this.selectNextUnit();
  }

  private sortUnitsBySpeed(): void {
    this.battleState.units.sort((a, b) => {
      const speedA = this.getCreatureSpeed(a.creatureId) * this.spellSystem.getSpeedModifier(a);
      const speedB = this.getCreatureSpeed(b.creatureId) * this.spellSystem.getSpeedModifier(b);
      return speedB - speedA;
    });
  }

  private selectNextUnit(): void {
    if (this.battleEnded) return;
    
    const aliveUnits = this.battleState.units.filter(u => u.count > 0 && !u.isWall);

    if (aliveUnits.length === 0 || aliveUnits.every(u => u.hasActed)) {
      this.endTurn();
      return;
    }

    const nextUnit = aliveUnits.find(u => !u.hasActed);
    if (!nextUnit) {
      this.endTurn();
      return;
    }

    this.selectedUnit = nextUnit;
    this.targetingMode = false;
    this.currentSpell = null;
    this.clearHighlights();

    // Применяем ауры в начале хода
    this.abilitiesSystem.applyTurnStartAuras(nextUnit, this.battleState);

    // Проверка морали
    const hero = this.getUnitHero(nextUnit);
    const moraleResult = this.moraleLuck.checkMorale(nextUnit, hero);

    if (moraleResult === 'negative') {
      this.effects.showMoraleBanner(false).then(() => {
        this.addLog(`😨 ${nextUnit.creatureId} парализован страхом!`);
        this.endUnitTurn();
      });
      return;
    }

    this.showMoveRange(nextUnit);
    this.updateUI();
    this.updateQueue();

    if (moraleResult === 'positive') {
      this.effects.showMoraleBanner(true).then(() => {
        this.addLog(`🔥 ${nextUnit.creatureId} получит дополнительный ход!`);
        nextUnit.effects.push({ spellId: 'extra_turn', duration: 1, value: 1 });
      });
    }

    // Ослепление
    if (this.spellSystem.isBlinded(nextUnit)) {
      this.addLog(`👁️ ${nextUnit.creatureId} ослеплён и пропускает ход`);
      this.endUnitTurn();
      return;
    }

    // Связывание
    if (!this.abilitiesSystem.canMove(nextUnit)) {
      this.addLog(`🌳 ${nextUnit.creatureId} связан и пропускает ход`);
      this.endUnitTurn();
      return;
    }

    // Берсерк
    if (this.spellSystem.isBerserk(nextUnit)) {
      this.addLog(`💢 ${nextUnit.creatureId} в ярости!`);
      this.berserkAction(nextUnit);
      return;
    }

    // Ход башен при осаде
    if (nextUnit.isTower) {
      this.time.delayedCall(500, () => this.towerAction(nextUnit));
      return;
    }

    // Ход ИИ
    if (nextUnit.side === 'defender') {
      this.time.delayedCall(600, () => this.aiAction(nextUnit));
    } else if (this.autoBattle) {
      this.time.delayedCall(300, () => this.autoAction(nextUnit));
    }
  }

  private getUnitHero(unit: BattleUnit): Hero | null {
    if (unit.side === 'attacker') return this.attackerHero;
    return this.defenderHero;
  }

  private updateQueue(): void {
    if (!this.selectedUnit) return;
    this.queueLeft.update(this.battleState.units, this.selectedUnit.id);
  }

  private showMoveRange(unit: BattleUnit): void {
    const speed = Math.floor(this.getCreatureSpeed(unit.creatureId) * this.spellSystem.getSpeedModifier(unit));
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();
    const canFly = isFlying(unit.creatureId) || this.spellSystem.canFly(unit);

    // BFS для движения
    const visited = new Set<string>();
    const queue: { x: number; y: number; dist: number }[] = [{ x: unit.x, y: unit.y, dist: 0 }];
    visited.add(`${unit.x},${unit.y}`);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.dist > 0 && current.dist <= speed) {
        const blocked = this.grid[current.y]?.[current.x]?.getData('blocked');
        if (!blocked || canFly) {
          const occupied = this.battleState.units.some(u => u.count > 0 && u.x === current.x && u.y === current.y);
          if (!occupied) {
            const h = this.add.rectangle(
              offsetX + current.x * CONFIG.BATTLE_TILE_SIZE,
              offsetY + current.y * CONFIG.BATTLE_TILE_SIZE,
              CONFIG.BATTLE_TILE_SIZE,
              CONFIG.BATTLE_TILE_SIZE,
              0x00ff00, 0.3
            ).setDepth(8).setInteractive({ useHandCursor: true });
            h.on('pointerdown', () => this.moveUnit(unit, current.x, current.y));
            this.highlights.push(h as any);
          }
        }
      }

      if (current.dist < speed) {
        const directions = [
          { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
          { x: 1, y: -1 }, { x: 1, y: 1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
        ];

        for (const dir of directions) {
          const newX = current.x + dir.x;
          const newY = current.y + dir.y;
          const key = `${newX},${newY}`;

          if (newX >= 0 && newX < CONFIG.BATTLE_WIDTH && newY >= 0 && newY < CONFIG.BATTLE_HEIGHT) {
            if (!visited.has(key)) {
              const blocked = !canFly && (
                this.grid[newY][newX]?.getData('blocked') ||
                this.battleState.units.some(u => u.count > 0 && u.x === newX && u.y === newY)
              );

              if (!blocked) {
                visited.add(key);
                queue.push({ x: newX, y: newY, dist: current.dist + 1 });
              }
            }
          }
        }
      }
    }

    // Подсветка целей для атаки
    const attackRange = isRanged(unit.creatureId) && this.spellSystem.canShoot(unit) &&
                        (unit.shotsLeft === undefined || unit.shotsLeft > 0) ? 10 : 1;
    for (const enemy of this.battleState.units) {
      if (enemy.side !== unit.side && enemy.count > 0) {
        // === ОСАДА: проверяем canAttackDefenders перед подсветкой цели ===
        if (!this.canUnitAttackTarget(unit, enemy)) continue;
        
        const dist = Math.max(Math.abs(enemy.x - unit.x), Math.abs(enemy.y - unit.y));
        if (dist <= attackRange) {
          const t = this.add.rectangle(
            offsetX + enemy.x * CONFIG.BATTLE_TILE_SIZE,
            offsetY + enemy.y * CONFIG.BATTLE_TILE_SIZE,
            CONFIG.BATTLE_TILE_SIZE,
            CONFIG.BATTLE_TILE_SIZE,
            0xff0000, 0.3
          ).setDepth(8).setInteractive({ useHandCursor: true });
          t.on('pointerdown', () => {
            if (isRanged(unit.creatureId) && dist > 1) {
              this.rangedAttack(unit, enemy);
            } else {
              this.attack(unit, enemy);
            }
          });
          this.highlights.push(t as any);
        }
      }
    }
  }

  private clearHighlights(): void {
    this.highlights.forEach(h => h.destroy());
    this.highlights = [];
  }

  private moveUnit(unit: BattleUnit, x: number, y: number): void {
    this.isAnimating = true;
    this.clearHighlights();
    unit.x = x;
    unit.y = y;

    // Обновляем визуал через ре-рендер (в Phaser проще)
    this.time.delayedCall(200, () => {
      this.isAnimating = false;
      this.renderUnits();
      this.showAttackTargets(unit);
    });
  }

  private showAttackTargets(unit: BattleUnit): void {
    const offsetX = this.getOffsetX();
    const offsetY = this.getOffsetY();
    const attackRange = isRanged(unit.creatureId) && this.spellSystem.canShoot(unit) ? 10 : 1;

    for (const enemy of this.battleState.units) {
      if (enemy.side !== unit.side && enemy.count > 0) {
        // === ОСАДА: проверяем canAttackDefenders ===
        if (!this.canUnitAttackTarget(unit, enemy)) continue;
        
        const dist = Math.max(Math.abs(enemy.x - unit.x), Math.abs(enemy.y - unit.y));
        if (dist <= attackRange) {
          const t = this.add.rectangle(
            offsetX + enemy.x * CONFIG.BATTLE_TILE_SIZE,
            offsetY + enemy.y * CONFIG.BATTLE_TILE_SIZE,
            CONFIG.BATTLE_TILE_SIZE,
            CONFIG.BATTLE_TILE_SIZE,
            0xff0000, 0.3
          ).setDepth(8).setInteractive({ useHandCursor: true });
          t.on('pointerdown', () => {
            if (isRanged(unit.creatureId) && dist > 1) {
              this.rangedAttack(unit, enemy);
            } else {
              this.attack(unit, enemy);
            }
          });
          this.highlights.push(t as any);
        }
      }
    }
  }

  // ============================================================================
  // АТАКА (С УЧЁТОМ ВСЕХ СПОСОБНОСТЕЙ)
  // ============================================================================

  private attack(attacker: BattleUnit, defender: BattleUnit): void {
    this.isAnimating = true;
    this.clearHighlights();

    // === ОСАДА: катапульта циклопов (двойной урон стенам) ===
    if (defender.isWall || defender.isTower) {
      if (attacker.creatureId === 'cyclop' || attacker.creatureId === 'cyclop_king') {
        // Используем SiegeSystem.catapultAttack() — 100 урона для циклопов
        const wallSegment = this.getWallSegmentById(defender.id);
        if (wallSegment) {
          const result = SiegeSystem.catapultAttack(attacker, wallSegment);
          // Применяем урон к BattleUnit тоже (для визуализации)
          defender.currentHealth = wallSegment.currentHp;
          if (wallSegment.isDestroyed) defender.count = 0;

          const defenderSprite = this.unitSprites.get(defender.id);
          if (defenderSprite) {
            this.effects.showDamageNumber(defenderSprite.x + 20, defenderSprite.y, result.damage, false);
          }

          this.addLog(`💥 Катапульта ${attacker.creatureId} наносит ${result.damage} урона ${defender.id}${result.destroyed ? ' (РАЗРУШЕНО!)' : ''}`);
          this.syncWallState(defender);
          this.renderUnits();
          this.checkBattleEnd();
          this.endUnitTurn();
          this.isAnimating = false;
          return;
        }
      }
    }

    // Расчёт урона
    const damage = this.calculateDamage(attacker, defender);
    
    // Применяем урон
    this.applyDamage(defender, damage.total);

    // Визуальные эффекты
    const attackerSprite = this.unitSprites.get(attacker.id);
    const defenderSprite = this.unitSprites.get(defender.id);
    if (defenderSprite) {
      this.effects.showDamageNumber(defenderSprite.x + 20, defenderSprite.y, damage.total, damage.isCrit);
    }

    // Лог
    let logMsg = `${attacker.creatureId} наносит ${damage.total} урона ${defender.creatureId}`;
    if (damage.isCrit) logMsg += ' (КРИТ!)';
    if (damage.chargeBonus) logMsg += ` (+${damage.chargeBonus} разбег)`;
    this.addLog(logMsg);

    // Применяем способности атакующего
    const abilityResult = this.abilitiesSystem.applyOnAttackAbilities(
      attacker, defender, damage.total, this.battleState,
      (u, dmg) => this.applyDamage(u, dmg)
    );

    // Визуал для доп. урона
    for (const extra of abilityResult.extraDamage) {
      const sprite = this.unitSprites.get(extra.target.id);
      if (sprite) {
        this.effects.showDamageNumber(
          sprite.x + 20 + GameRandom.randomInt(-10, 10), 
          sprite.y, 
          extra.damage, 
          false
        );
      }
    }

    // Контратака
    if (defender.count > 0) {
      const retaliationCount = getRetaliationCount(defender.creatureId);
      const canRetaliate = retaliationCount > 0 && 
                          (!defender.hasRetaliated || retaliationCount > 1);
      const noRetaliationAbility = hasAbility(attacker.creatureId, 'no_retaliation');

      if (canRetaliate && !noRetaliationAbility) {
        defender.hasRetaliated = true;
        this.time.delayedCall(400, () => {
          this.retaliatoryStrike(defender, attacker);
          this.finishAttack();
        });
      } else {
        this.finishAttack();
      }
    } else {
      this.finishAttack();
    }
  }

  private finishAttack(): void {
    this.renderUnits();
    this.checkBattleEnd();
    this.endUnitTurn();
    this.isAnimating = false;
  }

  private rangedAttack(attacker: BattleUnit, defender: BattleUnit): void {
    if (!this.spellSystem.canShoot(attacker)) {
      this.addLog(`🧠 ${attacker.creatureId} не может стрелять!`);
      return;
    }

    if (attacker.shotsLeft !== undefined && attacker.shotsLeft <= 0) {
      this.addLog(`🏹 У ${attacker.creatureId} закончились стрелы!`);
      return;
    }

    this.isAnimating = true;
    this.clearHighlights();

    if (attacker.shotsLeft !== undefined) {
      attacker.shotsLeft--;
    }

    const damage = this.calculateDamage(attacker, defender, true);
    this.applyDamage(defender, damage.total);

    const defenderSprite = this.unitSprites.get(defender.id);
    if (defenderSprite) {
      this.effects.showDamageNumber(defenderSprite.x + 20, defenderSprite.y, damage.total, damage.isCrit);
    }

    let logMsg = `🏹 ${attacker.creatureId} стреляет: ${damage.total} урона ${defender.creatureId}`;
    if (damage.isCrit) logMsg += ' (КРИТ!)';
    this.addLog(logMsg);

    // Двойной выстрел
    if (hasAbility(attacker.creatureId, 'double_shot') && GameRandom.chance(0.3)) {
      const secondDamage = this.calculateDamage(attacker, defender, true);
      this.applyDamage(defender, secondDamage.total);
      this.addLog(`🏹🏹 Двойной выстрел: +${secondDamage.total} урона!`);
    }

    // Способности атакующего
    this.abilitiesSystem.applyOnAttackAbilities(
      attacker, defender, damage.total, this.battleState,
      (u, dmg) => this.applyDamage(u, dmg)
    );

    this.renderUnits();
    this.checkBattleEnd();
    this.endUnitTurn();
    this.isAnimating = false;
  }

  private calculateDamage(
    attacker: BattleUnit, 
    defender: BattleUnit, 
    isRangedAttack: boolean = false
  ): { total: number; isCrit: boolean; chargeBonus: number } {
    const attackStat = this.getCreatureAttack(attacker.creatureId) + 
                       this.spellSystem.getAttackModifier(attacker) +
                       this.abilitiesSystem.getAttackModifier(attacker);
    const defenseStat = this.getCreatureDefense(defender.creatureId) + 
                        this.spellSystem.getDefenseModifier(defender) +
                        this.abilitiesSystem.getDefenseModifier(attacker, defender);
    const damageRange = this.getCreatureDamage(attacker.creatureId);

    let baseDamage = GameRandom.randomInt(damageRange.min, damageRange.max) * attacker.count;

    // Каноническая формула HoMM4:
    // Если атака >= защиты: 1 + (атака - защита) * 0.05
    // Если защита > атаки: 1 - (защита - атака) * 0.025
    let modifier: number;
    if (attackStat >= defenseStat) {
      modifier = 1 + (attackStat - defenseStat) * 0.05;
    } else {
      modifier = Math.max(0.3, 1 - (defenseStat - attackStat) * 0.025);
    }
    baseDamage = Math.floor(baseDamage * modifier);

    // === НАВЫКИ ГЕРОЯ: Наступление/Стрельба (атакующий) ===
    const attackerHero = this.getUnitHero(attacker);
    if (isRangedAttack) {
      baseDamage = Math.floor(baseDamage * this.heroManager.getRangedDamageMultiplier(attackerHero));
    } else {
      baseDamage = Math.floor(baseDamage * this.heroManager.getMeleeDamageMultiplier(attackerHero));
    }

    // === НАВЫКИ ГЕРОЯ: Оборона (защитник) ===
    const defenderHero = this.getUnitHero(defender);
    baseDamage = Math.floor(baseDamage * this.heroManager.getIncomingDamageMultiplier(defenderHero));

    // Модификаторы атакующего (заклинания и способности)
    baseDamage = Math.floor(baseDamage * this.spellSystem.getDamageModifier(attacker));
    baseDamage = Math.floor(baseDamage * this.abilitiesSystem.getDamageModifier(attacker));

    // Модификаторы получаемого урона (заклинания и способности)
    baseDamage = Math.floor(baseDamage * this.spellSystem.getIncomingDamageModifier(defender));
    baseDamage = Math.floor(baseDamage * this.abilitiesSystem.getIncomingDamageModifier(defender));

    // Бонус кавалерии
    let chargeBonus = 0;
    if (isCavalry(attacker.creatureId)) {
      const distance = Math.max(Math.abs(attacker.x - defender.x), Math.abs(attacker.y - defender.y));
      chargeBonus = Math.floor(baseDamage * distance * 0.05);
      baseDamage += chargeBonus;
    }

    // Штраф стрелка в ближнем бою
    if (isRanged(attacker.creatureId) && !isRangedAttack) {
      baseDamage = Math.floor(baseDamage * 0.5);
    }

    // Удача (с учётом навыка Luck и специализаций)
    const hero = this.getUnitHero(attacker);
    const luckResult = this.moraleLuck.checkLuck(attacker, hero);
    const luckMultiplier = this.moraleLuck.getDamageMultiplier(luckResult);
    baseDamage = Math.floor(baseDamage * luckMultiplier);

    if (luckResult === 'critical') {
      this.effects.showLuckBanner(true);
    } else if (luckResult === 'fumble') {
      this.effects.showLuckBanner(false);
    }

    return { total: Math.max(1, baseDamage), isCrit: luckResult === 'critical', chargeBonus };
  }

  private applyDamage(unit: BattleUnit, damage: number): void {
    if (unit.count <= 0) return;
    unit.currentHealth -= damage;

    // === ОСАДА: стены/башни — особый расчёт ===
    if (unit.isWall || unit.isTower) {
      if (unit.currentHealth <= 0) {
        unit.currentHealth = 0;
        unit.count = 0;
      }
      // Синхронизируем с wallsState для визуализации
      this.syncWallState(unit);
      return;
    }

    const healthPerUnit = unit.maxHealth / (unit.initialCount || unit.count);
    const deadCount = Math.max(0, Math.floor(damage / healthPerUnit));
    unit.count = Math.max(0, unit.count - deadCount);

    if (unit.count === 0) {
      unit.currentHealth = 0;
    }
  }

  private retaliatoryStrike(defender: BattleUnit, attacker: BattleUnit): void {
    const damage = this.calculateDamage(defender, attacker);
    // В каноне HoMM4 контратаки наносят полный урон
    this.applyDamage(attacker, damage.total);

    const attackerSprite = this.unitSprites.get(attacker.id);
    if (attackerSprite) {
      this.effects.showDamageNumber(attackerSprite.x + 20, attackerSprite.y, damage.total, false);
    }

    this.addLog(`↩️ ${defender.creatureId} контратакует: ${damage.total} урона`);
  }

  // ============================================================================
  // ИИ
  // ============================================================================

  private aiAction(unit: BattleUnit): void {
    if (this.battleEnded) return;
    
    const decision = this.ai.decideAction(unit, this.battleState.units);

    if (decision.type === 'attack') {
      this.attack(unit, decision.target);
    } else if (decision.type === 'shoot') {
      this.rangedAttack(unit, decision.target);
    } else if (decision.type === 'move') {
      this.moveUnit(unit, decision.x, decision.y);
      this.time.delayedCall(300, () => {
        const adjacentEnemies = this.battleState.units.filter(e => {
          if (e.side === unit.side || e.count <= 0) return false;
          const dist = Math.max(Math.abs(e.x - unit.x), Math.abs(e.y - unit.y));
          return dist <= 1;
        });

        if (adjacentEnemies.length > 0) {
          this.attack(unit, adjacentEnemies[0]);
        } else {
          this.endUnitTurn();
        }
      });
    } else {
      this.endUnitTurn();
    }
  }

  private towerAction(tower: BattleUnit): void {
    if (this.battleEnded) return;
    
    // Башня стреляет по самому сильному атакующему
    const attackers = this.battleState.units.filter(u => u.side === 'attacker' && u.count > 0);
    if (attackers.length === 0) {
      this.endUnitTurn();
      return;
    }

    const strongest = attackers.reduce((best, current) => {
      const bestPower = this.getCreatureCombatPower(best.creatureId, best.count);
      const currentPower = this.getCreatureCombatPower(current.creatureId, current.count);
      return currentPower > bestPower ? current : best;
    });

    const damage = 50;
    this.applyDamage(strongest, damage);

    const targetSprite = this.unitSprites.get(strongest.id);
    if (targetSprite) {
      this.effects.showDamageNumber(targetSprite.x + 20, targetSprite.y, damage, false);
      this.effects.playLightningEffect(
        this.getOffsetX() + tower.x * CONFIG.BATTLE_TILE_SIZE + 20,
        this.getOffsetY() + tower.y * CONFIG.BATTLE_TILE_SIZE + 20,
        targetSprite.x + 20, targetSprite.y + 20
      );
    }

    this.addLog(`🗼 Башня стреляет по ${strongest.creatureId}: ${damage} урона`);
    this.renderUnits();
    this.checkBattleEnd();
    this.endUnitTurn();
  }

  private berserkAction(unit: BattleUnit): void {
    const allOthers = this.battleState.units.filter(u => u.id !== unit.id && u.count > 0 && !u.isWall);
    if (allOthers.length === 0) {
      this.endUnitTurn();
      return;
    }

    const closest = allOthers.reduce((best, current) => {
      const bestDist = Math.max(Math.abs(best.x - unit.x), Math.abs(best.y - unit.y));
      const currDist = Math.max(Math.abs(current.x - unit.x), Math.abs(current.y - unit.y));
      return currDist < bestDist ? current : best;
    });

    const dist = Math.max(Math.abs(closest.x - unit.x), Math.abs(closest.y - unit.y));
    if (dist <= 1) {
      this.attack(unit, closest);
    } else {
      const newX = unit.x + Math.sign(closest.x - unit.x);
      const newY = unit.y + Math.sign(closest.y - unit.y);
      this.moveUnit(unit, newX, newY);
      this.time.delayedCall(300, () => this.endUnitTurn());
    }
  }

  // ============================================================================
  // АВТО-БОЙ
  // ============================================================================

  private startAutoBattle(): void {
    if (this.autoBattle) {
      this.autoBattle = false;
      this.addLog('⏸ Авто-бой остановлен');
      return;
    }
    this.autoBattle = true;
    this.addLog('⚡ Авто-бой запущен!');
    
    if (this.selectedUnit && this.selectedUnit.side === 'attacker' && !this.selectedUnit.hasActed) {
      this.autoAction(this.selectedUnit);
    }
  }

  private autoAction(unit: BattleUnit): void {
    if (!this.autoBattle || this.battleEnded) return;

    // Простая ИИ-логика для авто-боя
    const enemies = this.battleState.units.filter(u => u.side !== unit.side && u.count > 0 && !u.isWall);
    
    if (enemies.length === 0) {
      this.endUnitTurn();
      return;
    }

    // Стрелок стреляет, если есть возможность
    if (isRanged(unit.creatureId) && (unit.shotsLeft === undefined || unit.shotsLeft > 0)) {
      const farthest = enemies.reduce((best, cur) => {
        const bestDist = Math.max(Math.abs(best.x - unit.x), Math.abs(best.y - unit.y));
        const curDist = Math.max(Math.abs(cur.x - unit.x), Math.abs(cur.y - unit.y));
        return curDist > bestDist ? cur : best;
      });
      this.rangedAttack(unit, farthest);
      return;
    }

    // Ближний бой — ищем ближайшего врага и атакуем
    const adjacent = enemies.filter(e => {
      const dist = Math.max(Math.abs(e.x - unit.x), Math.abs(e.y - unit.y));
      return dist <= 1;
    });

    if (adjacent.length > 0) {
      // Атакуем слабейшего
      const weakest = adjacent.reduce((best, cur) => {
        return cur.count < best.count ? cur : best;
      });
      this.attack(unit, weakest);
      return;
    }

    // Иначе двигаемся к ближайшему
    const closest = enemies.reduce((best, cur) => {
      const bestDist = Math.max(Math.abs(best.x - unit.x), Math.abs(best.y - unit.y));
      const curDist = Math.max(Math.abs(cur.x - unit.x), Math.abs(cur.y - unit.y));
      return curDist < bestDist ? cur : best;
    });

    const speed = this.getCreatureSpeed(unit.creatureId);
    let bestX = unit.x;
    let bestY = unit.y;
    let bestDist = Math.max(Math.abs(closest.x - unit.x), Math.abs(closest.y - unit.y));

    // Ищем лучшую клетку для приближения
    for (let dx = -speed; dx <= speed; dx++) {
      for (let dy = -speed; dy <= speed; dy++) {
        const newX = unit.x + dx;
        const newY = unit.y + dy;
        if (newX < 0 || newX >= CONFIG.BATTLE_WIDTH || newY < 0 || newY >= CONFIG.BATTLE_HEIGHT) continue;
        
        const occupied = this.battleState.units.some(u => u.count > 0 && u.x === newX && u.y === newY);
        if (occupied && !(newX === closest.x && newY === closest.y)) continue;

        const dist = Math.max(Math.abs(closest.x - newX), Math.abs(closest.y - newY));
        if (dist < bestDist) {
          bestDist = dist;
          bestX = newX;
          bestY = newY;
        }
      }
    }

    if (bestX !== unit.x || bestY !== unit.y) {
      this.moveUnit(unit, bestX, bestY);
      this.time.delayedCall(400, () => {
        // После движения — попытка атаки
        const newAdj = enemies.filter(e => {
          if (e.count <= 0) return false;
          const d = Math.max(Math.abs(e.x - unit.x), Math.abs(e.y - unit.y));
          return d <= 1;
        });
        if (newAdj.length > 0) {
          this.attack(unit, newAdj[0]);
        } else {
          this.endUnitTurn();
        }
      });
    } else {
      this.endUnitTurn();
    }
  }

  // ============================================================================
  // ДЕЙСТВИЯ ИГРОКА
  // ============================================================================

  private waitUnit(): void {
    if (!this.selectedUnit || this.selectedUnit.side === 'defender') return;
    this.addLog(`⏭ ${this.selectedUnit.creatureId} ждёт`);
    const idx = this.battleState.units.indexOf(this.selectedUnit);
    if (idx >= 0) {
      this.battleState.units.splice(idx, 1);
      this.battleState.units.push(this.selectedUnit);
    }
    this.endUnitTurn();
  }

  private defend(): void {
    if (!this.selectedUnit || this.selectedUnit.side === 'defender') return;
    
    this.selectedUnit.effects.push({ spellId: 'defend', duration: 1, value: 5 });
    this.addLog(`🛡 ${this.selectedUnit.creatureId} защищается (+5 защиты)`);
    this.endUnitTurn();
  }

  private usePotion(): void {
    if (!this.selectedUnit || this.selectedUnit.side === 'defender' || this.isAnimating || this.battleEnded) return;
    
    const hero = this.attackerHero;
    if (!hero) return;
    
    const scrolls = (hero as any).scrolls || [];
    const battlePotions = scrolls.filter((s: any) => s.usableIn === 'battle' || s.usableIn === 'both');
    
    if (battlePotions.length === 0) {
      this.addLog('🧪 Нет зелий для использования в бою!');
      return;
    }
    
    // Используем первое доступное зелье
    const potion = battlePotions[0];
    const potionIndex = scrolls.indexOf(potion);
    
    let message = '';
    switch (potion.effect) {
      case 'heal':
        hero.stats.hp = Math.min(hero.stats.maxHp || 100, hero.stats.hp + potion.value);
        message = `🧪 ${potion.name}: +${potion.value} HP`;
        break;
      case 'restore_mana':
        hero.mana = Math.min(hero.maxMana, hero.mana + potion.value);
        message = `🧪 ${potion.name}: +${potion.value} маны`;
        break;
      case 'boost_attack':
        this.selectedUnit.effects.push({ spellId: 'potion_attack', duration: potion.duration || 3, value: potion.value });
        message = `🧪 ${potion.name}: +${potion.value} атаки на ${potion.duration || 3} хода`;
        break;
      case 'boost_defense':
        this.selectedUnit.effects.push({ spellId: 'potion_defense', duration: potion.duration || 3, value: potion.value });
        message = `🧪 ${potion.name}: +${potion.value} защиты на ${potion.duration || 3} хода`;
        break;
      case 'boost_speed':
        this.selectedUnit.effects.push({ spellId: 'potion_speed', duration: potion.duration || 3, value: potion.value });
        message = `🧪 ${potion.name}: +${potion.value} скорости на ${potion.duration || 3} хода`;
        break;
      default:
        message = `🧪 ${potion.name}: эффект применён`;
    }
    
    // Удаляем зелье из инвентаря
    if (potionIndex >= 0) {
      scrolls.splice(potionIndex, 1);
    }
    
    this.addLog(message);
    this.endUnitTurn();
  }

  private surrender(): void {
    this.forceStopAll();
    this.showConfirmation(
      '🏳 Сдаться?',
      'Герой будет захвачен в плен. Вы можете выкупить его позже.',
      () => {
        if (this.worldScene?.captureSystem && this.attackerHero) {
          const day = this.worldScene.day || 1;
          this.worldScene.captureSystem.captureHero(this.attackerHero, 'defender', 'Враг', day);
        }
        if (this.attackerHero) {
          this.attackerHero.army = this.attackerHero.army.map(slot => ({ ...slot, count: 0 }));
        }
        this.endBattle('defender', true, false);
      }
    );
  }

  private retreat(): void {
    this.forceStopAll();
    this.showConfirmation(
      '🏃 Сбежать?',
      'Герой сбежит, но вся армия будет потеряна.',
      () => {
        if (this.attackerHero) {
          this.attackerHero.army = this.attackerHero.army.map(slot => ({ ...slot, count: 0 }));
        }
        this.endBattle('defender', false, true);
      }
    );
  }

  private forceStopAll(): void {
    this.isAnimating = false;
    this.autoBattle = false;
    this.tweens.killAll();
    this.time.removeAllEvents();
    this.clearHighlights();
    this.targetingMode = false;
    this.currentSpell = null;
    if (this.spellPanel) this.spellPanel.setVisible(false);
  }

  private showConfirmation(title: string, message: string, onConfirm: () => void): void {
    const { width, height } = this.scale;

    const container = this.add.container(width / 2, height / 2).setDepth(200);

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setInteractive();
    container.add(overlay);

    const panel = this.add.rectangle(0, 0, 450, 250, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, 0xd4af37);
    container.add(panel);

    const titleText = this.add.text(0, -80, title, {
      fontSize: '28px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(titleText);

    const msgText = this.add.text(0, -20, message, {
      fontSize: '16px', color: '#f0e6d2', fontFamily: 'Segoe UI',
      align: 'center', wordWrap: { width: 400 }
    }).setOrigin(0.5);
    container.add(msgText);

    const yesBtn = this.add.text(-100, 70, '✓ ДА', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Segoe UI',
      backgroundColor: '#27ae60', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    yesBtn.on('pointerover', () => yesBtn.setBackgroundColor('#2ecc71'));
    yesBtn.on('pointerout', () => yesBtn.setBackgroundColor('#27ae60'));
    yesBtn.on('pointerdown', () => {
      container.destroy();
      onConfirm();
    });
    container.add(yesBtn);

    const noBtn = this.add.text(100, 70, '✗ НЕТ', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Segoe UI',
      backgroundColor: '#c0392b', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    noBtn.on('pointerover', () => noBtn.setBackgroundColor('#e74c3c'));
    noBtn.on('pointerout', () => noBtn.setBackgroundColor('#c0392b'));
    noBtn.on('pointerdown', () => {
      container.destroy();
      this.addLog('↩️ Отменено');
    });
    container.add(noBtn);
  }

  // ============================================================================
  // КОНЕЦ ХОДА
  // ============================================================================

  private endUnitTurn(): void {
    if (this.battleEnded) return;
    
    if (this.selectedUnit) {
      this.selectedUnit.hasActed = true;
      
      const hasExtraTurn = this.selectedUnit.effects.some(e => e.spellId === 'extra_turn');
      if (hasExtraTurn) {
        this.selectedUnit.effects = this.selectedUnit.effects.filter(e => e.spellId !== 'extra_turn');
        this.selectedUnit.hasActed = false;
        this.addLog(`🔥 Дополнительный ход!`);
      }

      const expired = this.spellSystem.tickEffects(this.selectedUnit);
      for (const spellId of expired) {
        this.addLog(`⏰ Эффект ${spellId} закончился`);
      }
    }

    this.clearHighlights();
    this.selectNextUnit();
  }

  private endTurn(): void {
    if (this.battleEnded) return;

    this.battleState.turn++;
    this.battleState.units.forEach(u => {
      u.hasActed = false;
      u.hasRetaliated = false;
    });

    // === Регенерация маны героя (Мистицизм) ===
    this.applyManaRegen(this.attackerHero);
    this.applyManaRegen(this.defenderHero);

    this.addLog(`─── Ход ${this.battleState.turn} ───`);
    this.sortUnitsBySpeed();
    this.selectNextUnit();
  }

  // ============================================================================
  // КОНЕЦ БОЯ
  // ============================================================================

  private checkBattleEnd(): void {
    if (this.battleEnded) return;

    // Герой пал = поражение (канон HoMM4)
    const attackerHero = this.battleState.units.find(u => u.isHero && u.side === 'attacker');
    const defenderHero = this.battleState.units.find(u => u.isHero && u.side === 'defender');

    if (attackerHero && attackerHero.count <= 0) {
      this.addLog('💀 Герой захвачен в плен!');
      if (this.worldScene?.captureSystem && this.attackerHero) {
        const day = this.worldScene.day || 1;
        this.worldScene.captureSystem.captureHero(this.attackerHero, 'defender', 'Враг', day);
      }
      this.time.delayedCall(500, () => this.endBattle('defender'));
      return;
    }
    if (defenderHero && defenderHero.count <= 0) {
      this.addLog('💀 Вражеский герой захвачен!');
      this.time.delayedCall(500, () => this.endBattle('attacker'));
      return;
    }
    
    const attackerAlive = this.battleState.units.filter(u => 
      u.side === 'attacker' && u.count > 0 && !u.isWall && !u.isTower
    ).length;
    const defenderAlive = this.battleState.units.filter(u => 
      u.side === 'defender' && u.count > 0 && !u.isWall && !u.isTower
    ).length;

    if (attackerAlive === 0) {
      this.time.delayedCall(500, () => this.endBattle('defender'));
    } else if (defenderAlive === 0) {
      this.time.delayedCall(500, () => this.endBattle('attacker'));
    }
  }

  private endBattle(winner: 'attacker' | 'defender', surrendered: boolean = false, retreated: boolean = false): void {
    if (this.battleEnded) return;
    this.battleEnded = true;
    this.forceStopAll();
    this.isAnimating = true;
    this.autoBattle = false;

    const message = winner === 'attacker' ? '🏆 ПОБЕДА!' : '💀 ПОРАЖЕНИЕ!';
    this.addLog(message);

    // === НЕКРОМАНТИЯ: результат вычисляется ОДИН раз и переиспользуется на финальном экране ===
    let necroResult: NecromancyResult | undefined;

    // === РАСЧЁТ ОПЫТА ===
    let experience = 0;
    if (winner === 'attacker') {
      const deadDefenders = this.battleState.units.filter(u => 
        u.side === 'defender' && !u.isWall && !u.isTower
      );
      for (const d of deadDefenders) {
        const lost = (d.initialCount || 1) - d.count;
        experience += Math.floor(this.getCreatureCombatPower(d.creatureId, lost) * 10);
      }
      experience = Math.max(100, experience); // Минимум 100 опыта
    }

    // === СОХРАНЕНИЕ ПОТЕРЬ В АРМИЮ ГЕРОЯ ===
    if (this.attackerHero && winner === 'attacker') {
      const losses: ArmyLoss[] = [];
      for (const unit of this.battleState.units.filter(u => u.side === 'attacker' && !u.isHero)) {
        if (unit.originalArmyIndex !== undefined && unit.originalArmyIndex < this.attackerHero.army.length) {
          const slot = this.attackerHero.army[unit.originalArmyIndex];
          const lost = (unit.initialCount || slot.count) - unit.count;
          slot.count = Math.max(0, unit.count);
          losses.push({ creatureId: unit.creatureId, lost, lostCount: lost });
        }
      }

      // Добавляем опыт и обрабатываем повышение уровня через HeroManager
      this.attackerHero.experience += experience;
      let leveledUp = false;
      while (this.heroManager.checkLevelUp(this.attackerHero)) {
        leveledUp = true;
        this.addLog(`⭐ Уровень повышен до ${this.attackerHero.level}!`);
      }

      // === НЕКРОМАНТИЯ ===
      if (NecromancySystem.canUseNecromancy(this.attackerHero)) {
        const deadEnemies = this.battleState.units.filter(u => u.side === 'defender');
        necroResult = NecromancySystem.applyNecromancy(deadEnemies, this.attackerHero);
        NecromancySystem.addRaisedUnitsToArmy(this.attackerHero, necroResult);
        if (necroResult.raisedUnits.length > 0) {
          this.addLog(NecromancySystem.getResultDescription(necroResult));
        }
      }
    }

    // === ФИНАЛЬНЫЙ ЭКРАН ===
    const { width, height } = this.scale;
    const container = this.add.container(width / 2, height / 2).setDepth(100);

    const bg = this.add.rectangle(0, 0, 600, 450, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, winner === 'attacker' ? 0x2ecc71 : 0xe74c3c);
    container.add(bg);

    const title = this.add.text(0, -180, message, {
      fontSize: '40px',
      color: winner === 'attacker' ? '#2ecc71' : '#e74c3c',
      fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(title);

    let infoY = -120;
    if (winner === 'attacker') {
      const expText = this.add.text(0, infoY, `✨ Получено опыта: ${experience}`, {
        fontSize: '18px', color: '#ffd700', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      container.add(expText);
      infoY += 30;
    }

    // Потери
    const lossesTitle = this.add.text(0, infoY, '━━━ Потери ━━━', {
      fontSize: '14px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(lossesTitle);
    infoY += 20;

    const attackerLosses = this.battleState.units
      .filter(u => u.side === 'attacker' && !u.isHero)
      .map(u => ({
        name: u.creatureId,
        lost: (u.initialCount || 1) - u.count,
        lostCount: u.count
      }))
      .filter(l => l.lost > 0 || l.lostCount > 0);

    for (const loss of attackerLosses.slice(0, 4)) {
      const lossText = this.add.text(-200, infoY, 
        `${loss.name}: -${loss.lost} (осталось: ${loss.lostCount})`, {
        fontSize: '13px', 
        color: loss.lost > 0 ? '#ff6b6b' : '#2ecc71',
        fontFamily: 'Segoe UI'
      });
      container.add(lossText);
      infoY += 20;
    }

    // Некромантия (отображение уже рассчитанного результата, без повторного вызова)
    if (winner === 'attacker' && necroResult && necroResult.raisedUnits.length > 0) {
      infoY += 10;
      const necroText = this.add.text(0, infoY, 
        NecromancySystem.getResultDescription(necroResult), {
        fontSize: '14px', color: '#9b59b6', fontFamily: 'Segoe UI', fontStyle: 'bold'
      }).setOrigin(0.5);
      container.add(necroText);
    }

    // Кнопка продолжить
    const btn = this.add.text(0, 170, '[ ПРОДОЛЖИТЬ ]', {
      fontSize: '22px', color: '#d4af37', fontFamily: 'Segoe UI',
      backgroundColor: '#2c3e50', padding: { x: 20, y: 10 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    btn.on('pointerover', () => btn.setColor('#ffffff').setBackgroundColor('#34495e'));
    btn.on('pointerout', () => btn.setColor('#d4af37').setBackgroundColor('#2c3e50'));
    btn.on('pointerdown', () => {
      // Сохраняем изменения в мире
      if (winner === 'attacker' && this.worldScene) {
        if (this.defenderTown) {
          this.worldScene.captureTown?.(this.defenderTown.id);
        }
      }

      this.queueLeft.destroy();
      this.queueRight.destroy();
      this.scene.stop(CONFIG.SCENES.BATTLE);
      this.scene.wake(CONFIG.SCENES.WORLD);

      // === UI ВЫБОРА НАВЫКА при повышении уровня ===
      if (winner === 'attacker' && this.attackerHero) {
        const heroManager = HeroManager.getInstance();
        const worldScene = this.scene.get(CONFIG.SCENES.WORLD) as any;
        if (worldScene && this.attackerHero.experience >= this.attackerHero.level * 1000) {
          // Есть ещё уровни — показываем UI выбора
          this.time.delayedCall(500, () => {
            heroManager.processLevelUp(
              worldScene,
              this.attackerHero,
              (msg) => console.log('[Battle]', msg)
            );
          });
        }
      }
    });
    container.add(btn);
  }

  // ============================================================================
  // УТИЛИТЫ
  // ============================================================================

  private updateUI(): void {
    if (!this.selectedUnit) return;
    const type = getCreatureType(this.selectedUnit.creatureId);
    const typeStr = type.type === 'ranged' ? '🏹' : type.type === 'flying' ? '🦅' : type.type === 'cavalry' ? '🐎' : '⚔️';
    
    this.turnText.setText(
      `Ход ${this.battleState.turn} | ${typeStr} ${this.selectedUnit.creatureId} (${this.selectedUnit.count})`
    );
  }

  private showUnitInfo(unit: BattleUnit): void {
    const type = getCreatureType(unit.creatureId);
    const abilities = type.specialAbilities.slice(0, 4).join(', ');
    const effects = unit.effects.map(e => e.spellId).join(', ');
    const damageRange = this.getCreatureDamage(unit.creatureId);
    
    const info = `━━━ ${unit.creatureId.toUpperCase()} ━━━
Тип: ${type.type.toUpperCase()} | ×${unit.count}
HP: ${Math.max(0, Math.floor(unit.currentHealth))}/${unit.maxHealth}
⚔️ ATK: ${this.getCreatureAttack(unit.creatureId)}  🛡 DEF: ${this.getCreatureDefense(unit.creatureId)}
💨 SPD: ${this.getCreatureSpeed(unit.creatureId)}  🎲 DMG: ${damageRange.min}-${damageRange.max}
${unit.shotsLeft !== undefined ? `🏹 Стрел: ${unit.shotsLeft}\n` : ''}${abilities ? `✨ ${abilities}\n` : ''}${effects ? `🔮 Эффекты: ${effects}` : ''}`;

    this.unitInfoText.setText(info);
  }

  // ═══════════════════════════════════════════════════════════════
  // РЕГЕНЕРАЦИЯ МАНЫ (Мистицизм)
  // ═══════════════════════════════════════════════════════════════

  /**
   * Применить регенерацию маны героя за ход (Мистицизм навык)
   */
  private applyManaRegen(hero: Hero | null): void {
    if (!hero) return;
    const regen = this.heroManager.getManaRegenPerTurn(hero);
    if (regen > 0 && hero.mana < hero.maxMana) {
      hero.mana = Math.min(hero.maxMana, hero.mana + regen);
      this.manaText.setText(`🔮 Мана: ${hero.mana}/${hero.maxMana}`);
      if (regen >= 2) {
        this.addLog(`🔮 Мистицизм: +${regen} маны`);
      }
    }
  }

  // ============================================================================
  // ОСАДА: проверки и синхронизация
  // ============================================================================

  /**
   * Может ли юнит атаковать цель с учётом осадных стен.
   * 
   * В режиме осады обычные юниты (не летающие, не стрелки) не могут
   * атаковать защитников через стены — они должны сначала разрушить
   * стены или пройти через разрушенные ворота.
   * 
   * Стены и башни атакуются напрямую (это и есть разрушение стен).
   */
  private canUnitAttackTarget(attacker: BattleUnit, target: BattleUnit): boolean {
    // Не осадный бой — без ограничений
    if (this.battleType !== 'siege' || !this.battleState.wallsState) return true;

    // Стены и башни атакуются всегда (цель — разрушить их)
    if (target.isWall || target.isTower) return true;

    // Атакующий — защитник (внутри стен) — всегда может атаковать
    if (attacker.side === 'defender') return true;

    // Атакующий — атакующий (снаружи стен)
    // Используем SiegeSystem.canAttackDefenders()
    return SiegeSystem.canAttackDefenders(this.battleState.wallsState, attacker);
  }

  /**
   * Получить WallSegment по ID BattleUnit (для катапульты циклопов).
   */
  private getWallSegmentById(unitId: string): any {
    if (!this.battleState.wallsState) return null;
    const walls = this.battleState.wallsState;
    const segmentMap: Record<string, any> = {
      'wall_main_gate': walls.mainGate,
      'wall_upper_wall': walls.upperWall,
      'wall_lower_wall': walls.lowerWall,
      'tower_upper_tower': walls.upperTower,
      'tower_lower_tower': walls.lowerTower,
      'tower_keep_tower': walls.keepTower
    };
    return segmentMap[unitId] || null;
  }

  /**
   * Синхронизировать состояние wallUnit с wallsState (для визуализации).
   * Вызывается после нанесения урона стене/башне.
   */
  private syncWallState(wallUnit: BattleUnit): void {
    if (!this.battleState.wallsState) return;
    if (!wallUnit.isWall && !wallUnit.isTower) return;

    // Находим соответствующий сегмент в wallsState
    const walls = this.battleState.wallsState;
    const segmentMap: Record<string, any> = {
      'wall_main_gate': walls.mainGate,
      'wall_upper_wall': walls.upperWall,
      'wall_lower_wall': walls.lowerWall,
      'tower_upper_tower': walls.upperTower,
      'tower_lower_tower': walls.lowerTower,
      'tower_keep_tower': walls.keepTower
    };

    const segment = segmentMap[wallUnit.id];
    if (!segment) return;

    // Синхронизируем HP
    segment.currentHp = wallUnit.currentHealth;
    if (wallUnit.currentHealth <= 0) {
      segment.isDestroyed = true;
      wallUnit.count = 0;
      this.addLog(`💥 ${wallUnit.id.replace('wall_', '').replace('tower_', '').replace('_', ' ')} разрушена!`);
      this.updateWallVisuals();

      // Проверка: все стены разрушены?
      if (SiegeSystem.areWallsDestroyed(walls)) {
        this.addLog(`🏰🎉 Все стены разрушены! Защитники больше не защищены!`);
      }
    }
  }

  private addLog(message: string): void {
    const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    this.logMessages.push(`[${time}] ${message}`);
    if (this.logMessages.length > 8) this.logMessages.shift();
    if (this.logText) {
      this.logText.setText(this.logMessages.join('\n'));
    }
    console.log(`[Battle] ${message}`);
  }
}
