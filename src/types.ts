// ============================================================================
// Heroes of Might and Magic IV — TypeScript Type Definitions
// Канон HoMM4: 6 фракций, 5 школ магии (Life/Death/Order/Chaos/Natural),
// герои участвуют в бою, двухуровневая карта, корабли
// ============================================================================

// ============================================================================
// БАЗОВЫЕ ТИПЫ (type aliases)
// ============================================================================

/** Типы владельцев */
export type OwnerType = 'player' | 'ai' | 'neutral';

/** ID фракций существ и городов (канон HoMM4) */
export type FactionId =
  | 'haven'
  | 'necropolis'
  | 'preserve'
  | 'asylum'
  | 'academy'
  | 'stronghold'
  | 'neutral';

/** Типы тайлов карты (канон HoMM4 + подземелье) */
export type TileType =
  | 'grass'
  | 'sand'
  | 'snow'
  | 'swamp'
  | 'lava'
  | 'forest'
  | 'water'
  | 'rock'
  // Подземелье
  | 'cave_floor'
  | 'cave_rock'
  | 'underground_lake'
  | 'mushroom_grove'
  | 'subterranean_river';

/** Типы объектов на карте (канон HoMM4 + подземелье + море) */
export type MapObjectType =
  // Основные
  | 'town'
  | 'enemy_town'
  | 'mine'
  | 'artifact'
  | 'resource'
  | 'portal'
  | 'creature'
  // Здания на карте
  | 'school'
  | 'shrine'
  | 'altar'
  | 'obelisk'
  | 'tavern'
  | 'witch_hut'
  | 'treasure_chest'
  | 'refugee_camp'
  | 'garrison'
  | 'library'
  | 'magic_well'
  | 'oasis'
  | 'windmill'
  | 'water_wheel'
  // Морские (канон HoMM4)
  | 'boat'
  | 'shipyard'
  | 'whirlpool'
  | 'sea_chest'
  | 'flotsam'
  | 'bottle'
  | 'shipwreck'
  | 'sea_monster'
  // Подземелье
  | 'subterranean_gate'
  // Магия
  | 'magic_scroll'
  // Прочее
  | 'observatory';

/** Категории навыков героев (канон HoMM4) */
export type SkillCategory = 'combat' | 'magic' | 'adventure' | 'economy' | 'exploration';

/** Редкость артефактов (канон HoMM4) */
export type ArtifactRarity = 'minor' | 'major' | 'relic';

/** Категории зданий (канон HoMM4) */
export type BuildingCategory = 'dwelling' | 'economic' | 'military' | 'magic' | 'special' | 'upgrade' | 'defense' | 'infrastructure' | 'economy';

/** Школы магии HoMM4 (канон: Life, Death, Order, Chaos, Natural, Tactics) */
export type SpellSchool = 'life' | 'death' | 'order' | 'chaos' | 'natural' | 'tactics';

/** Уровень карты (поверхность или подземелье) */
export type MapLevel = 'surface' | 'underground';

/** Тип ресурса */
export type ResourceType = 'gold' | 'wood' | 'ore' | 'crystal' | 'gems' | 'sulfur' | 'mercury';

/** Тип шахты */
export type MineType = 'gold' | 'wood' | 'ore' | 'crystal' | 'gems' | 'sulfur' | 'mercury';

/** Фазы боя (канон HoMM4) */
export type BattlePhase =
  | 'attacker_move'
  | 'attacker_action'
  | 'action'
  | 'defender_response'
  | 'defender_move'
  | 'defender_action'
  | 'turn_end';

/** Классы героев (канон HoMM4) */
export type HeroClass =
  | 'knight'
  | 'cleric'
  | 'death_knight'
  | 'necromancer'
  | 'ranger'
  | 'druid'
  | 'demoniac'
  | 'heretic'
  | 'wizard'
  | 'barbarian';

/** Тип слота экипировки */
export type EquipmentSlot = keyof Equipment;

