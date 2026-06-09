/**
 * Types — центральное определение типов для проекта hommm4-phaser
 * 
 * Этот файл содержит все интерфейсы и типы, используемые в проекте.
 * Синхронизирован с реальным кодом в сценах и системах.
 */

// ============================================================================
// БАЗОВЫЕ TYPE ALIASES (должны быть в начале!)
// ============================================================================

/** Уровень карты — HoMM4 имеет двухуровневые карты (поверхность + подземелье) */
export type MapLevel = 'surface' | 'underground';

/** Типы тайлов карты приключений */
export type TileType = 
  | 'grass' 
  | 'sand' 
  | 'water' 
  | 'rock' 
  | 'snow' 
  | 'swamp' 
  | 'lava' 
  | 'forest'
  // Подземные тайлы (только для underground уровня)
  | 'cave_floor'    // Пол пещеры
  | 'cave_rock'     // Скала в пещере (непроходимая)
  | 'underground_lake' // Подземное озеро
  | 'mushroom_grove'   // Грибная роща
  | 'subterranean_river'; // Подземная река

/** ID фракций существ и городов */
export type FactionId = 
  | 'haven' 
  | 'necropolis' 
  | 'preserve' 
  | 'asylum' 
  | 'academy' 
  | 'stronghold'
  | 'neutral';

/** Класс героя во фракции */
export interface FactionHeroClass {
  id: string;
  name: string;
  description?: string;
}

/** Стартовый герой фракции */
export interface FactionStartingHero {
  class: string;
  name: string;
  startingArmy: Array<{ creatureId: string; count: number }>;
}

/**
 * Фракция — полное описание фракции из factions.json
 * Используется в ContentManager и других системах
 */
export interface Faction {
  id: FactionId;
  name: string;
  nameEn?: string;
  description: string;
  color?: string;
  icon?: string;
  heroClasses?: FactionHeroClass[];
  startingHero?: FactionStartingHero;
  specialAbility?: string;
  townBuildings?: string[];
}

/** Школы магии */
export type SpellSchool = 'fire' | 'water' | 'earth' | 'air' | 'mind';

/** Редкость артефактов */
export type ArtifactRarity = 'common' | 'minor' | 'major' | 'relic';

/** Категории навыков героя */
export type SkillCategory = 
  | 'combat' 
  | 'magic' 
  | 'exploration' 
  | 'economy'
  | 'adventure';

/** Типы объектов карты */
export type MapObjectType = 
  | 'town' | 'enemy_town' | 'mine' | 'artifact' | 'creature' | 'resource'
  | 'portal' | 'school' | 'shrine' | 'altar' | 'obelisk' | 'tavern'
  | 'witch_hut' | 'treasure_chest' | 'refugee_camp' | 'garrison'
  | 'library' | 'sanctuary' | 'shipyard' | 'boat' | 'quest_hut'
  | 'wandering_creature' | 'treasure_pile' | 'magic_well' | 'oasis'
  | 'windmill' | 'water_wheel' | 'scholar' | 'observatory'
  | 'subterranean_gate'  // Портал между поверхностью и подземельем (канон HoMM4)
  | 'whirlpool'          // Водоворот — парный телепорт на воде (канон HoMM4)
  | 'sea_chest'          // Сундук на воде (плавающее сокровище)
  | 'flotsam'            // Плавающий мусор — случайные ресурсы
  | 'bottle'             // Бутылка с посланием
  | 'shipwreck'          // Затонувший корабль (с призраками)
  | 'sea_monster';       // Морское чудовище (нейтральный враг)

/** Типы зданий */
export type BuildingCategory = 'infrastructure' | 'creature' | 'economy' | 'magic' | 'defense';

/** Типы владельцев */
export type OwnerType = 'player' | 'ai' | 'neutral';

/** Позиция на карте */
export interface Position { x: number; y: number; }

/** Конфигурация фазы боя */
export type BattlePhase = 'attacker_move' | 'attacker_action' | 'defender_response' 
  | 'defender_move' | 'defender_action' | 'turn_end' | 'action';

/** Опции для добавления объектов */
export interface Options { add?: boolean; depth?: number; }

/** Тип ресурса */
export type ResourceType = 'gold' | 'wood' | 'ore' | 'crystal' | 'gems' | 'sulfur' | 'mercury';

/** Тип шахты */
export type MineType = 'gold' | 'wood' | 'ore' | 'crystal' | 'gems' | 'sulfur' | 'mercury';

// ============================================================================
// РЕСУРСЫ
// ============================================================================

