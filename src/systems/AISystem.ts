/**
 * AI System — Полноценный искусственный интеллект противников на карте
 *
 * ИИ умеет:
 * - Строить здания в городе (по приоритетам)
 * - Нанимать существ (самые сильные доступные)
 * - Передавать армию из гарнизона герою
 * - Исследовать карту
 * - Атаковать героя игрока (если сильнее)
 * - Атаковать нейтральных существ
 * - Захватывать шахты
 * - Собирать артефакты и ресурсы
 * - Возвращаться в город при слабой армии
 */

import { CONFIG } from '../config';
import type { Hero, MapObject, Resources, Tile, ArmySlot, Building, Creature } from '../types';
import { Pathfinder } from '../utils/Pathfinder';
import { EventBus } from '../utils/EventBus';

// ============================================================================
// ТИПЫ
// ============================================================================

export interface AIPlayer {
  id: string;
  name: string;
  color: number;
  faction: string;
  hero: Hero;
  townId: string;
  resources: Resources;
  isActive: boolean;
  turnsPlayed: number;
  /** Цель на текущий ход (для визуализации) */
  currentGoal?: AIGoal;
}

export type AIGoalType =
  | 'attack_hero'
  | 'attack_creature'
  | 'capture_mine'
  | 'capture_town'
  | 'collect_artifact'
  | 'collect_resource'
  | 'explore'
  | 'return_to_town'
  | 'defend_town';

export interface AIGoal {
  type: AIGoalType;
  targetX: number;
  targetY: number;
  targetId?: string;
  priority: number;
  description: string;
}

export interface AITurnResult {
  aiId: string;
  actions: AIAction[];
  heroPosition: { x: number; y: number };
}

export interface AIAction {
  type: 'build' | 'hire' | 'move' | 'attack' | 'capture' | 'collect';
  description: string;
  position?: { x: number; y: number };
}

// ============================================================================
// КОНСТАНТЫ ПРИОРИТЕТОВ
// ============================================================================

const PRIORITIES = {
  ATTACK_WEAK_HERO: 150,      // Атаковать слабого героя игрока
  ATTACK_STRONG_HERO: 30,     // Атаковать сильного (рискованно)
  CAPTURE_ENEMY_TOWN: 140,    // Захватить вражеский город
  CAPTURE_MINE: 90,           // Захватить шахту
  DEFEND_OWN_TOWN: 120,       // Защитить свой город
  COLLECT_ARTIFACT: 75,       // Собрать артефакт
  COLLECT_RESOURCE: 60,       // Собрать ресурс
  ATTACK_CREATURE: 70,        // Атаковать нейтральных существ
  EXPLORE: 40,                // Исследовать
  RETURN_TO_TOWN: 20,         // Вернуться в город (при слабой армии)
  BUILD_CRITICAL: 100,        // Построить критическое здание
  BUILD_NORMAL: 50,           // Построить обычное
  HIRE_STRONG: 85             // Нанять сильных существ
};

// Порядок строительства для ИИ (по приоритету)
const AI_BUILD_PRIORITY = [
  'citadel',              // Цитадель — базовая защита
  'barracks',             // Казармы — ополченцы
  'archery_range',        // Стрельбище — лучники
  'blacksmith',           // Кузница — артефакты
  'marketplace',          // Рынок — экономика
  'griffin_tower',        // Башня грифонов
  'cathedral',            // Собор — ангелы
  'mage_guild_1',         // Гильдия магов
  'walls',                // Стены
  'cursed_temple',        // Некрополис — скелеты
  'crypt',                // Склеп — зомби
  'mausoleum'             // Мавзолей — вампиры
];

// ============================================================================
// AI SYSTEM
// ============================================================================

export class AISystem {
  private aiPlayers: AIPlayer[] = [];
  private map: Tile[][];
  private objects: MapObject[];
  private pathfinder: Pathfinder;

  // Данные из JSON
  private buildingsData: Building[] = [];
  private creaturesData: Creature[] = [];

  // Внешние ссылки (устанавливаются через setReferences)
  private getVictorySystem: () => any;
  private getPlayerHero: () => Hero;
  private getPlayerPosition: () => { x: number; y: number };
  private getTownData: (townId: string) => any;
  private onAIAttackHero?: (aiHero: Hero) => void;
  private onAIAttackCreature?: (aiHero: Hero, creatureId: string) => void;
  private onAIMove?: (aiId: string, x: number, y: number) => void;
  private onAICaptureTown?: (aiId: string, townId: string) => void;
  private onAICaptureMine?: (aiId: string, mineId: string) => void;
  private onAINotification?: (message: string) => void;

