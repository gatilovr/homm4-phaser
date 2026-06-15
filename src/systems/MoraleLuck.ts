import Phaser from 'phaser';
import { BattleUnit, Hero } from '../types';
import { GameRandom } from '../utils/Random';

/**
 * Система морали и удачи.
 * - Мораль: шанс на дополнительный ход (позитивная) или пропуск хода (негативная)
 * - Удача: шанс на критический удар (позитивная) или промах (негативная)
 */
export class MoraleLuckSystem {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Проверить мораль перед ходом юнита.
   * @returns 'positive' (доп. ход), 'negative' (пропуск), или 'none'
   */
  checkMorale(unit: BattleUnit, hero: Hero | null): 'positive' | 'negative' | 'none' {
    let morale = 0;

    // Мораль героя
    if (hero) {
      morale += hero.stats.morale;
    }

    // Базовая мораль от типа существа (можно расширить)
    // Например, у ангелов всегда +1, у нежити всегда 0 (иммунитет)
    if (unit.creatureId === 'angel_h4') {
      morale += 1;
    } else if (unit.creatureId === 'skeleton_h4' || unit.creatureId === 'imp_h4' || unit.creatureId === 'ghost_h4' || unit.creatureId === 'vampire_h4' || unit.creatureId === 'bone_dragon_h4' || unit.creatureId === 'devil_h4' || unit.creatureId === 'cerberus' || unit.creatureId === 'venom_spawn') {
      // Нежить не подвержена морали
      return 'none';
    }

    // Шанс срабатывания: |morale| × 5% (канон HoMM4)
    const chance = Math.abs(morale) * 0.05;

    if (morale > 0 && GameRandom.chance(chance)) {
      return 'positive';
    } else if (morale < 0 && GameRandom.chance(chance)) {
      return 'negative';
    }

    return 'none';
  }

  /**
   * Проверить удачу при атаке.
   * @returns 'critical' (×2 урон), 'fumble' (×0.5 урон), или 'none'
   */
  checkLuck(attacker: BattleUnit, hero: Hero | null): 'critical' | 'fumble' | 'none' {
    let luck = 0;

    if (hero) {
      luck += hero.stats.luck;
    }

    // У ангелов удача +1 (HoMM4 IDs)
    if (attacker.creatureId === 'angel_h4' || attacker.creatureId === 'archangel_h4') {
      luck += 1;
    }

    // Шанс срабатывания: |luck| × 5% (канон HoMM4)
    const chance = Math.abs(luck) * 0.05;

    if (luck > 0 && GameRandom.chance(chance)) {
      return 'critical';
    } else if (luck < 0 && GameRandom.chance(chance)) {
      return 'fumble';
    }

    return 'none';
  }

  /**
   * Получить модификатор урона от удачи
   */
  getDamageMultiplier(luckResult: 'critical' | 'fumble' | 'none'): number {
    switch (luckResult) {
      case 'critical': return 2.0;
      case 'fumble': return 0.5;
      default: return 1.0;
    }
  }
}