export interface Resources {
  gold: number; wood: number; ore: number; crystal: number;
  gems: number; sulfur: number; mercury: number;
}

// ============================================================================
// КАРТА И ТАЙЛЫ
// ============================================================================

export interface Tile {
  type: TileType; moveCost: number; revealed: boolean; visible: boolean;
  visited: boolean; object?: MapObject; blocked?: boolean; passable: boolean;
  flyable: boolean; x: number; y: number;
  /** Уровень карты, к которому принадлежит тайл */
  level: MapLevel;
}

export interface MapObject {
  id: string; type: MapObjectType; x: number; y: number;
  subtype?: string; owner?: string; data?: any;
  /** Уровень карты, на котором находится объект (surface по умолчанию) */
  level: MapLevel;
  /** Для subterranean_gate: id парного портала на другом уровне */
  pairedGateId?: string;
}

// ============================================================================
// ГЕРОИ И НАВЫКИ
// ============================================================================

export interface HeroStats {
  attack: number; defense: number; spellPower: number; knowledge: number;
  morale?: number; luck?: number;
}

export interface SkillEffect { type: string; value: number; }

export interface HeroSkill {
  id: string; name: string; level: number; category: SkillCategory; effects: SkillEffect[];
}

export type HeroClass = 'knight' | 'cleric' | 'death_knight' | 'necromancer' 
  | 'ranger' | 'druid' | 'demoniac' | 'heretic' | 'wizard' | 'barbarian';

export interface Artifact {
  id: string; name: string; rarity: ArtifactRarity; description: string;
  bonuses: Array<{ type: string; value: number }>; cost?: Partial<Resources>; tier?: number;
}

export interface Equipment {
  head?: Artifact; neck?: Artifact; body?: Artifact; leftHand?: Artifact;
  rightHand?: Artifact; leftRing?: Artifact; rightRing?: Artifact;
  feet?: Artifact; misc1?: Artifact; misc2?: Artifact;
}

export type EquipmentSlot = keyof Equipment;

export interface Hero {
  id: string; name: string; class: string; faction: string; level: number;
  experience: number; x: number; y: number; movementPoints: number;
  maxMovementPoints: number; stats: HeroStats; skills: HeroSkill[];
  skillsMap?: Map<string, HeroSkill>; mana: number; maxMana: number;
  army: ArmySlot[]; equipment: Equipment; spells: string[];
  morale: number; luck: number; owner: 'player' | 'enemy';
  specialization?: string; sprite?: any;
  /** Текущий уровень карты героя */
  mapLevel: MapLevel;
  /** ID корабля, на котором герой сейчас находится (null = на суше) */
  onShipId?: string | null;
  /** Активен ли эффект Water Walk (позволяет ходить по воде без корабля) */
  waterWalk?: boolean;
  /** Активен ли эффект Fly (позволяет летать над любыми тайлами) */
  flyAdventure?: boolean;
}

// ============================================================================
// ГОРОДА И ЗДАНИЯ
// ============================================================================

export interface Building {
  id: string; name: string; description: string; cost: Partial<Resources>;
  requires: string[]; requirements?: string[]; faction: string;
  category: BuildingCategory; creature?: string; tier?: number;
  creatureGrowth?: number | { creatureId: string; amount: number };
  nameEn?: string; type?: string; provides?: any;
}

export interface Town {
  id: string; name: string; faction: string; x: number; y: number;
  owner: OwnerType; builtBuildings: string[]; garrison: ArmySlot[];
  resources?: Resources; mageGuildLevel?: number; mageGuildOffers?: string[];
  tavernHeroes?: any[]; availableForHire?: ArmySlot[]; dailyIncome?: number;
  /** Уровень карты, на котором находится город */
  mapLevel: MapLevel;
}

// ============================================================================
// СУЩЕСТВА И АРМИЯ
// ============================================================================

export interface ArmySlot { creatureId: string; count: number; maxCount?: number; }

export interface ArmyUnit { creatureId: string; count: number; creature?: Creature; }

export interface Creature {
  id: string; name: string; nameEn?: string; cost: Partial<Resources>;
  attack: number; defense: number; hp: number; health?: number; speed: number;
  damage: [number, number]; tier: number; growth?: number; abilities?: string[];
  faction: string; type?: string; shots?: number; damageMin?: number; damageMax?: number;
  upgradeFrom?: string;
}

/**
 * Нормализованные статы существа для использования в бою.
 * ContentManager.getCreatureStats() возвращает этот тип,
 * унифицируя различия между JSON (health, damageMin/Max) и fallback (hp, damage: [min,max])
 */
