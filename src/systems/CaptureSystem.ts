/**
 * CaptureSystem — система захвата героев в плен / побега (канон HoMM4)
 *
 * В каноне HoMM IV:
 * - При поражении герой не умирает, а сдаётся в плен
 * - Выкуп героя из плена за ресурсы
 * - Герой может сбежать и появиться в таверне
 * - При побеге герой теряет армию, но сохраняет навыки и опыт
 */

import { Hero, Resources } from '../types';

/** Захваченный герой */
export interface CapturedHero {
  /** Данные героя */
  hero: Hero;
  /** Кто захватил (ID ИИ) */
  capturedBy: string;
  /** Имя захватчика */
  captorName: string;
  /** День захвата */
  captureDay: number;
  /** Стоимость выкупа */
  ransomCost: Resources;
  /** Шанс побега (растёт со временем) */
  escapeChance: number;
}

/** Результат выкупа */
export interface RansomResult {
  success: boolean;
  message: string;
  cost: Resources;
}

/** Результата побега */
export interface EscapeResult {
  success: boolean;
  message: string;
  hero?: Hero;
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/** Базовый шанс побега за ход */
const BASE_ESCAPE_CHANCE = 0.1;

/** Максимальный шанс побега */
const MAX_ESCAPE_CHANCE = 0.5;

/** Стоимость выкупа (процент от стоимости армии героя) */
const RANSOM_COST_PERCENT = 0.25;

/** Увеличение шанса побега за каждый день плена */
const ESCAPE_CHANCE_GROWTH = 0.03;

// ============================================================================
// ОСНОВНОЙ КЛАСС
// ============================================================================

export class CaptureSystem {
  /** Список пленных героев */
  private capturedHeroes: CapturedHero[] = [];

  // ==========================================================================
  // ЗАХВАТ
  // ==========================================================================

  /**
   * Захватить героя в плен
   */
  captureHero(hero: Hero, captorId: string, captorName: string, currentDay: number): CapturedHero {
    const ransomCost = this.calculateRansomCost(hero);

    const captured: CapturedHero = {
      hero: { ...hero }, // Копируем данные
      capturedBy: captorId,
      captorName,
      captureDay: currentDay,
      ransomCost,
      escapeChance: BASE_ESCAPE_CHANCE
    };

    this.capturedHeroes.push(captured);
    return captured;
  }

  // ==========================================================================
  // ВЫКУП
  // ==========================================================================

  /**
   * Рассчитать стоимость выкупа
   */
  calculateRansomCost(hero: Hero): Resources {
    // Базовая стоимость = 500 золота × уровень героя
    const baseCost = 500 * hero.level;

    // Бонус от армии
    let armyValue = 0;
    for (const slot of hero.army) {
      armyValue += slot.count * 50; // 50 золота за существо
    }

    const totalCost = baseCost + armyValue;

    return {
      gold: Math.floor(totalCost * RANSOM_COST_PERCENT),
      wood: 0,
      ore: 0,
      crystal: 0,
      gems: 0,
      sulfur: 0,
      mercury: 0
    };
  }

  /**
   * Выкупить героя из плена
   */
  ransomHero(heroId: string, resources: Resources): RansomResult {
    const index = this.capturedHeroes.findIndex(c => c.hero.id === heroId);
    if (index === -1) {
      return { success: false, message: 'Герой не найден в плену', cost: { gold: 0, wood: 0, ore: 0, crystal: 0, gems: 0, sulfur: 0, mercury: 0 } };
    }

    const captured = this.capturedHeroes[index];
    const cost = captured.ransomCost;

    // Проверяем ресурсы
    if (resources.gold < cost.gold) {
      return { success: false, message: `Нужно ${cost.gold} золота для выкупа`, cost };
    }

    // Списываем ресурсы
    resources.gold -= cost.gold;

    // Возвращаем героя
    const hero = captured.hero;
    this.capturedHeroes.splice(index, 1);

    return {
      success: true,
      message: `💰 ${hero.name} выкуплен из плена за ${cost.gold} золота!`,
      cost
    };
  }

  // ==========================================================================
  // ПОБЕГ
  // ==========================================================================

  /**
   * Попытка побега (вызывается каждый ход)
   */
  tryEscape(currentDay: number): EscapeResult[] {
    const results: EscapeResult[] = [];

    for (let i = this.capturedHeroes.length - 1; i >= 0; i--) {
      const captured = this.capturedHeroes[i];

      // Увеличиваем шанс побега со временем
      const daysInCaptivity = currentDay - captured.captureDay;
      captured.escapeChance = Math.min(
        MAX_ESCAPE_CHANCE,
        BASE_ESCAPE_CHANCE + daysInCaptivity * ESCAPE_CHANCE_GROWTH
      );

      // Бросаем кубик
      if (Math.random() < captured.escapeChance) {
        // Побег удался!
        const hero = captured.hero;
        this.capturedHeroes.splice(i, 1);

        results.push({
          success: true,
          message: `🏃 ${hero.name} сбежал из плена у ${captured.captorName}!`,
          hero
        });
      }
    }

    return results;
  }

  // ==========================================================================
  // ИНФОРМАЦИЯ
  // ==========================================================================

  /**
   * Получить список пленных
   */
  getCapturedHeroes(): CapturedHero[] {
    return [...this.capturedHeroes];
  }

  /**
   * Получить героев, захваченных ИИ (для выкупа игроком)
   */
  getCapturedByPlayer(): CapturedHero[] {
    return this.capturedHeroes.filter(c => c.capturedBy !== 'player');
  }

  /**
   * Получить героев, захваченных игроком
   */
  getCapturedByAI(): CapturedHero[] {
    return this.capturedHeroes.filter(c => c.capturedBy === 'player');
  }

  /**
   * Проверить, есть ли герой в плену
   */
  isHeroCaptured(heroId: string): boolean {
    return this.capturedHeroes.some(c => c.hero.id === heroId);
  }

  /**
   * Получить количество пленных
   */
  getCapturedCount(): number {
    return this.capturedHeroes.length;
  }

  // ==========================================================================
  // СЕРИАЛИЗАЦИЯ
  // ==========================================================================

  serialize(): CapturedHero[] {
    return [...this.capturedHeroes];
  }

  deserialize(data: CapturedHero[]): void {
    this.capturedHeroes = data || [];
  }
}
