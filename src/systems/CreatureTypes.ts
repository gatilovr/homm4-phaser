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
  attackRange: number;
  moveType: 'normal' | 'flying' | 'cavalry';
  retaliations: number;
  specialAbilities: string[];
}

/**
 * База данных типов существ (канон HoMM4).
 */
export const CREATURE_TYPES: Record<string, CreatureTypeInfo> = {
  // === HAVEN (4 tiers × 2 choices) ===
  squire:       { id: 'squire',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  ballista:     { id: 'ballista',     type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter'] },
  pikeman_h4:   { id: 'pikeman_h4',   type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['first_strike'] },
  archer_h4:    { id: 'archer_h4',    type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter'] },
  crusader_h4:  { id: 'crusader_h4',  type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['double_attack'] },
  monk_h4:      { id: 'monk_h4',      type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'heal'] },
  champion_h4:  { id: 'champion_h4',  type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge', 'jousting'] },
  angel_h4:     { id: 'angel_h4',     type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'morale_boost', 'resurrect'] },

  // === PRESERVE ===
  sprite:       { id: 'sprite',       type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying'] },
  wolf_h4:      { id: 'wolf_h4',      type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['double_attack'] },
  elf_h4:       { id: 'elf_h4',       type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter'] },
  white_tiger:  { id: 'white_tiger',  type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['stealth'] },
  griffin_h4:   { id: 'griffin_h4',   type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 999, specialAbilities: ['flying', 'unlimited_retaliation'] },
  unicorn_h4:   { id: 'unicorn_h4',   type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['blind_attack', 'magic_resistance'] },
  faerie_dragon_h4: { id: 'faerie_dragon_h4', type: 'flying', attackRange: 1, moveType: 'flying', retaliations: 1, specialAbilities: ['flying', 'spell_cast'] },
  phoenix_h4:   { id: 'phoenix_h4',   type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'fire_shield', 'rebirth'] },

  // === NECROPOLIS ===
  skeleton_h4:  { id: 'skeleton_h4',  type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead'] },
  imp_h4:       { id: 'imp_h4',       type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'mana_burn'] },
  ghost_h4:     { id: 'ghost_h4',     type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'aging'] },
  cerberus:     { id: 'cerberus',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead', 'triple_attack'] },
  vampire_h4:   { id: 'vampire_h4',   type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'drain_life', 'no_retaliation'] },
  venom_spawn:  { id: 'venom_spawn',  type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead', 'poison_attack'] },
  bone_dragon_h4: { id: 'bone_dragon_h4', type: 'flying', attackRange: 1, moveType: 'flying', retaliations: 1, specialAbilities: ['undead', 'aging'] },
  devil_h4:     { id: 'devil_h4',     type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['undead', 'teleport', 'hellfire'] },

  // === ASYLUM ===
  bandit:       { id: 'bandit',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['steal_gold'] },
  orc_h4:       { id: 'orc_h4',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['rage'] },
  medusa:       { id: 'medusa',       type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'stone_gaze'] },
  minotaur_h4:  { id: 'minotaur_h4',  type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['maze_walk'] },
  nightmare:    { id: 'nightmare',    type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'fear'] },
  efreet:       { id: 'efreet',       type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'fire_shield'] },
  hydra:        { id: 'hydra',        type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['multi_head_attack'] },
  black_dragon: { id: 'black_dragon', type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'magic_immunity', 'fear'] },

  // === ACADEMY ===
  dwarf_h4:     { id: 'dwarf_h4',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['magic_resistance'] },
  halfling:     { id: 'halfling',     type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter'] },
  gold_golem_h4: { id: 'gold_golem_h4', type: 'melee',  attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['damage_reduction'] },
  mage_h4:      { id: 'mage_h4',      type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'no_melee_penalty'] },
  naga_h4:      { id: 'naga_h4',      type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 0, specialAbilities: ['first_strike'] },
  genie_h4:     { id: 'genie_h4',     type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'cast_random_spell'] },
  dragon_golem: { id: 'dragon_golem', type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['magic_immunity', 'damage_reduction'] },
  titan_h4:     { id: 'titan_h4',     type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'no_melee_penalty', 'lightning_strike'] },

  // === STRONGHOLD ===
  berserker:    { id: 'berserker',    type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['rage'] },
  centaur:      { id: 'centaur',      type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter'] },
  harpy:        { id: 'harpy',        type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'hit_and_run'] },
  nomad:        { id: 'nomad',        type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge'] },
  ogre_mage_h4: { id: 'ogre_mage_h4', type: 'melee',   attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['rage', 'bloodlust'] },
  cyclops_h4:   { id: 'cyclops_h4',   type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['stone_throw'] },
  thunderbird_h4: { id: 'thunderbird_h4', type: 'flying', attackRange: 1, moveType: 'flying', retaliations: 1, specialAbilities: ['flying', 'lightning_strike'] },
  behemoth_h4:  { id: 'behemoth_h4',  type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['ignore_defense_50'] },

  // === NEUTRAL (Tier 1) ===
  peasant:              { id: 'peasant',              type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  halfling_neutral:     { id: 'halfling_neutral',     type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter'] },
  boar:                 { id: 'boar',                 type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge'] },
  goblin:               { id: 'goblin',               type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: [] },
  wolf_neutral:         { id: 'wolf_neutral',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['double_attack'] },
  zombie:               { id: 'zombie',               type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead'] },
  skeleton_neutral:     { id: 'skeleton_neutral',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead'] },

  // === NEUTRAL (Tier 2) ===
  bandit_neutral:       { id: 'bandit_neutral',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['steal_gold'] },
  nomad_neutral:        { id: 'nomad_neutral',        type: 'cavalry',  attackRange: 1, moveType: 'cavalry',  retaliations: 1, specialAbilities: ['charge'] },
  nymph:                { id: 'nymph',                type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['heal'] },
  satyr:                { id: 'satyr',                type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['morale_boost'] },
  blind_monk:           { id: 'blind_monk',           type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'no_melee_penalty'] },
  ice_elemental:        { id: 'ice_elemental',        type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['elemental', 'cold_attack'] },
  fire_elemental:       { id: 'fire_elemental',       type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['elemental', 'fire_shield'] },
  earth_elemental:      { id: 'earth_elemental',      type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['elemental', 'damage_reduction'] },
  air_elemental:        { id: 'air_elemental',        type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['elemental', 'flying'] },

  // === NEUTRAL (Tier 3) ===
  troll:                { id: 'troll',                type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['regeneration'] },
  mummy:                { id: 'mummy',                type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['undead', 'curse_attack'] },
  ogre_neutral:         { id: 'ogre_neutral',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['rage'] },
  sea_serpent:          { id: 'sea_serpent',          type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['poison_attack'] },
  griffin_neutral:      { id: 'griffin_neutral',      type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 999, specialAbilities: ['flying', 'unlimited_retaliation'] },
  wizard_neutral:       { id: 'wizard_neutral',       type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'caster', 'no_melee_penalty'] },

  // === NEUTRAL (Tier 4) ===
  behemoth_neutral:     { id: 'behemoth_neutral',     type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['ignore_defense_50'] },
  dragon_neutral:       { id: 'dragon_neutral',       type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'fear', 'fire_breath'] },
  hydra_neutral:        { id: 'hydra_neutral',        type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['multi_head_attack'] },
  angel_neutral:        { id: 'angel_neutral',        type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'morale_boost', 'resurrect'] },
  devil_neutral:        { id: 'devil_neutral',        type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'fear', 'teleport', 'hellfire'] },
  phoenix_neutral:      { id: 'phoenix_neutral',      type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'fire_shield', 'rebirth'] },

  // === NEUTRAL (Tier 5 — Legendary) ===
  azure_dragon:         { id: 'azure_dragon',         type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'magic_immunity', 'fear', 'fire_breath'] },
  rust_dragon:          { id: 'rust_dragon',          type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'magic_immunity', 'fear', 'damage_reduction'] },
  crystal_dragon:       { id: 'crystal_dragon',       type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'magic_immunity', 'fear', 'crystal_spikes'] },
  faerie_dragon_neutral:{ id: 'faerie_dragon_neutral',type: 'flying',   attackRange: 1, moveType: 'flying',   retaliations: 1, specialAbilities: ['flying', 'magic_immunity', 'spell_cast', 'teleport'] },

  // === Спец. ID ===
  hero:         { id: 'hero',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 1, specialAbilities: ['caster', 'hero'] },
  wall:         { id: 'wall',         type: 'melee',    attackRange: 1, moveType: 'normal',   retaliations: 0, specialAbilities: ['structure'] },
  tower:        { id: 'tower',        type: 'ranged',   attackRange: 10, moveType: 'normal',  retaliations: 1, specialAbilities: ['shooter', 'structure'] },
};

/**
 * Зарегистрировать тип героя на основе его класса.
 */
export function registerHeroType(heroId: string, heroClass: string): void {
  const isRangedClass = ['cleric', 'necromancer', 'druid', 'heretic', 'wizard', 'artificer', 'shaman'].includes(heroClass);
  CREATURE_TYPES[heroId] = {
    id: heroId,
    type: isRangedClass ? 'ranged' : 'melee',
    attackRange: isRangedClass ? 10 : 1,
    moveType: 'normal',
    retaliations: 1,
    specialAbilities: isRangedClass ? ['caster'] : []
  };
}

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