/** Тип цели заклинания */
export type SpellTarget = 'single' | 'area' | 'all' | 'self';

/** Типы целей ИИ */
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

/** Условие победы */
export type VictoryCondition =
  | { type: 'defeat_all_enemies' }
  | { type: 'capture_all_towns' }
  | { type: 'accumulate_gold'; amount: number };

/** Условие поражения */
export type DefeatCondition =
  | { type: 'lose_all_heroes_and_towns' }
  | { type: 'lose_all_towns' }
  | { type: 'day_limit'; days: number };

/** Типы специальных недель (HoMM4 mechanics) */
export type SpecialWeekType =
  | 'normal'
  | 'creature_growth'
  | 'mana_regen'
  | 'movement_boost'
  | 'gold_abundance'
  | 'lucky_week'
  | 'morale_boost'
  | 'spell_power'
  | 'defense_week'
  | 'attack_week'
  | 'creature_tier_up'
  | 'necromancy_boost'
  | 'dimension_door'
  | 'free_hire'
  | 'experience_boost';

/** Тип корабля (в HoMM4 был только один тип - boat) */
export type ShipType = 'boat';

// ============================================================================
// БАЗОВЫЕ ИНТЕРФЕЙСЫ
// ============================================================================

/** Позиция на карте */
export interface Position {
  x: number;
  y: number;
}

/** Опции для добавления объектов */
export interface Options {
  add?: boolean;
  depth?: number;
}

// ============================================================================
// РЕСУРСЫ
// ============================================================================

/** Игровые ресурсы */
export interface Resources {
  gold: number;
  wood: number;
  ore: number;
  crystal: number;
  gems: number;
  sulfur: number;
  mercury: number;
}

// ============================================================================
// КАРТА И ТАЙЛЫ
// ============================================================================

/** Клетка карты приключений */
export interface Tile {
  /** Тип тайла */
  type: TileType;
  /** Стоимость движения по тайлу */
  moveCost: number;
  /** Клетка была когда-либо открыта игроком */
  revealed: boolean;
  /** Клетка видна прямо сейчас */
  visible: boolean;
  /** Клетка была посещена героем */
  visited: boolean;
  /** Объект на клетке */
  object?: MapObject;
  /** Путь через эту клетку заблокирован */
  blocked?: boolean;
  /** Проходимость для пешего героя */
  passable: boolean;
  /** Проходимость для летающих существ */
  flyable: boolean;
  /** Позиция X */
  x: number;
  /** Позиция Y */
  y: number;
  /** Уровень карты (surface или underground) */
  level?: MapLevel;
}

/** Объект на карте */
export interface MapObject {
  /** Уникальный ID объекта */
  id: string;
  /** Тип объекта */
  type: MapObjectType;
  /** Позиция X */
  x: number;
  /** Позиция Y */
  y: number;
  /** Дополнительный подтип */
  subtype?: string;
  /** Владелец (для шахт и городов) */
  owner?: string;
  /** Произвольные данные объекта */
  data?: any;
  /** Уровень карты */
  level?: MapLevel;
  /** ID парного портала */
  pairedGateId?: string;
}

// ============================================================================
// ГЕРОИ И НАВЫКИ
// ============================================================================

/** Характеристики героя */
export interface HeroStats {
  attack: number;
  defense: number;
  spellPower: number;
  knowledge: number;
  /** Текущее HP героя (HoMM4: зависит от класса и уровня) */
  hp?: number;
  /** Максимальное HP героя */
  maxHp?: number;
  /** Мораль (базовая) */
  morale?: number;
  /** Удача (базовая) */
  luck?: number;
}

/** Эффект навыка */
export interface SkillEffect {
  type: string;
  value: number;
}

/** Навык героя */
export interface HeroSkill {
  id: string;
  name: string;
  level: number;
  category: SkillCategory;
  effects: SkillEffect[];
}