  constructor(
    map: Tile[][],
    objects: MapObject[],
    refs: {
      getVictorySystem: () => any;
      getPlayerHero: () => Hero;
      getPlayerPosition: () => { x: number; y: number };
      getTownData: (townId: string) => any;
      onAIAttackHero?: (aiHero: Hero) => void;
      onAIAttackCreature?: (aiHero: Hero, creatureId: string) => void;
      onAIMove?: (aiId: string, x: number, y: number) => void;
      onAICaptureTown?: (aiId: string, townId: string) => void;
      onAICaptureMine?: (aiId: string, mineId: string) => void;
      onAINotification?: (message: string) => void;
    }
  ) {
    this.map = map;
    this.objects = objects;
    this.pathfinder = new Pathfinder(map);
    this.getVictorySystem = refs.getVictorySystem;
    this.getPlayerHero = refs.getPlayerHero;
    this.getPlayerPosition = refs.getPlayerPosition;
    this.getTownData = refs.getTownData;
    this.onAIAttackHero = refs.onAIAttackHero;
    this.onAIAttackCreature = refs.onAIAttackCreature;
    this.onAIMove = refs.onAIMove;
    this.onAICaptureTown = refs.onAICaptureTown;
    this.onAICaptureMine = refs.onAICaptureMine;
    this.onAINotification = refs.onAINotification;

    this.loadData();
  }

  // =========================================================================
  // ЗАГРУЗКА ДАННЫХ
  // =========================================================================

  private loadData(): void {
    // Пытаемся загрузить buildings.json
    try {
      const buildingsCache = localStorage.getItem('buildings_json');
      if (buildingsCache) {
        this.buildingsData = JSON.parse(buildingsCache);
      } else {
        // Fallback данные
        this.buildingsData = this.getDefaultBuildings();
      }
    } catch {
      this.buildingsData = this.getDefaultBuildings();
    }

    // Пытаемся загрузить creatures.json
    try {
      const creaturesCache = localStorage.getItem('creatures_json');
      if (creaturesCache) {
        this.creaturesData = JSON.parse(creaturesCache);
      } else {
        this.creaturesData = this.getDefaultCreatures();
      }
    } catch {
      this.creaturesData = this.getDefaultCreatures();
    }

    console.log(`[AI] Загружено ${this.buildingsData.length} зданий и ${this.creaturesData.length} существ`);
  }

  private getDefaultBuildings(): Building[] {
    return [
      { id: 'citadel', name: 'Цитадель', description: 'Основное здание', cost: { gold: 2000, wood: 5, ore: 5 }, requires: [], faction: 'common', category: 'infrastructure' },
      { id: 'barracks', name: 'Казармы', description: 'Ополченцы', cost: { gold: 1000, wood: 3 }, requires: ['citadel'], faction: 'haven', category: 'creature', creature: 'pikeman', tier: 1 },
      { id: 'archery_range', name: 'Стрельбище', description: 'Лучники', cost: { gold: 2000, wood: 5 }, requires: ['barracks'], faction: 'haven', category: 'creature', creature: 'archer', tier: 2 },
      { id: 'griffin_tower', name: 'Башня грифонов', description: 'Грифоны', cost: { gold: 3000, wood: 3, ore: 2 }, requires: ['barracks'], faction: 'haven', category: 'creature', creature: 'griffin', tier: 3 },
      { id: 'blacksmith', name: 'Кузница', description: 'Артефакты', cost: { gold: 1500, wood: 3, ore: 5 }, requires: ['citadel'], faction: 'common', category: 'infrastructure' },
      { id: 'marketplace', name: 'Рынок', description: 'Обмен ресурсов', cost: { gold: 1000, wood: 5 }, requires: ['citadel'], faction: 'common', category: 'economy' },
      { id: 'cathedral', name: 'Собор', description: 'Ангелы', cost: { gold: 10000, crystal: 5 }, requires: ['griffin_tower'], faction: 'haven', category: 'creature', creature: 'angel', tier: 7 },
      { id: 'mage_guild_1', name: 'Гильдия магов', description: 'Заклинания 1 уровня', cost: { gold: 2000, wood: 3, crystal: 2 }, requires: ['citadel'], faction: 'common', category: 'magic' },
      { id: 'walls', name: 'Стены', description: 'Защита города', cost: { gold: 3000, ore: 10 }, requires: ['citadel'], faction: 'common', category: 'defense' },
      // Некрополис
      { id: 'cursed_temple', name: 'Проклятый храм', description: 'Скелеты', cost: { gold: 800, wood: 2, ore: 2 }, requires: ['citadel'], faction: 'necropolis', category: 'creature', creature: 'skeleton', tier: 1 },
      { id: 'crypt', name: 'Склеп', description: 'Зомби', cost: { gold: 1500, ore: 3 }, requires: ['cursed_temple'], faction: 'necropolis', category: 'creature', creature: 'zombie', tier: 2 },
      { id: 'mausoleum', name: 'Мавзолей', description: 'Вампиры', cost: { gold: 3000, ore: 3, mercury: 2 }, requires: ['crypt'], faction: 'necropolis', category: 'creature', creature: 'vampire', tier: 4 }
    ] as Building[];
  }

