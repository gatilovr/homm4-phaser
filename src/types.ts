/**
 * Типы данных игры Heroes IV
 */

// ===== Ресурсы =====
export interface Resources {
  gold: number;
  wood: number;
  ore: number;
  crystals: number;
  gems: number;
  sulfur: number;
  mercury: number;
}

export type ResourceType = keyof Resources;

// ===== Карта =====
export type TileType = 'grass' | 'dirt' | 'water' | 'sand' | 'rock' | 'snow' | 'swamp' | 'lava' | 'forest' | 'mountain';

export interface Tile {
  x: number;
  y: number;
  type: TileType;
  object?: MapObject;
  visible: boolean;
  visited: boolean;
  moveCost: number;
}

export interface MapObject {
  id: string;
  type: MapObjectType;
  owner?: string;
  data?: any;
}

export type MapObjectType = 
  | 'town'
  | 'hero'
  | 'mine'
  | 'artifact'
  | 'creature'
  | 'resource'
  | 'portal'
  | 'treasure'
  | 'building'
  | 'shrine';

// ===== Герой =====
export interface Hero {
  id: string;
  name: string;
  class: string;
  faction: string;
  level: number;
  experience: number;
  x: number;
  y: number;
  movementPoints: number;
  maxMovementPoints: number;
  stats: HeroStats;
  skills: HeroSkill[];
  equipment: Equipment;
  army: ArmyUnit[];
  mana: number;
  maxMana: number;
  spells: string[];
  morale: number;
  luck: number;
  owner: 'player' | 'enemy';
  sprite?: Phaser.GameObjects.Sprite;
}

export interface HeroStats {
  attack: number;
  defense: number;
  spellPower: number;
  knowledge: number;
}

export interface HeroSkill {
  id: string;
  name: string;
  level: number;
  category: SkillCategory;
  effects: SkillEffect[];
}

export type SkillCategory = 'combat' | 'magic' | 'adventure' | 'economy';

export interface SkillEffect {
  type: string;
  value: number;
}

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

export type EquipmentSlot = keyof Equipment;

export interface ArmyUnit {
  creatureId: string;
  count: number;
  creature?: Creature;
}

// ===== Существа =====
export interface Creature {
  id: string;
  name: string;
  nameEn?: string;
  faction: string;
  tier: number;
  attack: number;
  defense: number;
  damageMin: number;
  damageMax: number;
  health: number;
  speed: number;
  shots: number;
  growth: number;
  cost: Partial<Resources>;
  abilities: string[];
  type: CreatureType;
  upgradeFrom?: string;
  upgradeTo?: string;
}

export type CreatureType = 'infantry' | 'shooter' | 'cavalry' | 'flying' | 'beast' | 'siege' | 'hero';

// ===== Артефакты =====
export interface Artifact {
  id: string;
  name: string;
  description: string;
  tier: ArtifactTier;
  slot: EquipmentSlot;
  cost: number;
  effects: ArtifactEffect[];
  icon?: string;
}

export type ArtifactTier = 'minor' | 'major' | 'relic';

export interface ArtifactEffect {
  type: string;
  value: number;
  stat?: string;
}

// ===== Заклинания =====
export interface Spell {
  id: string;
  name: string;
  description: string;
  level: number;
  school: SpellSchool;
  manaCost: number;
  target: SpellTarget;
  effects: SpellEffect[];
  icon?: string;
}

export type SpellSchool = 'water' | 'fire' | 'earth' | 'air' | 'mind';

export type SpellTarget = 'single' | 'area' | 'self' | 'ally' | 'enemy' | 'any';

export interface SpellEffect {
  type: string;
  value: number;
  duration?: number;
}

// ===== Здания =====
export interface Building {
  id: string;
  name: string;
  faction: string;
  category: BuildingCategory;
  tier: number;
  cost: Partial<Resources>;
  description: string;
  requires: string[];
  effects: BuildingEffects;
  creatureId?: string;
  upgradeTo?: string;
}

export type BuildingCategory = 'core' | 'dwelling' | 'economy' | 'magic' | 'special';

export interface BuildingEffects {
  growthMultiplier?: number;
  defenseBonus?: number;
  market?: boolean;
  blacksmith?: boolean;
  tavern?: boolean;
  mageGuildLevel?: number;
  incomeBonus?: number;
  [key: string]: any;
}

// ===== Город =====
export interface Town {
  id: string;
  name: string;
  faction: string;
  x: number;
  y: number;
  owner: 'player' | 'enemy' | 'neutral';
  buildings: string[];
  garrison: ArmyUnit[];
  heroes: string[];
  growthDay: number;
  sprite?: Phaser.GameObjects.Sprite;
}

// ===== Бой =====
export interface BattleUnit {
  id: string;
  creatureId: string;
  creature: Creature;
  count: number;
  currentHealth: number;
  maxHealth: number;
  x: number;
  y: number;
  side: 'attacker' | 'defender';
  isHero?: boolean;
  hero?: Hero;
  speed: number;
  moved: boolean;
  acted: boolean;
  retaliations: number;
  maxRetaliations: number;
  effects: BattleEffect[];
  sprite?: Phaser.GameObjects.Sprite;
  healthBar?: Phaser.GameObjects.Graphics;
  countText?: Phaser.GameObjects.Text;
}

export interface BattleEffect {
  id: string;
  name: string;
  type: string;
  value: number;
  duration: number;
  source?: string;
}

// ===== Фракция =====
export interface Faction {
  id: string;
  name: string;
  nameEn?: string;
  description: string;
  color?: string;
  icon?: string;
  heroClasses?: HeroClass[];
  startingHero?: StartingHero;
  specialAbility?: string;
  townBuildings?: string[];
}

export interface HeroClass {
  id: string;
  name: string;
  description: string;
}

export interface StartingHero {
  class: string;
  name: string;
  startingArmy: { creatureId: string; count: number }[];
}

// ===== Игровое состояние =====
export interface GameState {
  map: Tile[][];
  heroes: Hero[];
  towns: Town[];
  mines: Mine[];
  currentDay: number;
  currentWeek: number;
  currentMonth: number;
  activeHeroId: string;
  resources: Resources;
  settings: GameSettings;
}

export interface Mine {
  id: string;
  x: number;
  y: number;
  type: ResourceType;
  owner: 'player' | 'enemy' | 'neutral';
  income: number;
}

export interface GameSettings {
  musicVolume: number;
  sfxVolume: number;
  difficulty: 'easy' | 'normal' | 'hard';
  mapSize: 'small' | 'medium' | 'large';
}

// ===== События =====
export interface GameEvent {
  type: string;
  data: any;
  timestamp: number;
}

// ===== Утилиты =====
export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}