export interface CreatureStats {
  /** Здоровье одного существа */
  hp: number;
  /** Атака */
  attack: number;
  /** Защита */
  defense: number;
  /** Скорость (определяет порядок хода и дальность движения) */
  speed: number;
  /** Урон (диапазон min-max) */
  damage: { min: number; max: number };
  /** Количество выстрелов (0 = ближний бой) */
  shots: number;
  /** Список способностей */
  abilities: string[];
  /** Фракция существа */
  faction: string;
  /** Тип (infantry, shooter, flying, cavalry, beast) */
  type: string;
  /** Тир существа (1-7) */
  tier: number;
}

// ============================================================================
// МАГИЯ
// ============================================================================

export interface SpellEffect { type: string; value: number; description?: string; }

export type SpellTarget = 'single' | 'area' | 'all' | 'self';

export interface Spell {
  id: string; name: string; school: SpellSchool; manaCost: number;
  description: string; target: SpellTarget; effects: SpellEffect[];
}

// ============================================================================
// БОЙ
// ============================================================================

export interface SpellBuff { spellId: string; duration: number; value: number; }

export interface BattleEffect { spellId: string; duration: number; value: number; }

export interface BattleUnit {
  id: string; creatureId: string; creature?: Creature; count: number;
  initialCount?: number; currentHealth: number; maxHealth: number;
  x: number; y: number; side: 'attacker' | 'defender'; hasActed: boolean;
  hasRetaliated: boolean; effects: SpellBuff[]; isHero?: boolean;
  isWall?: boolean; isTower?: boolean; wallHp?: number; speed?: number;
  shotsLeft?: number; originalArmyIndex?: number; heroId?: string;
  moved?: boolean; acted?: boolean; retaliations?: number; maxRetaliations?: number;
}

export interface WallSegment {
  id: string; type: 'gate' | 'wall' | 'tower'; currentHp: number;
  maxHp: number; x: number; y: number; isDestroyed: boolean;
}

export interface WallsState {
  mainGate: WallSegment; upperWall: WallSegment; lowerWall: WallSegment;
  keepTower: WallSegment; upperTower: WallSegment; lowerTower: WallSegment;
}

export interface BattleResult {
  winner: 'attacker' | 'defender' | 'draw'; experienceGained: number;
  deadEnemies: BattleUnit[]; losses: BattleUnit[]; armyLosses?: ArmyLoss[];
}

export interface ArmyLoss { creatureId: string; lost: number; lostCount?: number; }

export interface BattleState {
  units: BattleUnit[]; attackerHero: Hero | null; defenderHero: Hero | null;
  currentTurn: number; result?: BattleResult; currentUnitIndex?: number;
  turn?: number; wallsState?: WallsState; phase?: BattlePhase;
}

// ============================================================================
// СИСТЕМЫ ВЛАДЕНИЯ
// ============================================================================

export interface TownOwnership {
  id: string; name: string; faction: string; x: number; y: number;
  owner: OwnerType; builtBuildings: string[]; garrison: ArmySlot[];
  availableForHire: ArmySlot[]; lastGrowthDay: number;
}

export interface Mine {
  id: string; x: number; y: number; owner: OwnerType;
  resourceType: ResourceType; dailyIncome: number;
  mineName?: string; icon?: string;
}

export interface MineOwnership {
  id: string; x: number; y: number; owner: OwnerType;
  resourceType: ResourceType; dailyIncome: number;
  mineName?: string; icon?: string;
}

// ============================================================================
// СОСТОЯНИЕ ИГРЫ
// ============================================================================

export interface GameState {
  day: number; week: number; resources: Resources; hero: Hero | null;
  playerHeroes: Hero[]; map: Tile[][]; objects: MapObject[];
  towns: Town[]; mines: MineOwnership[]; currentScene: string; seed: number;
  /** Корабли на карте (канон HoMM4) */
  ships?: Ship[];
  /** Водовороты — парные телепорты на воде (канон HoMM4) */
  whirlpools?: Whirlpool[];
}

// ============================================================================
// СОХРАНЕНИЯ
// ============================================================================

export interface SaveSlotInfo {
  slot: number; exists: boolean; version?: string; timestamp?: number;
  day?: number; week?: number; heroName?: string; heroLevel?: number; faction?: string;
}

// ============================================================================
// НЕКРОМАНТИЯ
// ============================================================================

export interface NecromancyResult {
  raisedUnits: ArmySlot[]; totalDeadConverted: number; necromancyPower: number;
}

