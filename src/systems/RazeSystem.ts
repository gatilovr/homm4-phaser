/**
 * RazeSystem — система разрушения городов (канон HoMM4)
 *
 * В каноне HoMM IV:
 * - Возможность разрушить захваченный вражеский город
 * - Получение части ресурсов обратно (25-50% от стоимости зданий)
 * - Нельзя разрушить последний город ИИ
 * - Разрушение происходит мгновенно
 */

import { Resources, Town } from '../types';

/** Результат разрушения города */
export interface RazeResult {
  success: boolean;
  message: string;
  /** Полученные ресурсы */
  reward: Resources;
  /** Разрушенный город */
  townId: string;
}

/** Информация о награде за разрушение */
export interface RazeRewardInfo {
  /** Стоимость зданий в золоте */
  buildingValue: number;
  /** Награда (процент от стоимости) */
  rewardPercent: number;
  /** Итоговые ресурсы */
  reward: Resources;
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/** Базовая стоимость зданий (в золоте) по категориям */
const BUILDING_VALUES: Record<string, number> = {
  // Haven
  haven_dwelling_1: 500, haven_dwelling_2: 1000, haven_dwelling_3: 2000, haven_dwelling_4: 10000,
  archery_range: 1000, griffin_tower: 2000, swordsmith: 3000, jousting_arena: 5000,
  church: 4000, portal_of_glory: 10000,
  // Necropolis
  necropolis_dwelling_1: 400, necropolis_dwelling_2: 1000, necropolis_dwelling_3: 3000, necropolis_dwelling_4: 10000,
  graveyard: 1500, mausoleum: 3000, estate: 4000, tomb: 5000, dragon_vault: 10000,
  // Common
  citadel: 2000, castle: 5000, marketplace: 1000, blacksmith: 1500,
  tavern: 500, mage_guild_1: 2000, mage_guild_2: 3000, mage_guild_3: 5000,
  // Defense
  walls: 1000, fort: 1500,
};

/** Процент возврата ресурсов при разрушении */
const REWARD_PERCENT = 0.3;

/** Нельзя разрушить если это последний город */
const MIN_TOWNS_FOR_RAZE = 2;

// ============================================================================
// ОСНОВНОЙ КЛАСС
// ============================================================================

export class RazeSystem {

  /**
   * Проверить, можно ли разрушить город
   */
  canRazeTown(townId: string, allTowns: Town[], ownerTowns: Town[]): string | null {
    // Проверяем, есть ли город
    const town = allTowns.find(t => t.id === townId);
    if (!town) return 'Город не найден';

    // Нельзя разрушить последний город
    if (ownerTowns.length <= MIN_TOWNS_FOR_RAZE - 1) {
      return 'Нельзя разрушить последний город!';
    }

    // Нельзя разрушить свой город
    if (town.owner === 'player') {
      return 'Нельзя разрушить свой город!';
    }

    return null;
  }

  /**
   * Рассчитать награду за разрушение
   */
  calculateRazeReward(town: Town): RazeRewardInfo {
    let buildingValue = 0;

    for (const buildingId of town.builtBuildings) {
      buildingValue += BUILDING_VALUES[buildingId] || 500;
    }

    // Базовая награда за город
    buildingValue += 1000;

    const rewardGold = Math.floor(buildingValue * REWARD_PERCENT);

    return {
      buildingValue,
      rewardPercent: REWARD_PERCENT,
      reward: {
        gold: rewardGold,
        wood: 0,
        ore: 0,
        crystal: 0,
        gems: 0,
        sulfur: 0,
        mercury: 0
      }
    };
  }

  /**
   * Разрушить город
   */
  razeTown(townId: string, allTowns: Town[], ownerTowns: Town[]): RazeResult {
    const error = this.canRazeTown(townId, allTowns, ownerTowns);
    if (error) {
      return {
        success: false,
        message: error,
        reward: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 },
        townId
      };
    }

    const town = allTowns.find(t => t.id === townId)!;
    const rewardInfo = this.calculateRazeReward(town);

    // Удаляем город (помечаем как разрушенный)
    const townIndex = allTowns.indexOf(town);
    if (townIndex >= 0) {
      allTowns.splice(townIndex, 1);
    }

    return {
      success: true,
      message: `💥 ${town.name} разрушен! Получено ${rewardInfo.reward.gold} золота.`,
      reward: rewardInfo.reward,
      townId
    };
  }

  /**
   * Получить предупреждение о разрушении
   */
  getRazeWarning(townId: string, ownerTowns: Town[]): string | null {
    if (ownerTowns.length <= MIN_TOWNS_FOR_RAZE) {
      return '⚠️ Это последний город! Разрушение приведёт к поражению ИИ.';
    }
    return null;
  }
}