/** Герой */
export interface Hero {
  id: string;
  name: string;
  class: string;
  faction: string;
  level: number;
  experience: number;
  x?: number;
  y?: number;
  movementPoints?: number;
  maxMovementPoints?: number;
  stats: HeroStats;
  skills: HeroSkill[];
  skillsMap?: Map<string, HeroSkill>;
  mana: number;
  maxMana: number;
  army: ArmySlot[];
  equipment: Equipment;
  spells: string[];
  /** Магические свитки (одноразовые артефакты, канон HoMM4) */
  scrolls?: any[];
  morale?: number;
  luck?: number;
  owner?: 'player' | 'enemy';
  specialization?: string;
  sprite?: any;
  /** Уровень карты */
  mapLevel?: MapLevel;
  /** ID корабля, на котором находится герой */
  onShipId?: string | null;
  /** Эффект Water Walk */
  waterWalk?: boolean;
  /** Эффект Fly */
  flyAdventure?: boolean;
}

// ============================================================================
// АРТЕФАКТЫ И ЭКИПИРОВКА
// ============================================================================

/** Артефакт */
export interface Artifact {
  id: string;
  name: string;
  rarity: ArtifactRarity;
  description: string;
  bonuses: Array<{ type: string; value: number }>;
  cost?: Partial<Resources>;
  tier?: number;
}

/** Слот экипировки */
export interface Equipment {
  head?: Artifact;
  neck?: Artifact;
  body?: Artifact;
  leftHand?: Artifact;
  rightHand?: Artifact;
  leftRing?: Artifact;
  rightRing?: Artifact;
  feet?: Artifact;
  misc1?: Artifact;
  misc2?: Artifact;
}

// ============================================================================
// ФРАКЦИИ
// ============================================================================

/** Фракция (полные данные) */
export interface Faction {
  id: string;
  name: string;
  description: string;
  heroClasses?: string[];
  startingHero?: string;
  townName?: string;
}

// ============================================================================
// ГОРОДА И ЗДАНИЯ
// ============================================================================

/** Здание в городе */
export interface Building {
  id: string;
  name: string;
  description: string;
  cost: Partial<Resources>;
  requires: string[];
  requirements?: string[];
  faction: string;
  category: BuildingCategory;
  creature?: string;
  tier?: number;
  creatureGrowth?: number | { creatureId: string; amount: number; min?: number; max?: number };
  nameEn?: string;
  type?: string;
  provides?: string[];
}

/** Город */
export interface Town {
  id: string;
  name: string;
  faction: string;
  x: number;
  y: number;
  owner: OwnerType;
  builtBuildings: string[];
  garrison: ArmySlot[];
  resources?: Resources;
  mageGuildLevel?: number;
  mageGuildOffers?: string[];
  tavernHeroes?: any[];
  availableForHire?: ArmySlot[];
  dailyIncome?: number;
}

// ============================================================================
// СУЩЕСТВА И АРМИЯ
// ============================================================================

/** Отряд существ в армии */
export interface ArmySlot {
  creatureId: string;
  count: number;
  maxCount?: number;
}

/** Отряд существ (расширенный) */
export interface ArmyUnit {
  creatureId: string;
  count: number;
  creature?: Creature;
}

/** Данные существа из JSON */
export interface Creature {
  id: string;
  name: string;
  nameEn?: string;
  cost: Partial<Resources>;
  attack: number;
  defense: number;
  hp: number;
  health?: number;
  speed: number;
  damage: [number, number];
  tier: number;
  growth?: number;
  abilities?: string[];
  faction: string;
  type?: string;
  shots?: number;
  damageMin?: number;
  damageMax?: number;
  upgradeTo?: string;
}

/** Статы существа (для быстрой передачи в бой) */
export interface CreatureStats {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  damage: { min: number; max: number };
  shots?: number;
  abilities?: string[];
  faction?: string;
  type?: string;
  tier?: number;
  damageMin?: number;
  damageMax?: number;
}

// ============================================================================
// МАГИЯ
// ============================================================================

/** Эффект заклинания */
export interface SpellEffect {
  type: string;
  value: number;
  description?: string;
}