  private getDefaultCreatures(): any[] {
    return [
      { id: 'pikeman', name: 'Ополченец', cost: { gold: 60 }, attack: 4, defense: 5, hp: 10, speed: 4, damage: [1, 3], tier: 1 },
      { id: 'archer', name: 'Лучник', cost: { gold: 100 }, attack: 6, defense: 3, hp: 8, speed: 4, damage: [2, 4], tier: 2 },
      { id: 'griffin', name: 'Грифон', cost: { gold: 200 }, attack: 8, defense: 8, hp: 20, speed: 6, damage: [3, 6], tier: 3 },
      { id: 'angel', name: 'Ангел', cost: { gold: 1200 }, attack: 20, defense: 20, hp: 100, speed: 10, damage: [50, 50], tier: 7 },
      { id: 'skeleton', name: 'Скелет', cost: { gold: 50 }, attack: 4, defense: 3, hp: 6, speed: 4, damage: [1, 2], tier: 1 },
      { id: 'zombie', name: 'Зомби', cost: { gold: 70 }, attack: 5, defense: 4, hp: 14, speed: 3, damage: [2, 3], tier: 2 },
      { id: 'vampire', name: 'Вампир', cost: { gold: 360 }, attack: 10, defense: 9, hp: 30, speed: 6, damage: [5, 8], tier: 4 },
      { id: 'wolf', name: 'Волк', cost: { gold: 100 }, attack: 6, defense: 4, hp: 12, speed: 6, damage: [2, 4], tier: 2 },
      { id: 'goblin', name: 'Гоблин', cost: { gold: 40 }, attack: 3, defense: 2, hp: 5, speed: 5, damage: [1, 2], tier: 1 },
      { id: 'orc', name: 'Орк', cost: { gold: 150 }, attack: 8, defense: 5, hp: 15, speed: 4, damage: [3, 5], tier: 3 }
    ];
  }

  // =========================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // =========================================================================

  public initAIPlayers(towns: any[], startHeroes: Hero[] = []): void {
    const aiColors = [0xff4444, 0x44ff44, 0x4444ff, 0xff44ff];
    const names = ['Красный Лорд', 'Зелёный Вождь', 'Синий Маг', 'Пурпурный Тиран'];

    for (let i = 0; i < Math.min(4, towns.length); i++) {
      const town = towns[i];
      const hero = startHeroes[i] || this.createDefaultAIHero(i, names[i], town);

      const aiPlayer: AIPlayer = {
        id: `ai_${i}`,
        name: names[i],
        color: aiColors[i],
        faction: town.faction || 'necropolis',
        hero,
        townId: town.id,
        resources: {
          gold: 8000,
          wood: 30,
          ore: 30,
          crystal: 10,
          gems: 10,
          sulfur: 5,
          mercury: 5
        },
        isActive: true,
        turnsPlayed: 0
      };

      this.aiPlayers.push(aiPlayer);
    }

    console.log(`[AI] Инициализировано ${this.aiPlayers.length} противников`);
  }

  private createDefaultAIHero(index: number, name: string, town: any): Hero {
    const isNecro = town.faction === 'necropolis';
    return {
      id: `ai_hero_${index}`,
      name: name,
      class: isNecro ? 'Некромант' : 'Рыцарь',
      faction: town.faction || 'necropolis',
      level: 1,
      experience: 0,
      stats: {
        attack: 2,
        defense: 2,
        spellPower: isNecro ? 3 : 1,
        knowledge: isNecro ? 3 : 1,
        morale: 0,
        luck: 0
      },
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
      x: town.x,
      y: town.y,
      movementPoints: 1500
    };
  }

  // =========================================================================
  // ХОД ИИ
  // =========================================================================

