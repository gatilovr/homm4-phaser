// ============================================================================
// БАЗОВЫЕ ТИПЫ
// ============================================================================

export interface Position {
  x: number;
  y: number;
}

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
// КАРТА
// ============================================================================

export type TileType = 
  | 'grass' 
  | 'sand' 
  | 'water' 
  | 'rock' 
  | 'snow' 
  | 'swamp' 
  | 'lava' 
  | 'forest';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  passable: boolean;
  moveCost: number;
  object?: MapObject;
  revealed: boolean;
}

export type MapObjectType = 
  | 'town' 
  | 'enemy_town'
  | 'hero' 
  | 'enemy_hero'
  | 'mine' 
  | 'artifact' 
  | 'creature' 
  | 'resource' 
  | 'portal';

export interface MapObject {
  id: string;
  type: MapObjectType;
  x: number;
  y: number;
  data?: any;
}

// ============================================================================
// СУЩЕСТВА
// ============================================================================

export interface Creature {
  id: string;
  name: string;
  faction: string;
  tier: number;
  attack: number;
  defense: number;
  damage: { min: number; max: number };
  health: number;
  speed: number;
  growth: number;
  cost: Partial<Resources>;
  abilities: string[];
  upgradeTo?: string;
}

// ============================================================================
// ГЕРОИ
// ============================================================================

export interface HeroStats {
  attack: number;
  defense: number;
  spellPower: number;
  knowledge: number;
  morale: number;
  luck: number;
}

export interface HeroSkill {
  id: string;
  name: string;
  level: number; // 1 = базовый, 2 = продвинутый, 3 = эксперт
}

export interface Hero {
  id: string;
  name: string;
  class: string;
  faction: string;
  level: number;
  experience: number;
  stats: HeroStats;
  skills: HeroSkill[];
  mana: number;
  maxMana: number;
  army: ArmySlot[];
  equipment: HeroEquipment;
  spells: string[];
  specialization?: string;
  /** Позиция на карте (для ИИ) */
  x?: number;
  /** Позиция на карте (для ИИ) */
  y?: number;
  /** Очки движения */
  movementPoints?: number;
}

export interface ArmySlot {
  creatureId: string;
  count: number;
}

export interface HeroEquipment {
  head?: Artifact;
  neck?: Artifact;
  torso?: Artifact;
  weapon?: Artifact;
  shield?: Artifact;
  leftRing?: Artifact;
  rightRing?: Artifact;
  boots?: Artifact;
  gloves?: Artifact;
  misc?: Artifact;
}

// ============================================================================
// АРТЕФАКТЫ
// ============================================================================

export type ArtifactSlot = keyof HeroEquipment;
export type ArtifactRarity = 'minor' | 'major' | 'relic';

export interface Artifact {
  id: string;
  name: string;
  slot: ArtifactSlot;
  rarity: ArtifactRarity;
  description: string;
  bonuses: Partial<HeroStats>;
  cost: number;
}

// ============================================================================
// ГОРОДА
// ============================================================================

export interface Building {
  id: string;
  name: string;
  description: string;
  cost: Partial<Resources>;
  requirements: string[];
  provides?: string[];
  dailyIncome?: Partial<Resources>;
  creatureGrowth?: { creatureId: string; amount: number };
}

export interface Town {
  id: string;
  name: string;
  faction: string;
  x: number;
  y: number;
  builtBuildings: string[];
  garrison: ArmySlot[];
  heroes: string[];
  resources: Resources;
}

// ============================================================================
// МАГИЯ
// ============================================================================

export type SpellSchool = 'water' | 'fire' | 'earth' | 'air' | 'mind';
export type SpellTarget = 'single' | 'area' | 'all' | 'self';

export interface Spell {
  id: string;
  name: string;
  school: SpellSchool;
  manaCost: number;
  description: string;
  target: SpellTarget;
  effects: SpellEffect[];
}

export interface SpellEffect {
  type: 'damage' | 'heal' | 'buff' | 'debuff' | 'summon';
  value?: number;
  duration?: number;
  stat?: keyof HeroStats;
}

// ============================================================================
// БОЙ
// ============================================================================

export interface BattleUnit {
  id: string;
  creatureId: string;
  count: number;
  currentHealth: number;
  maxHealth: number;
  x: number;
  y: number;
  side: 'attacker' | 'defender';
  hasActed: boolean;
  hasRetaliated: boolean;
  effects: BattleEffect[];
  isHero?: boolean;
  heroId?: string;
  // === НОВЫЕ ПОЛЯ ДЛЯ 100% БОЕВОЙ СИСТЕМЫ ===
  isClone?: boolean;              // Клон (умирает при получении урона)
  initialCount?: number;          // Начальное количество (для расчёта воскрешения)
  shotsLeft?: number;             // Оставшиеся выстрелы (для стрелков)
  isWall?: boolean;               // Это стена при осаде
  isTower?: boolean;              // Это башня при осаде
  wallHp?: number;                // HP стены
  originalArmyIndex?: number;     // Индекс в армии героя (для сохранения потерь)
}

export interface BattleEffect {
  spellId: string;
  duration: number;
  value?: number;
}