// ============================================================================
// КАРАВАНЫ
// ============================================================================

export interface Caravan {
  id: string; fromTownId: string; toTownId: string; units: ArmySlot[];
  startDay: number; arrivalDay: number; progress: number;
}

// ============================================================================
// КОРАБЛИ (морские путешествия — канон HoMM4)
// ============================================================================

/**
 * Корабль на карте приключений.
 * В HoMM4 герой может сесть на корабль, двигаться по воде и высаживаться на берег.
 * Корабли строятся в верфях (shipyard) в городах у воды.
 */
export interface Ship {
  /** Уникальный ID корабля */
  id: string;
  /** Тип корабля (в HoMM4 был только 'boat' — обычная лодка) */
  type: 'boat';
  /** Позиция на карте */
  x: number;
  y: number;
  /** Уровень карты (в каноне корабли только на поверхности, но для единообразия) */
  mapLevel: MapLevel;
  /** Владелец корабля. null = свободный (ничей) */
  owner: OwnerType | null;
  /** ID героя, который сейчас на борту (если есть) */
  heroId?: string;
  /** Очки движения корабля (тратятся при плавании) */
  movementPoints: number;
  /** Максимум очков движения за день (базово 1500, +50% за навык Navigation) */
  maxMovementPoints: number;
}

/**
 * Результат попытки посадки на корабль
 */
export interface BoardingResult {
  success: boolean;
  reason?: string;
  movementCost?: number;
}

/**
 * Водоворот — парный телепорт на воде (канон HoMM4)
 */
export interface Whirlpool {
  id: string;
  x: number;
  y: number;
  mapLevel: MapLevel;
  /** ID парного водоворота */
  pairedId: string;
}

/**
 * Состояние морского боя (особые правила в HoMM4)
 */
export interface NavalBattleField {
  /** Бой происходит на воде */
  isNaval: boolean;
  /** Атакующий на корабле */
  attackerOnShip: boolean;
  /** Защитник на корабле */
  defenderOnShip: boolean;
}

// ============================================================================
// СИСТЕМЫ ИИ
// ============================================================================

export type AIGoalType = 'attack_hero' | 'attack_creature' | 'capture_mine'
  | 'capture_town' | 'collect_artifact' | 'collect_resource' | 'explore'
  | 'return_to_town' | 'defend_town';

export interface AIGoal {
  type: AIGoalType; targetX: number; targetY: number;
  targetId?: string; priority: number; description: string;
}

export interface AIPlayer {
  id: string; name: string; color: number; faction: string; hero: Hero;
  townId: string; resources: Resources; isActive: boolean; turnsPlayed: number;
  currentGoal?: AIGoal; towns?: string[]; mines?: string[];
}

// ============================================================================
// УСЛОВИЯ ПОБЕДЫ/ПОРАЖЕНИЯ
// ============================================================================

export type VictoryCondition = 
  | { type: 'defeat_all_enemies' }
  | { type: 'capture_all_towns' }
  | { type: 'accumulate_gold'; amount: number };

export type DefeatCondition = 
  | { type: 'lose_all_heroes_and_towns' }
  | { type: 'lose_all_towns' }
  | { type: 'day_limit'; days: number };

export interface VictoryCheckResult {
  gameOver: boolean; result: 'victory' | 'defeat' | 'continue'; reason: string;
  stats: { playerTowns: number; playerHeroes: number; aiTowns: number;
    aiHeroes: number; playerGold: number; day: number; };
}

// ============================================================================
// СИСТЕМЫ НАВЫКОВ
// ============================================================================

export interface SkillData {
  id: string; name: string; nameEn: string; category: SkillCategory;
  icon: string; description: string; maxLevel: number;
  effects: Array<{ level: number; type: string; value: number; description: string; }>;
}

export interface HeroSpecialization {
  id: string; name: string; description: string; icon: string;
  apply: (hero: Hero, context?: any) => any;
}

// ============================================================================
// ЭКОНОМИКА
// ============================================================================

export interface UpgradeCost {
  gold: number; wood?: number; ore?: number; crystal?: number;
  gems?: number; sulfur?: number; mercury?: number;
}

export interface UpgradeEntry {
  from: string; to: string; toName: string; cost: UpgradeCost;
  faction: string; name?: string; description?: string; tier?: number; health?: number;
}

export interface MageGuildOffer {
  spellId: string; spellName: string; school: string; level: number;
  cost: number; description?: string; name?: string;
}

export interface MarketRate { sell: number; buy: number; sellPrice?: number; buyPrice?: number; }