  public executeTurn(): AITurnResult[] {
    const results: AITurnResult[] = [];

    for (const ai of this.aiPlayers) {
      if (!ai.isActive) continue;

      console.log(`[AI] === Ход ${ai.name} ===`);

      // Восстанавливаем очки движения
      ai.hero.movementPoints = 1500;

      const actions: AIAction[] = [];

      // === ФАЗА 1: Город (стройка + найм) ===
      const cityActions = this.cityPhase(ai);
      actions.push(...cityActions);

      // === ФАЗА 2: Карта ===
      const mapActions = this.mapPhase(ai);
      actions.push(...mapActions);

      results.push({
        aiId: ai.id,
        actions,
        heroPosition: { x: ai.hero.x!, y: ai.hero.y! }
      });

      ai.turnsPlayed++;
    }

    EventBus.emit('ai:turn-complete', { results });
    return results;
  }

  // =========================================================================
  // ФАЗА 1: ГОРОД
  // =========================================================================

  private cityPhase(ai: AIPlayer): AIAction[] {
    const actions: AIAction[] = [];
    const townData = this.getTownData(ai.townId);
    if (!townData) return actions;

    // 1. Передаём армию из гарнизона герою
    const transferActions = this.transferGarrisonToHero(ai, townData);
    actions.push(...transferActions);

    // 2. Строим здания (по приоритетам, максимум 2 за ход)
    const built = this.tryBuildBuildings(ai, townData);
    actions.push(...built);

    // 3. Нанимаем существ (всё что можем)
    const hired = this.tryHireCreatures(ai, townData);
    actions.push(...hired);

    // 4. Передаём новую армию герою
    const transferActions2 = this.transferGarrisonToHero(ai, townData);
    actions.push(...transferActions2);

    return actions;
  }

  /**
   * Передать армию из гарнизона герою
   */
  private transferGarrisonToHero(ai: AIPlayer, townData: any): AIAction[] {
    const actions: AIAction[] = [];
    if (!townData.garrison || townData.garrison.length === 0) return actions;

    // Передаём всё из гарнизона герою
    for (const garrisonSlot of townData.garrison) {
      if (garrisonSlot.count <= 0) continue;

      const existingSlot = ai.hero.army.find(s => s.creatureId === garrisonSlot.creatureId);
      if (existingSlot) {
        existingSlot.count += garrisonSlot.count;
      } else {
        ai.hero.army.push({ ...garrisonSlot });
      }

      actions.push({
        type: 'hire',
        description: `${ai.name} передал ${garrisonSlot.count} ${garrisonSlot.creatureId} герою`
      });

      console.log(`[AI] ${ai.name}: передано ${garrisonSlot.count} ${garrisonSlot.creatureId} из гарнизона`);
    }

    // Очищаем гарнизон
    townData.garrison = [];
    return actions;
  }

  /**
   * Попытка построить здания (максимум 2 за ход)
   */
  private tryBuildBuildings(ai: AIPlayer, townData: any): AIAction[] {
    const actions: AIAction[] = [];
    const faction = townData.faction || ai.faction;
    let builtThisTurn = 0;
    const MAX_BUILDS_PER_TURN = 2;

    for (const buildingId of AI_BUILD_PRIORITY) {
      if (builtThisTurn >= MAX_BUILDS_PER_TURN) break;

      // Уже построено?
      if (townData.builtBuildings.includes(buildingId)) continue;

      // Находим данные о здании
      const building = this.buildingsData.find(b => b.id === buildingId);
      if (!building) continue;

      // Здание другой фракции?
      if (building.faction && building.faction !== 'common' && building.faction !== faction) continue;

      // Требования выполнены?
      if (building.requires) {
        const canBuild = building.requires.every(req => townData.builtBuildings.includes(req));
        if (!canBuild) continue;
      }

      // Хватает ресурсов?
      if (!this.canAfford(ai.resources, building.cost)) continue;

      // СТРОИМ!
      this.spendResources(ai.resources, building.cost);
      townData.builtBuildings.push(buildingId);
      builtThisTurn++;

      // Если здание открывает существо — добавляем прирост
      if (building.creature) {
        const creature = this.creaturesData.find(c => c.id === building.creature);
        if (creature) {
          if (!townData.availableForHire) townData.availableForHire = [];
          const existing = townData.availableForHire.find((s: ArmySlot) => s.creatureId === building.creature);
          if (existing) {
            existing.count += creature.growth || 5;
          } else {
            townData.availableForHire.push({
              creatureId: building.creature,
              count: creature.growth || 5
            });
          }
        }
      }

      actions.push({
        type: 'build',
        description: `${ai.name} построил ${building.name}`
      });

      this.notify(`🏗️ ${ai.name} построил ${building.name}`);
      console.log(`[AI] ${ai.name} построил ${building.name}`);
    }

    return actions;
  }