/** Заклинание */
export interface Spell {
  id: string;
  name: string;
  school: SpellSchool;
  manaCost: number;
  description: string;
  target: SpellTarget;
  effects: SpellEffect[];
}

// ============================================================================
// БОЙ
// ============================================================================

/** Эффект заклинания на юните */
export interface SpellBuff {
  spellId: string;
  duration: number;
  value: number;
}

/** Боевой эффект */
export interface BattleEffect {
  spellId: string;
  duration: number;
  value: number;
}

/** Юнит в бою */
export interface BattleUnit {
  id: string;
  creatureId: string;
  creature?: Creature;
  count: number;
  initialCount?: number;
  currentHealth: number;
  maxHealth: number;
  x: number;
  y: number;
  side: 'attacker' | 'defender';
  hasActed: boolean;
  hasRetaliated: boolean;
  effects: SpellBuff[];
  isHero?: boolean;
  isWall?: boolean;
  isTower?: boolean;
  wallHp?: number;
  speed?: number;
  shotsLeft?: number;
  originalArmyIndex?: number;
  heroId?: string;
  moved?: boolean;
  acted?: boolean;
  retaliations?: number;
  maxRetaliations?: number;
}

/** Сегмент стены */
export interface WallSegment {
  id: string;
  type: 'gate' | 'wall' | 'tower';
  currentHp: number;
  maxHp: number;
  x: number;
  y: number;
  isDestroyed: boolean;
}

/** Состояние стен при осаде */
export interface WallsState {
  mainGate: WallSegment;
  upperWall: WallSegment;
  lowerWall: WallSegment;
  keepTower: WallSegment;
  upperTower: WallSegment;
  lowerTower: WallSegment;
}

/** Результат боя */
export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw';
  experienceGained: number;
  deadEnemies: BattleUnit[];
  losses: BattleUnit[];
  armyLosses?: ArmyLoss[];
}

/** Потеря армии */
export interface ArmyLoss {
  creatureId: string;
  lost: number;
  lostCount?: number;
  remaining?: number;
}

/** Состояние боя */
export interface BattleState {
  units: BattleUnit[];
  attackerHero?: Hero | null;
  defenderHero?: Hero | null;
  currentTurn?: number;
  result?: BattleResult;
  currentUnitIndex?: number;
  turn?: number;
  wallsState?: WallsState;
  phase?: BattlePhase;
  obstacles?: any[];
  isSiege?: boolean;
  battleType?: string;
}

// ============================================================================
// НЕКРОМАНТИЯ
// ============================================================================

/** Результат применения некромантии */
export interface NecromancyResult {
  raisedUnits: ArmySlot[];
  totalDeadConverted: number;
  necromancyPower: number;
}

// ============================================================================
// СИСТЕМЫ ВЛАДЕНИЯ
// ============================================================================

/** Владение городом */
export interface TownOwnership {
  id: string;
  name: string;
  faction: string;
  x: number;
  y: number;
  owner: OwnerType;
  builtBuildings: string[];
  garrison: ArmySlot[];
  availableForHire: ArmySlot[];
  lastGrowthDay: number;
}

/** Шахта */
export interface Mine {
  id: string;
  x: number;
  y: number;
  owner: OwnerType;
  resourceType: ResourceType;
  dailyIncome: number;
  mineName?: string;
  icon?: string;
}

/** Владение шахтой */
export interface MineOwnership {
  id: string;
  x: number;
  y: number;
  owner: OwnerType;
  resourceType: ResourceType;
  dailyIncome: number;
  mineName?: string;
  icon?: string;
}

// ============================================================================
// МОРСКАЯ СИСТЕМА (канон HoMM4)
// ============================================================================

/** Корабль */
export interface Ship {
  id: string;
  type: ShipType;
  x: number;
  y: number;
  owner?: string;
  heroId?: string;
  level?: MapLevel;
}