export interface BattleState {
  units: BattleUnit[];
  currentUnitIndex: number;
  turn: number;
  phase: 'deployment' | 'action' | 'targeting' | 'resolution' | 'victory';
  obstacles: Position[];
  winner?: 'attacker' | 'defender';
  // === НОВЫЕ ПОЛЯ ===
  isSiege?: boolean;              // Это осада города
  wallsState?: WallsState;        // Состояние стен при осаде
  battleType?: 'field' | 'siege' | 'creature';  // Тип боя
}

// ============================================================================
// ОСАДА ГОРОДОВ (НОВОЕ)
// ============================================================================

export interface WallsState {
  mainGate: WallSegment;    // Главные ворота
  upperWall: WallSegment;   // Верхняя стена
  lowerWall: WallSegment;   // Нижняя стена
  keepTower: WallSegment;   // Главная башня
  upperTower: WallSegment;  // Верхняя башня
  lowerTower: WallSegment;  // Нижняя башня
}

export interface WallSegment {
  id: string;
  type: 'gate' | 'wall' | 'tower';
  currentHp: number;
  maxHp: number;
  x: number;
  y: number;
  isDestroyed: boolean;
}

// ============================================================================
// НЕКРОМАНТИЯ (НОВОЕ)
// ============================================================================

export interface NecromancyResult {
  raisedUnits: { creatureId: string; count: number }[];
  totalDeadConverted: number;
  necromancyPower: number;
}

// ============================================================================
// РЕЗУЛЬТАТЫ БОЯ (НОВОЕ)
// ============================================================================

export interface BattleResult {
  winner: 'attacker' | 'defender';
  experience: number;
  attackerLosses: ArmyLoss[];
  defenderLosses: ArmyLoss[];
  necromancyResult?: NecromancyResult;
  townCaptured?: string;
  heroDefeated?: string;
  surrendered?: boolean;
  retreated?: boolean;
}

export interface ArmyLoss {
  creatureId: string;
  lost: number;
  remaining: number;
}

// ============================================================================
// СПОСОБНОСТИ СУЩЕСТВ (НОВОЕ)
// ============================================================================

export type AbilityId =
  | 'double_attack'       // Двойная атака
  | 'triple_attack'       // Тройная атака
  | 'double_shot'         // Двойной выстрел
  | 'multi_shot'          // Стрельба по всем соседям цели
  | 'charge'              // Бонус за разбег
  | 'life_drain'          // Вампиризм
  | 'no_retaliation'      // Враг не контратакует
  | 'unlimited_retaliation' // Бесконечные контратаки
  | 'resurrect'           // Воскрешение (ангелы)
  | 'morale_boost'        // +1 мораль союзникам
  | 'morale_debuff'       // -1 мораль врагам
  | 'blind_attack'        // 50% шанс ослепить
  | 'binding_attack'      // Связывание (враг не двигается)
  | 'death_cloud'         // Облако смерти (урон соседям)
  | 'disease'             // Болезнь (-20% к статам)
  | 'weakness'            // Слабость (-2 атаки при попадании)
  | 'aging'               // Старение (-атк/деф цели)
  | 'lightning_strike'    // Молния (50% доп. урон)
  | 'lightning_attack'    // Атака молнией
  | 'breath_attack'       // Дыхание (урон соседям)
  | 'magic_immunity'      // Иммунитет к магии
  | 'magic_resistance'    // Шанс сопротивления магии
  | 'damage_reduction'    // Снижение урона (големы)
  | 'ignore_defense'      // Игнорирование защиты
  | 'ignore_armor'        // Игнорирование доспехов
  | 'bloodlust_aura'      // Аура жажды крови
  | 'mana_drain'          // Поглощение маны
  | 'random_spell'        // Случайное заклинание
  | 'caster'              // Может использовать заклинания
  | 'siege'               // Эффективен против стен
  | 'undead'              // Нежить
  | 'hate_effrit'         // Ненависть к ифритам
  | 'hate_black_dragon';  // Ненависть к чёрным драконам

// ============================================================================
// ФРАКЦИИ
// ============================================================================

export interface Faction {
  id: string;
  name: string;
  description: string;
  creatures: string[];
  heroClasses: string[];
  uniqueAbility?: string;
}

// ============================================================================
// ИГРОВОЕ СОСТОЯНИЕ
// ============================================================================

export interface GameState {
  player: PlayerState;
  aiPlayers: AIPlayerState[];
  map: Tile[][];
  towns: Town[];
  heroes: Hero[];
  day: number;
  week: number;
  currentHeroId?: string;
}

export interface PlayerState {
  id: string;
  faction: string;
  resources: Resources;
  heroes: string[];
  towns: string[];
  mines: string[];
  revealedTiles: Position[];
}

export interface AIPlayerState {
  id: string;
  faction: string;
  resources: Resources;
  heroes: string[];
  towns: string[];
  difficulty: 'easy' | 'normal' | 'hard';
}

// ============================================================================
// СОБЫТИЯ
// ============================================================================

export type GameEvent = 
  | { type: 'hero:moved'; heroId: string; from: Position; to: Position }
  | { type: 'hero:attacked'; heroId: string; targetId: string }
  | { type: 'battle:start'; attacker: string; defender: string }
  | { type: 'battle:end'; winner: 'attacker' | 'defender' }
  | { type: 'town:captured'; townId: string; playerId: string }
  | { type: 'resource:collected'; resource: keyof Resources; amount: number }
  | { type: 'turn:end'; day: number }
  | { type: 'week:end'; week: number };