  /**
   * Попытка нанять существ (всё что доступно)
   */
  private tryHireCreatures(ai: AIPlayer, townData: any): AIAction[] {
    const actions: AIAction[] = [];
    if (!townData.availableForHire) return actions;

    // Сортируем по силе (tier)
    const sorted = [...townData.availableForHire].sort((a, b) => {
      const cA = this.creaturesData.find(c => c.id === a.creatureId);
      const cB = this.creaturesData.find(c => c.id === b.creatureId);
      return ((cB?.tier as number) || 1) - ((cA?.tier as number) || 1);
    });

    for (const slot of sorted) {
      if (slot.count <= 0) continue;

      const creature = this.creaturesData.find(c => c.id === slot.creatureId);
      if (!creature) continue;

      const cost = creature.cost as Partial<Resources>;
      const unitCost = cost.gold || 100;

      // Сколько можем нанять?
      const maxAfford = Math.floor(ai.resources.gold / unitCost);
      const toHire = Math.min(slot.count, maxAfford);

      if (toHire <= 0) continue;

      // Нанимаем!
      const totalCost = { gold: unitCost * toHire };
      this.spendResources(ai.resources, totalCost);

      // Добавляем в гарнизон
      if (!townData.garrison) townData.garrison = [];
      const existing = townData.garrison.find((s: ArmySlot) => s.creatureId === slot.creatureId);
      if (existing) {
        existing.count += toHire;
      } else {
        townData.garrison.push({ creatureId: slot.creatureId, count: toHire });
      }

      slot.count -= toHire;

      actions.push({
        type: 'hire',
        description: `${ai.name} нанял ${toHire} ${creature.name}`
      });

      this.notify(`⚔️ ${ai.name} нанял ${toHire} ${creature.name}`);
      console.log(`[AI] ${ai.name} нанял ${toHire} ${creature.name} за ${totalCost.gold} зол`);
    }

    return actions;
  }

  // =========================================================================
  // ФАЗА 2: КАРТА
  // =========================================================================

  private mapPhase(ai: AIPlayer): AIAction[] {
    const actions: AIAction[] = [];

    // Генерируем все возможные цели
    const goals = this.generateGoals(ai);

    if (goals.length === 0) {
      console.log(`[AI] ${ai.name} не нашёл целей`);
      return actions;
    }

    // Сортируем по приоритету
    goals.sort((a, b) => b.priority - a.priority);

    // Выполняем цели пока есть очки движения
    let attempts = 0;
    while (ai.hero.movementPoints! > 100 && goals.length > 0 && attempts < 10) {
      attempts++;
      const goal = goals.shift()!;

      const success = this.executeGoal(ai, goal, actions);
      if (!success) {
        // Не получилось, пробуем следующую цель
        continue;
      }

      // Если это была атака героя игрока — останавливаем ход
      if (goal.type === 'attack_hero') {
        break;
      }
    }

    return actions;
  }