/** Водоворот (парный телепорт на воде) */
export interface Whirlpool {
  id: string;
  x: number;
  y: number;
  pairedId: string;
  level?: MapLevel;
}

// ============================================================================
// СОСТОЯНИЕ ИГРЫ
// ============================================================================

/** Общее состояние игры */
export interface GameState {
  day: number;
  week: number;
  resources: Resources;
  hero: Hero | null;
  playerHeroes: Hero[];
  map: Tile[][];
  objects: MapObject[];
  towns: Town[];
  mines: MineOwnership[];
  currentScene: string;
  seed: number;
}

// ============================================================================
// СОХРАНЕНИЯ
// ============================================================================

/** Метаданные слота сохранения */
export interface SaveSlotInfo {
  slot: number;
  exists: boolean;
  version?: string;
  timestamp?: number;
  day?: number;
  week?: number;
  heroName?: string;
  heroLevel?: number;
  faction?: string;
}

// ============================================================================
// КАРАВАНЫ
// ============================================================================

/** Караван */
export interface Caravan {
  id: string;
  fromTownId: string;
  toTownId: string;
  units: ArmySlot[];
  startDay: number;
  arrivalDay: number;
  progress: number;
}

// ============================================================================
// СИСТЕМЫ ИИ
// ============================================================================

/** Цель ИИ */
export interface AIGoal {
  type: AIGoalType;
  targetX: number;
  targetY: number;
  targetId?: string;
  priority: number;
  description: string;
}

/** Игрок ИИ */
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
  currentGoal?: AIGoal;
  towns?: string[];
  mines?: string[];
}

// ============================================================================
// УСЛОВИЯ ПОБЕДЫ/ПОРАЖЕНИЯ
// ============================================================================

/** Результат проверки условий */
export interface VictoryCheckResult {
  gameOver: boolean;
  result: 'victory' | 'defeat' | 'continue';
  reason: string;
  stats: {
    playerTowns: number;
    playerHeroes: number;
    aiTowns: number;
    aiHeroes: number;
    playerGold: number;
    day: number;
  };
}

// ============================================================================
// СИСТЕМЫ НАВЫКОВ
// ============================================================================

/** Данные навыка из JSON */
export interface SkillData {
  id: string;
  name: string;
  nameEn: string;
  category: SkillCategory;
  icon: string;
  description: string;
  maxLevel: number;
  effects: Array<{
    level: number;
    type: string;
    value: number;
    description: string;
  }>;
}

/** Специализация героя */
export interface HeroSpecialization {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (hero: Hero, context?: any) => any;
}

// ============================================================================
// СПЕЦИАЛЬНЫЕ НЕДЕЛИ (HoMM4 mechanics)
// ============================================================================

/** Специальная неделя */
export interface SpecialWeek {
  type: SpecialWeekType;
  name: string;
  description: string;
  value: number;
  creatureId?: string;
  faction?: string;
}

/** Состояние специальных недель */
export interface WeeksState {
  currentWeek: number;
  currentDay: number;
  specialWeek: SpecialWeek;
  weekHistory: SpecialWeek[];
}

// ============================================================================
// ЭКОНОМИКА
// ============================================================================

/** Стоимость апгрейда */
export interface UpgradeCost {
  gold: number;
  wood?: number;
  ore?: number;
  crystal?: number;
  gems?: number;
  sulfur?: number;
  mercury?: number;
}

/** Запись апгрейда */
export interface UpgradeEntry {
  from: string;
  to: string;
  toName: string;
  cost: UpgradeCost;
  faction: string;
  name?: string;
  description?: string;
  tier?: number;
  health?: number;
  toCreatureId?: string;
}

/** Предложение магической гильдии */
export interface MageGuildOffer {
  spellId: string;
  spellName: string;
  school: string;
  level: number;
  cost: number;
  description?: string;
  name?: string;
}

/** Курсы рынка */
export interface MarketRate {
  sell: number;
  buy: number;
  sellPrice?: number;
  buyPrice?: number;
}
