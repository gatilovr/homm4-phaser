import { BattleUnit, Hero } from '../types';
import { GameRandom } from '../utils/Random';
import { CONFIG } from '../config';

/**
 * Типы юнитов с их характеристиками.
 * Каждый тип имеет уникальные боевые свойства.
 */
export interface CreatureTypeInfo {
  id: string;
  type: 'melee' | 'ranged' | 'flying' | 'cavalry' | 'caster' | 'hero';
  attackRange: number;       // Дальность атаки (1 = ближний бой, 2+ = стрелок)
  moveType: 'normal' | 'flying' | 'cavalry';
  retaliations: number;       // Количество контратак за ход (0, 1, бесконечно)
  specialAbilities: string[]; // Особые способности
}

/**
 * База данных типов существ.
 * Определяет их поведение в бою.
 */
export const CREATURE_TYPES: Record<string, CreatureTypeInfo> = {
  // === УБЕЖИЩЕ ===
  pikeman:      { id: 'pikeman',      type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  halberdier:   { id: 'halberdier',   type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 2, specialAbilities: [] },
  archer:       { id: 'archer',       type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['double_shot'] },
  crossbowman:  { id: 'crossbowman',  type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['ignore_armor'] },
  griffin:      { id: 'griffin',      type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 999, specialAbilities: ['unlimited_retaliation'] },
  royal_griffin:{ id: 'royal_griffin',type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 999, specialAbilities: ['unlimited_retaliation'] },
  swordsman:    { id: 'swordsman',    type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  champion:     { id: 'champion',     type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge'] },
  cavalier:     { id: 'cavalier',     type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge'] },
  angel:        { id: 'angel',        type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['resurrect'] },
  archangel:    { id: 'archangel',    type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['resurrect', 'morale_boost'] },

  // === НЕКРОПОЛИС ===
  skeleton:     { id: 'skeleton',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead'] },
  skeleton_warrior: { id: 'skeleton_warrior', type: 'melee', attackRange: 1, moveType: 'normal', retaliations: 1, specialAbilities: ['undead'] },
  zombie:       { id: 'zombie',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead', 'weakness'] },
  plague_zombie:{ id: 'plague_zombie',type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead', 'disease'] },
  vampire:      { id: 'vampire',      type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'life_drain', 'no_retaliation'] },
  vampire_lord: { id: 'vampire_lord', type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'life_drain', 'no_retaliation'] },
  lich:         { id: 'lich',         type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['undead', 'death_cloud'] },
  power_lich:   { id: 'power_lich',   type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['undead', 'death_cloud'] },
  bone_dragon:  { id: 'bone_dragon',  type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'morale_debuff'] },
  ghost_dragon: { id: 'ghost_dragon', type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'morale_debuff', 'aging'] },

  // === АЗИЛУМ ===
  goblin:       { id: 'goblin',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  hobgoblin:    { id: 'hobgoblin',    type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  wolf_rider:   { id: 'wolf_rider',   type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge'] },
  wolf_raider:  { id: 'wolf_raider',  type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['double_attack'] },
  orc:          { id: 'orc',          type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: [] },
  orc_chieftain:{ id: 'orc_chieftain',type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: [] },
  ogre:         { id: 'ogre',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  ogre_mage:    { id: 'ogre_mage',    type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['bloodlust_aura'] },
  roc:          { id: 'roc',          type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: [] },
  thunderbird:  { id: 'thunderbird',  type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['lightning_strike'] },
  cyclop:       { id: 'cyclop',       type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['siege'] },
  cyclop_king:  { id: 'cyclop_king',  type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['siege', 'multi_shot'] },
  behemoth:     { id: 'behemoth',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['ignore_defense'] },
  ancient_behemoth: { id: 'ancient_behemoth', type: 'melee', attackRange: 1, moveType: 'normal', retaliations: 1, specialAbilities: ['ignore_defense'] },

  // === ЗАПОВЕДНИК ===
  wolf:         { id: 'wolf',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['double_attack'] },
  dire_wolf:    { id: 'dire_wolf',    type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['double_attack'] },
  elf:          { id: 'elf',          type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: [] },
  grand_elf:    { id: 'grand_elf',    type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['double_shot'] },
  unicorn:      { id: 'unicorn',      type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['blind_attack'] },
  silver_unicorn: { id: 'silver_unicorn', type: 'cavalry', attackRange: 1, moveType: 'cavalry', retaliations: 1, specialAbilities: ['blind_attack'] },
  dwarf:        { id: 'dwarf',        type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['magic_resistance'] },
  battle_dwarf: { id: 'battle_dwarf', type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['magic_resistance'] },
  dendroid:     { id: 'dendroid',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['binding_attack'] },
  dendroid_soldier: { id: 'dendroid_soldier', type: 'melee', attackRange: 1, moveType: 'normal', retaliations: 1, specialAbilities: ['binding_attack'] },
  druid:        { id: 'druid',        type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['caster'] },
  elder_druid:  { id: 'elder_druid',  type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['caster'] },
  green_dragon: { id: 'green_dragon', type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['breath_attack', 'magic_immunity'] },
  gold_dragon:  { id: 'gold_dragon',  type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['breath_attack', 'magic_immunity'] },

  // === АКАДЕМИЯ ===
  golem:        { id: 'golem',        type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['damage_reduction'] },
  obsidian_golem: { id: 'obsidian_golem', type: 'melee', attackRange: 1, moveType: 'normal',  retaliations: 1, specialAbilities: ['damage_reduction'] },
  mage:         { id: 'mage',         type: 'caster',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['magic_attack'] },
  archmage:     { id: 'archmage',     type: 'caster',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['magic_attack', 'mana_drain'] },
  genie:        { id: 'genie',        type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['caster', 'hate_effrit'] },
  master_genie: { id: 'master_genie', type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['caster', 'hate_effrit', 'random_spell'] },
  naga:         { id: 'naga',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 0, specialAbilities: ['no_retaliation'] },
  naga_queen:   { id: 'naga_queen',   type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 0, specialAbilities: ['no_retaliation'] },
  titan:        { id: 'titan',        type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['lightning_attack', 'hate_black_dragon'] },
  storm_titan:  { id: 'storm_titan',  type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['lightning_attack', 'melee_lightning'] },

  // === Герои ===
  hero:         { id: 'hero',         type: 'hero',     attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['caster', 'hero'] },
};

/**
 * Получить информацию о типе существа
 */
export function getCreatureType(creatureId: string): CreatureTypeInfo {
  return CREATURE_TYPES[creatureId] || {
    id: creatureId,
    type: 'melee',
    attackRange: 1,
    moveType: 'normal',
    retaliations: 1,
    specialAbilities: []
  };
}

/**
 * Проверить, может ли юнит стрелять
 */
export function isRanged(creatureId: string): boolean {
  const type = getCreatureType(creatureId);
  return type.type === 'ranged' || type.attackRange > 1;
}

/**
 * Проверить, может ли юнит летать
 */
export function isFlying(creatureId: string): boolean {
  const type = getCreatureType(creatureId);
  return type.type === 'flying' || type.moveType === 'flying';
}

/**
 * Проверить, является ли юнит кавалерией
 */
export function isCavalry(creatureId: string): boolean {
  const type = getCreatureType(creatureId);
  return type.type === 'cavalry' || type.moveType === 'cavalry';
}

/**
 * Проверить, имеет ли юнит способность
 */
export function hasAbility(creatureId: string, ability: string): boolean {
  const type = getCreatureType(creatureId);
  return type.specialAbilities.includes(ability);
}

/**
 * Получить максимальное количество контратак
 */
export function getRetaliationCount(creatureId: string): number {
  const type = getCreatureType(creatureId);
  if (type.specialAbilities.includes('unlimited_retaliation')) return 999;
  if (type.specialAbilities.includes('no_retaliation')) return 0;
  return type.retaliations;
}