  /**
   * Генерация всех возможных целей
   */
  private generateGoals(ai: AIPlayer): AIGoal[] {
    const goals: AIGoal[] = [];
    const hero = ai.hero;
    const heroPower = this.calculateArmyPower(hero.army);

    // === 1. Защита своего города (если герой рядом) ===
    const myTown = this.getTownData(ai.townId);
    if (myTown) {
      const distToTown = this.distance(hero.x!, hero.y!, myTown.x, myTown.y);
      if (distToTown > 10 && heroPower < 200) {
        goals.push({
          type: 'return_to_town',
          targetX: myTown.x,
          targetY: myTown.y,
          targetId: ai.townId,
          priority: PRIORITIES.RETURN_TO_TOWN,
          description: 'Вернуться в город (слабая армия)'
        });
      }
    }

    // === 2. Атака героя игрока ===
    const playerHero = this.getPlayerHero();
    const playerPos = this.getPlayerPosition();
    const distToPlayer = this.distance(hero.x!, hero.y!, playerPos.x, playerPos.y);
    const playerPower = this.calculateArmyPower(playerHero.army);

    if (distToPlayer <= 20 && playerPower > 0) {
      if (heroPower > playerPower * 1.1) {
        // Мы сильнее — атакуем!
        goals.push({
          type: 'attack_hero',
          targetX: playerPos.x,
          targetY: playerPos.y,
          targetId: playerHero.id,
          priority: PRIORITIES.ATTACK_WEAK_HERO,
          description: `Атаковать героя игрока (сила: ${playerPower})`
        });
      } else if (heroPower > playerPower * 0.7 && distToPlayer <= 8) {
        // Равные силы — рискнём
        goals.push({
          type: 'attack_hero',
          targetX: playerPos.x,
          targetY: playerPos.y,
          targetId: playerHero.id,
          priority: PRIORITIES.ATTACK_STRONG_HERO,
          description: `Рискнуть атаковать героя игрока`
        });
      }
    }

    // === 3. Захват города игрока ===
    const victorySystem = this.getVictorySystem();
    if (victorySystem) {
      const playerTowns = victorySystem.getPlayerTowns();
      for (const town of playerTowns) {
        const dist = this.distance(hero.x!, hero.y!, town.x, town.y);
        if (dist <= 25) {
          goals.push({
            type: 'capture_town',
            targetX: town.x,
            targetY: town.y,
            targetId: town.id,
            priority: PRIORITIES.CAPTURE_ENEMY_TOWN - dist,
            description: `Захватить ${town.name}`
          });
        }
      }
    }

    // === 4. Захват нейтральных шахт ===
    if (victorySystem) {
      const allMines = victorySystem.getAllMines?.() || [];
      for (const mine of allMines) {
        if (mine.owner === 'ai') continue;
        const dist = this.distance(hero.x!, hero.y!, mine.x, mine.y);
        if (dist <= 18) {
          goals.push({
            type: 'capture_mine',
            targetX: mine.x,
            targetY: mine.y,
            targetId: mine.id,
            priority: PRIORITIES.CAPTURE_MINE - dist,
            description: `Захватить шахту (${dist} клеток)`
          });
        }
      }
    }

    // === 5. Атака нейтральных существ ===
    const neutralCreatures = this.objects.filter(obj =>
      obj.type === 'creature' &&
      this.distance(hero.x!, hero.y!, obj.x, obj.y) <= 15
    );
    for (const creature of neutralCreatures) {
      const dist = this.distance(hero.x!, hero.y!, creature.x, creature.y);
      goals.push({
        type: 'attack_creature',
        targetX: creature.x,
        targetY: creature.y,
        targetId: creature.id,
        priority: PRIORITIES.ATTACK_CREATURE - dist,
        description: `Атаковать ${creature.id}`
      });
    }

    // === 6. Сбор артефактов ===
    const artifacts = this.objects.filter(obj =>
      obj.type === 'artifact' &&
      this.distance(hero.x!, hero.y!, obj.x, obj.y) <= 12
    );
    for (const art of artifacts) {
      const dist = this.distance(hero.x!, hero.y!, art.x, art.y);
      goals.push({
        type: 'collect_artifact',
        targetX: art.x,
        targetY: art.y,
        targetId: art.id,
        priority: PRIORITIES.COLLECT_ARTIFACT - dist,
        description: `Подобрать артефакт`
      });
    }

    // === 7. Сбор ресурсов ===
    const resources = this.objects.filter(obj =>
      obj.type === 'resource' &&
      this.distance(hero.x!, hero.y!, obj.x, obj.y) <= 10
    );
    for (const res of resources) {
      const dist = this.distance(hero.x!, hero.y!, res.x, res.y);
      goals.push({
        type: 'collect_resource',
        targetX: res.x,
        targetY: res.y,
        targetId: res.id,
        priority: PRIORITIES.COLLECT_RESOURCE - dist,
        description: `Подобрать ресурс`
      });
    }

    // === 8. Исследование (если других целей нет) ===
    if (goals.length === 0) {
      const exploreTarget = this.findExploreTarget(hero);
      if (exploreTarget) {
        goals.push({
          type: 'explore',
          targetX: exploreTarget.x,
          targetY: exploreTarget.y,
          priority: PRIORITIES.EXPLORE,
          description: `Исследовать территорию`
        });
      }
    }

    return goals;
  }

