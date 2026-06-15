/**
 * DesertionSystem — система эмиграции/дезертирства существ (канон HoMM4)
 *
 * В каноне HoMM IV:
 * - При отрицательной морали существа покидают армию
 * - Смешение фракций даёт штраф к морали
 * - Предупреждения о возможном дезертирстве
 * - Ангельский Альянс отменяет штраф фракций
 */

import { Hero, ArmySlot, FactionId } from '../types';

/** Результат дезертирства */
export interface DesertionResult {
  /** Было ли дезертирство */
  deserted: boolean;
  /** Какие существа ушли */
  desertedCreatures: Array<{ creatureId: string; count: number }>;
  /** Сообщение */
  message: string;
}

/** Информация о штрафе фракций */
export interface FactionPenaltyInfo {
  /** Уникальные фракции в армии */
  uniqueFactions: string[];
  /** Штраф к морали */
  penalty: number;
  /** Есть ли Ангельский Альянс */
  hasAngelicAlliance: boolean;
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/** Мораль, при которой начинается дезертирство */
const DESERTION_MORALE_THRESHOLD = -2;

/** Базовый шанс дезертирства за ход при критически низкой морали */
const DESERTION_BASE_CHANCE = 0.15;

/** Максимальный шанс дезертирства */
const MAX_DESERTION_CHANCE = 0.5;

/** Штраф к морали за каждую лишнюю фракцию (сверх 2) */
const FACTION_PENALTY = -1;

// ============================================================================
// ОСНОВНОЙ КЛАСС
// ============================================================================

export class DesertionSystem {

  /**
   * Рассчитать штраф за смешение фракций
   */
  calculateFactionPenalty(army: ArmySlot[], heroFaction?: string, hero?: Hero): FactionPenaltyInfo {
    // Собираем уникальные фракции из существ
    const factionMap = new Map<string, number>();

    for (const slot of army) {
      // Определяем фракцию по ID существа (упрощённо)
      const faction = this.getCreatureFaction(slot.creatureId);
      if (faction && faction !== 'neutral') {
        factionMap.set(faction, (factionMap.get(faction) || 0) + slot.count);
      }
    }

    // Добавляем фракцию героя
    if (heroFaction && heroFaction !== 'neutral') {
      factionMap.set(heroFaction, (factionMap.get(heroFaction) || 0) + 1);
    }

    const uniqueFactions = Array.from(factionMap.keys());
    const hasAngelicAlliance = hero ? this.checkAngelicAlliance(hero) : false;

    // Штраф: -1 за каждую фракцию сверх 2 (отменяется Ангельским Альянсом)
    let penalty = 0;
    if (uniqueFactions.length > 2 && !hasAngelicAlliance) {
      penalty = FACTION_PENALTY * (uniqueFactions.length - 2);
    }

    return {
      uniqueFactions,
      penalty,
      hasAngelicAlliance
    };
  }

  /**
   * Рассчитать текущую мораль героя с учётом штрафов
   */
  calculateEffectiveMorale(hero: Hero): number {
    let morale = hero.morale || hero.stats.morale || 0;

    // Штраф за смешение фракций
    const factionInfo = this.calculateFactionPenalty(hero.army, hero.faction, hero);
    if (!factionInfo.hasAngelicAlliance) {
      morale += factionInfo.penalty;
    }

    return morale;
  }

  /**
   * Рассчитать шанс дезертирства
   */
  calculateDesertionChance(hero: Hero): number {
    const effectiveMorale = this.calculateEffectiveMorale(hero);

    if (effectiveMorale >= DESERTION_MORALE_THRESHOLD) {
      return 0; // Нет дезертирства
    }

    // Чем ниже мораль, тем выше шанс
    const moraleDeficit = DESERTION_MORALE_THRESHOLD - effectiveMorale;
    let chance = DESERTION_BASE_CHANCE * moraleDeficit;

    return Math.min(MAX_DESERTION_CHANCE, chance);
  }

