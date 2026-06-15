/**
 * ComboArtifactSystem — система комбинированных артефактов HoMM4.
 * 
 * В каноне HoMM4 есть 7 комбо-артефактов, которые собираются из нескольких частей.
 * Когда все части надеты на героя — активируется мощный бонус.
 * 
 * Комбо-артефакты:
 * - Angelic Alliance (5 частей) — нет штрафа фракций, +5 ATK/DEF, +3 мораль
 * - Titan's Thunder (3 части) — +7 ATK, +5 SP, бесплатная молния 600 урона
 * - Admiral's Hat (3 части) — бесплатная навигация, +100% скорость на воде
 * - Cloak of the Undead King (3 части) — +30% некромантия, поднимает личей
 * - Wizard's Well (3 части) — полная регенерация маны каждый ход
 * - Ring of the Magi (3 части) — +50% длительность заклинаний
 * - Spirit of Oppression (3 части) — отменяет мораль у всех
 */

import type { Hero, Artifact, Equipment } from '../types';

/** Определение комбо-артефакта */
export interface ComboArtifactDef {
  id: string;
  name: string;
  description: string;
  /** ID частей, из которых собирается */
  parts: string[];
  /** Бонусы при активации */
  bonuses: Record<string, number>;
}

/** Реестр всех комбо-артефактов HoMM4 */
export const COMBO_ARTIFACTS: Record<string, ComboArtifactDef> = {
  angelic_alliance: {
    id: 'angelic_alliance',
    name: 'Ангельский Альянс',
    description: 'Нет штрафа от смешения фракций. Все союзники +5 АТК, +5 ЗАЩ, +3 мораль',
    parts: ['sword_of_might', 'shield_of_the_yawning_dead', 'helm_of_the_alabaster_unicorn', 'breastplate_of_petrified_wood', 'boots_of_the_void'],
    bonuses: { attack: 5, defense: 5, morale: 3 }
  },
  titans_thunder: {
    id: 'titans_thunder',
    name: 'Гром Титанов',
    description: '+7 АТК, +5 Сила магии. Бесплатное заклинание Titan\'s Lightning Bolt',
    parts: ['titans_gladius', 'titans_cuirass', 'titans_crown', 'titans_orb'],
    bonuses: { attack: 7, spellPower: 5 }
  },
  admirals_hat: {
    id: 'admirals_hat',
    name: 'Шляпа адмирала',
    description: 'Бесплатная посадка/высадка. +100% скорость на воде',
    parts: ['sea_captains_hat', 'chart_of_the_seas', 'lighthouse_keeper_amulet'],
    bonuses: { navigation: 100 }
  },
  cloak_of_the_undead_king: {
    id: 'cloak_of_the_undead_king',
    name: 'Плащ короля нежити',
    description: '+30% некромантии. Поднимает Личей вместо скелетов',
    parts: ['amulet_of_the_undead', 'bone_cuirass', 'skull_cap'],
    bonuses: { necromancy: 30 }
  },
  wizards_well: {
    id: 'wizards_well',
    name: 'Колодец волшебника',
    description: 'Полная регенерация маны каждый ход в бою',
    parts: ['ring_of_wisdom', 'ring_of_power', 'staff_of_magic'],
    bonuses: { manaRegen: 999 }
  },
  ring_of_the_magi: {
    id: 'ring_of_the_magi',
    name: 'Кольцо магов',
    description: '+50% длительность заклинаний',
    parts: ['ring_of_conjuring', 'ring_of_mental_shield', 'cape_of_conduct'],
    bonuses: { spellDuration: 50 }
  },
  spirit_of_oppression: {
    id: 'spirit_of_oppression',
    name: 'Дух угнетения',
    description: 'Отменяет мораль у всех (враги не получают бонус морали)',
    parts: ['skull_helmet', 'rib_cage', 'shield_of_damnation'],
    bonuses: { negateEnemyMorale: 1 }
  }
};

export class ComboArtifactSystem {
  private static instance: ComboArtifactSystem | null = null;

  public static getInstance(): ComboArtifactSystem {
    if (!ComboArtifactSystem.instance) {
      ComboArtifactSystem.instance = new ComboArtifactSystem();
    }
    return ComboArtifactSystem.instance;
  }

  /**
   * Проверить, какие комбо-артефакты активны у героя.
   * Возвращает список ID активных комбо.
   */
  public getActiveCombos(hero: Hero): string[] {
    const activeCombos: string[] = [];
    const equippedIds = this.getEquippedArtifactIds(hero.equipment);

    for (const [comboId, comboDef] of Object.entries(COMBO_ARTIFACTS)) {
      if (this.isComboComplete(comboDef.parts, equippedIds)) {
        activeCombos.push(comboId);
      }
    }

    return activeCombos;
  }

  /**
   * Получить все бонусы от активных комбо-артефактов
   */
  public getActiveComboBonuses(hero: Hero): Record<string, number> {
    const bonuses: Record<string, number> = {};
    const activeCombos = this.getActiveCombos(hero);

    for (const comboId of activeCombos) {
      const def = COMBO_ARTIFACTS[comboId];
      if (def) {
        for (const [key, value] of Object.entries(def.bonuses)) {
          bonuses[key] = (bonuses[key] || 0) + value;
        }
      }
    }

    return bonuses;
  }

  /**
   * Проверить, собран ли комбо-артефакт (все части надеты)
   */
  private isComboComplete(parts: string[], equippedIds: Set<string>): boolean {
    return parts.every(partId => equippedIds.has(partId));
  }

  /**
   * Получить Set всех ID артефактов, надетых на героя
   */
  private getEquippedArtifactIds(equipment: Equipment): Set<string> {
    const ids = new Set<string>();
    for (const [, artifact] of Object.entries(equipment)) {
      if (artifact && artifact.id) {
        ids.add(artifact.id);
      }
    }
    return ids;
  }

  /**
   * Получить информацию о прогрессе сборки комбо для UI
   */
  public getComboProgress(hero: Hero): Array<{
    comboId: string;
    name: string;
    description: string;
    partsFound: number;
    partsTotal: number;
    isComplete: boolean;
  }> {
    const equippedIds = this.getEquippedArtifactIds(hero.equipment);
    const result: Array<{
      comboId: string;
      name: string;
      description: string;
      partsFound: number;
      partsTotal: number;
      isComplete: boolean;
    }> = [];

    for (const [comboId, comboDef] of Object.entries(COMBO_ARTIFACTS)) {
      const partsFound = comboDef.parts.filter(id => equippedIds.has(id)).length;
      result.push({
        comboId,
        name: comboDef.name,
        description: comboDef.description,
        partsFound,
        partsTotal: comboDef.parts.length,
        isComplete: partsFound === comboDef.parts.length
      });
    }

    return result;
  }
}

export const comboArtifactSystem = ComboArtifactSystem.getInstance();