  /**
   * Выполнение цели
   */
  private executeGoal(ai: AIPlayer, goal: AIGoal, actions: AIAction[]): boolean {
    const hero = ai.hero;
    const startX = hero.x!;
    const startY = hero.y!;

    // Путь к цели
    const path = this.pathfinder.findPath(
      { x: startX, y: startY },
      { x: goal.targetX, y: goal.targetY }
    );

    if (path.length === 0) {
      console.log(`[AI] Путь не найден к (${goal.targetX}, ${goal.targetY})`);
      return false;
    }

    // Двигаемся по пути (максимум 8 клеток или пока хватит MP)
    const maxSteps = Math.min(path.length, Math.floor(ai.hero.movementPoints! / 100));

    if (maxSteps === 0) return false;

    const destination = path[maxSteps - 1];
    const stepsTaken = maxSteps;

    // Двигаемся
    hero.x = destination.x;
    hero.y = destination.y;
    hero.movementPoints! -= stepsTaken * 100;

    actions.push({
      type: 'move',
      description: `Движение к (${goal.targetX}, ${goal.targetY})`,
      position: { x: hero.x, y: hero.y }
    });

    console.log(`[AI] ${ai.name}: ${goal.description} → (${hero.x}, ${hero.y})`);

    // Уведомляем WorldScene для анимации
    if (this.onAIMove) {
      this.onAIMove(ai.id, hero.x, hero.y);
    }

    // Проверяем, достигли ли цели
    const reachedTarget = hero.x === goal.targetX && hero.y === goal.targetY;
    if (!reachedTarget) return true; // Цель ещё не достигнута, но ход использован

    // === Действие на клетке ===
    switch (goal.type) {
      case 'attack_hero':
        return this.attackPlayerHero(ai, actions);

      case 'attack_creature':
        return this.attackNeutralCreature(ai, goal.targetId!, actions);

      case 'capture_town':
        return this.capturePlayerTown(ai, goal.targetId!, actions);

      case 'capture_mine':
        return this.captureMine(ai, goal.targetId!, actions);

      case 'collect_artifact':
        return this.collectObject(ai, goal.targetId!, 'artifact', actions);

      case 'collect_resource':
        return this.collectObject(ai, goal.targetId!, 'resource', actions);
    }

    return true;
  }

  // =========================================================================
  // СПЕЦИФИЧНЫЕ ДЕЙСТВИЯ
  // =========================================================================

  private attackPlayerHero(ai: AIPlayer, actions: AIAction[]): boolean {
    const playerHero = this.getPlayerHero();
    const playerPos = this.getPlayerPosition();

    // Проверяем, что герой ещё тут
    if (playerPos.x !== ai.hero.x || playerPos.y !== ai.hero.y) {
      return false;
    }

    actions.push({
      type: 'attack',
      description: `${ai.name} атакует героя игрока!`,
      position: { x: ai.hero.x!, y: ai.hero.y! }
    });

    this.notify(`⚔️ ${ai.name} атакует вашего героя!`);

    if (this.onAIAttackHero) {
      this.onAIAttackHero(ai.hero);
    }

    return true;
  }

  private attackNeutralCreature(ai: AIPlayer, creatureId: string, actions: AIAction[]): boolean {
    const obj = this.objects.find(o => o.id === creatureId);
    if (!obj) return false;

    actions.push({
      type: 'attack',
      description: `${ai.name} атакует ${creatureId}`,
      position: { x: obj.x, y: obj.y }
    });

    // ИИ автоматически побеждает слабых нейтралов (без полноценного боя)
    const myPower = this.calculateArmyPower(ai.hero.army);
    if (myPower > 100) {
      // Удаляем существо с карты
      this.removeObjectFromMap(creatureId);

      // ИИ получает опыт
      ai.hero.experience += 200;
      this.checkLevelUp(ai.hero);

      this.notify(`⚔️ ${ai.name} победил ${creatureId}`);
      console.log(`[AI] ${ai.name} победил ${creatureId}`);
    }

    return true;
  }

  private capturePlayerTown(ai: AIPlayer, townId: string, actions: AIAction[]): boolean {
    const victorySystem = this.getVictorySystem();
    if (!victorySystem) return false;

    const result = victorySystem.captureTown(townId, 'ai');
    if (result.captured) {
      actions.push({
        type: 'capture',
        description: `${ai.name} захватил город!`,
        position: { x: ai.hero.x!, y: ai.hero.y! }
      });

      this.notify(`🚨 ${ai.name} ЗАХВАТИЛ ваш город!`);
      console.log(`[AI] ${ai.name} захватил город ${townId}`);

      if (this.onAICaptureTown) {
        this.onAICaptureTown(ai.id, townId);
      }
    }

    return result.captured;
  }

  private captureMine(ai: AIPlayer, mineId: string, actions: AIAction[]): boolean {
    const victorySystem = this.getVictorySystem();
    if (!victorySystem) return false;

    const captured = victorySystem.captureMine(mineId, 'ai');
    if (captured) {
      actions.push({
        type: 'capture',
        description: `${ai.name} захватил шахту`,
        position: { x: ai.hero.x!, y: ai.hero.y! }
      });

      this.notify(`⛏️ ${ai.name} захватил вашу шахту!`);
      console.log(`[AI] ${ai.name} захватил шахту ${mineId}`);

      if (this.onAICaptureMine) {
        this.onAICaptureMine(ai.id, mineId);
      }
    }

    return captured;
  }