  /**
   * Проверить и применить дезертирство
   */
  checkDesertion(hero: Hero): DesertionResult {
    const chance = this.calculateDesertionChance(hero);

    if (chance <= 0) {
      return { deserted: false, desertedCreatures: [], message: '' };
    }

    // Бросаем кубик
    if (Math.random() >= chance) {
      return { deserted: false, desertedCreatures: [], message: '' };
    }

    // Дезертирство происходит!
    const desertedCreatures: Array<{ creatureId: string; count: number }> = [];

    // Выбираем случайное существо для дезертирства
    const validSlots = hero.army.filter(s => s.count > 0 && s.creatureId !== 'hero');
    if (validSlots.length === 0) {
      return { deserted: false, desertedCreatures: [], message: '' };
    }

    const targetSlot = validSlots[Math.floor(Math.random() * validSlots.length)];
    const desertCount = Math.max(1, Math.floor(targetSlot.count * 0.2)); // 20% от стаи

    targetSlot.count -= desertCount;
    desertedCreatures.push({ creatureId: targetSlot.creatureId, count: desertCount });

    // Удаляем пустые слоты
    hero.army = hero.army.filter(s => s.count > 0);

    const creatureName = targetSlot.creatureId;
    const message = `🏃 Дезертирство! ${desertCount}×${creatureName} покинули вашу армию! (мораль: ${this.calculateEffectiveMorale(hero)})`;

    return { deserted: true, desertedCreatures, message };
  }

  /**
   * Получить предупреждение о возможном дезертирстве
   */
  getDesertionWarning(hero: Hero): string | null {
    const effectiveMorale = this.calculateEffectiveMorale(hero);

    if (effectiveMorale < DESERTION_MORALE_THRESHOLD - 2) {
      return `⚠️ КРИТИЧЕСКИ НИЗКАЯ МОРАЛЬ (${effectiveMorale})! Существа могут дезертировать!`;
    }

    if (effectiveMorale < DESERTION_MORALE_THRESHOLD) {
      return `⚠️ Низкая мораль (${effectiveMorale}). Возможны дезертиры.`;
    }

    const factionInfo = this.calculateFactionPenalty(hero.army, hero.faction, hero);
    if (factionInfo.uniqueFactions.length > 2) {
      return `⚠️ Смешение фракций (${factionInfo.uniqueFactions.length}): мораль ${factionInfo.penalty}`;
    }

    return null;
  }

  /**
   * Проверить наличие Ангельского Альянса в экипировке героя
   * Ангельский Альянс отменяет штраф за смешение фракций (канон HoMM4)
   */
  private checkAngelicAlliance(hero: Hero): boolean {
    const equipment = hero.equipment;
    if (!equipment) return false;

    // Проверяем все слоты экипировки
    const slots = ['head', 'neck', 'body', 'leftHand', 'rightHand', 
                   'leftRing', 'rightRing', 'feet', 'misc1', 'misc2'] as const;
    
    for (const slot of slots) {
      const artifact = equipment[slot];
      if (artifact && (
        artifact.id === 'angelic_alliance' || 
        artifact.name?.toLowerCase().includes('ангельский альянс') ||
        artifact.name?.toLowerCase().includes('angelic alliance')
      )) {
        return true;
      }
    }

    return false;
  }

  /**
   * Определить фракцию существа по ID (упрощённая карта)
   */
  private getCreatureFaction(creatureId: string): FactionId | null {
    const map: Record<string, FactionId> = {
      // Haven
      pikeman: 'haven', halberdier: 'haven', archer: 'haven', crossbowman: 'haven',
      griffin: 'haven', royal_griffin: 'haven', swordsman: 'haven', crusader: 'haven',
      cavalier: 'haven', champion: 'haven', angel: 'haven', archangel: 'haven',
      // Necropolis
      skeleton: 'necropolis', skeleton_warrior: 'necropolis', zombie: 'necropolis',
      plague_zombie: 'necropolis', ghost: 'necropolis', wraith: 'necropolis',
      vampire: 'necropolis', vampire_lord: 'necropolis', lich: 'necropolis',
      arch_lich: 'necropolis', black_knight: 'necropolis', dread_knight: 'necropolis',
      bone_dragon: 'necropolis', ghost_dragon: 'necropolis',
      // Preserve
      wolf: 'preserve', dire_wolf: 'preserve', elf: 'preserve', grand_elf: 'preserve',
      centaur: 'preserve', unicorn: 'preserve', dendroid: 'preserve', phoenix: 'preserve',
      // Asylum
      imp: 'asylum', goblin: 'asylum', medusa: 'asylum', orc: 'asylum',
      minotaur: 'asylum', ogre: 'asylum', roc: 'asylum', cyclops: 'asylum',
      // Academy
      gremlin: 'academy', master_gremlin: 'academy', stone_golem: 'academy',
      mage: 'academy', genie: 'academy', nagi: 'academy', titan: 'academy',
      // Stronghold
      gnoll: 'stronghold', gnoll_marauder: 'stronghold', lizard: 'stronghold',
      troll: 'stronghold', ogre_mage: 'stronghold', wyvern: 'stronghold',
      behemoth: 'stronghold', ancient_behemoth: 'stronghold',
    };

    return map[creatureId] || null;
  }
}