  private collectObject(ai: AIPlayer, objectId: string, type: string, actions: AIAction[]): boolean {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return false;

    actions.push({
      type: 'collect',
      description: `${ai.name} подобрал ${type}`,
      position: { x: obj.x, y: obj.y }
    });

    if (type === 'resource') {
      const amount = Math.floor(Math.random() * 1500) + 500; // 500-2000
      ai.resources.gold += amount;
      console.log(`[AI] ${ai.name} получил ${amount} золота`);
    }

    if (type === 'artifact') {
      // Случайный артефакт
      const artifacts = ['Меч силы', 'Щит защиты', 'Кольцо мудрости'];
      const artName = artifacts[Math.floor(Math.random() * artifacts.length)];
      ai.hero.stats.attack += 1;
      console.log(`[AI] ${ai.name} нашёл ${artName}`);
    }

    this.removeObjectFromMap(objectId);
    return true;
  }

  private removeObjectFromMap(id: string): void {
    // Удаляем из objects
    const idx = this.objects.findIndex(o => o.id === id);
    if (idx !== -1) {
      const obj = this.objects[idx];
      // Удаляем с карты
      if (this.map[obj.y]?.[obj.x]) {
        this.map[obj.y][obj.x].object = undefined;
      }
      this.objects.splice(idx, 1);
    }
  }

  // =========================================================================
  // ВСПОМОГАТЕЛЬНЫЕ
  // =========================================================================

  private calculateArmyPower(army: ArmySlot[]): number {
    let power = 0;
    for (const slot of army) {
      const creature = this.creaturesData.find(c => c.id === slot.creatureId);
      if (creature) {
        const tier = (creature as any).tier || 1;
        const attack = (creature as any).attack || 5;
        const defense = (creature as any).defense || 5;
        const hp = (creature as any).hp || 10;
        power += (attack + defense + hp / 2 + tier * 5) * slot.count;
      } else {
        power += 10 * slot.count;
      }
    }
    return Math.floor(power);
  }

  private checkLevelUp(hero: Hero): void {
    const expToLevel = hero.level * 500;
    if (hero.experience >= expToLevel) {
      hero.level++;
      hero.stats.attack += 1;
      hero.stats.defense += 1;
      console.log(`[AI] ${hero.name} достиг уровня ${hero.level}!`);
    }
  }

  private distance(x1: number, y1: number, x2: number, y2: number): number {
    return Math.max(Math.abs(x1 - x2), Math.abs(y1 - y2));
  }

  private findExploreTarget(hero: Hero): { x: number; y: number } | null {
    const radius = 15;
    const candidates: { x: number; y: number }[] = [];

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = hero.x! + dx;
        const y = hero.y! + dy;

        if (x < 0 || x >= this.map[0].length) continue;
        if (y < 0 || y >= this.map.length) continue;

        const tile = this.map[y][x];
        if (tile.passable && !tile.object) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) return null;

    // Выбираем случайную
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private canAfford(resources: Resources, cost: Partial<Resources>): boolean {
    if (cost.gold && resources.gold < cost.gold) return false;
    if (cost.wood && resources.wood < cost.wood) return false;
    if (cost.ore && resources.ore < cost.ore) return false;
    if (cost.crystal && resources.crystal < cost.crystal) return false;
    if (cost.gems && resources.gems < cost.gems) return false;
    if (cost.sulfur && resources.sulfur < cost.sulfur) return false;
    if (cost.mercury && resources.mercury < cost.mercury) return false;
    return true;
  }

  private spendResources(resources: Resources, cost: Partial<Resources>): void {
    if (cost.gold) resources.gold -= cost.gold;
    if (cost.wood) resources.wood -= cost.wood;
    if (cost.ore) resources.ore -= cost.ore;
    if (cost.crystal) resources.crystal -= cost.crystal;
    if (cost.gems) resources.gems -= cost.gems;
    if (cost.sulfur) resources.sulfur -= cost.sulfur;
    if (cost.mercury) resources.mercury -= cost.mercury;
  }

  private notify(message: string): void {
    if (this.onAINotification) {
      this.onAINotification(message);
    }
  }

  // =========================================================================
  // ГЕТТЕРЫ
  // =========================================================================

  public getAIPlayers(): AIPlayer[] {
    return this.aiPlayers;
  }

  public getAIPlayer(id: string): AIPlayer | undefined {
    return this.aiPlayers.find(ai => ai.id === id);
  }

  public removeAIPlayer(id: string): void {
    this.aiPlayers = this.aiPlayers.filter(ai => ai.id !== id);
  }

  public getArmyPower(hero: Hero): number {
    return this.calculateArmyPower(hero.army);
  }
}
