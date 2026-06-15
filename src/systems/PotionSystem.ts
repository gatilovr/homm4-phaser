/**
 * PotionSystem — система зелий и расходников (канон HoMM4)
 *
 * В каноне HoMM IV:
 * - Зелья лечения, маны, усиления
 * - Покупка в городе (алхимическая лаборатория)
 * - Находки на карте
 * - Использование в бою (тратит действие)
 */

import { Hero, Resources } from '../types';

/** Тип эффекта зелья */
export type PotionEffectType =
  | 'heal'           // Лечение
  | 'restore_mana'   // Восстановление маны
  | 'boost_attack'   // Усиление атаки
  | 'boost_defense'  // Усиление защиты
  | 'boost_speed'    // Усиление скорости
  | 'resurrect';     // Воскрешение

/** Зелье */
export interface Potion {
  id: string;
  name: string;
  description: string;
  effect: PotionEffectType;
  value: number;
  duration?: number; // В ходах (undefined = мгновенно)
  cost: Partial<Resources>;
  rarity: 'common' | 'uncommon' | 'rare';
  usableIn: 'battle' | 'map' | 'both';
}

/** Результат использования зелья */
export interface PotionResult {
  success: boolean;
  message: string;
  effect?: string;
}

// ============================================================================
// ДАННЫЕ ЗЕЛИЙ
// ============================================================================

const ALL_POTIONS: Potion[] = [
  // === Обычные ===
  {
    id: 'healing_potion', name: 'Зелье лечения',
    description: 'Восстанавливает 50 HP',
    effect: 'heal', value: 50,
    cost: { gold: 200 }, rarity: 'common', usableIn: 'both'
  },
  {
    id: 'mana_potion', name: 'Зелье маны',
    description: 'Восстанавливает 30 маны',
    effect: 'restore_mana', value: 30,
    cost: { gold: 150 }, rarity: 'common', usableIn: 'both'
  },
  {
    id: 'minor_healing', name: 'Малое зелье лечения',
    description: 'Восстанавливает 100 HP',
    effect: 'heal', value: 100,
    cost: { gold: 400 }, rarity: 'uncommon', usableIn: 'both'
  },
  {
    id: 'mana_crystal', name: 'Кристалл маны',
    description: 'Восстанавливает 75 маны',
    effect: 'restore_mana', value: 75,
    cost: { gold: 350 }, rarity: 'uncommon', usableIn: 'both'
  },
  // === Редкие ===
  {
    id: 'greater_healing', name: 'Великое зелье лечения',
    description: 'Восстанавливает 250 HP',
    effect: 'heal', value: 250,
    cost: { gold: 800, crystal: 1 }, rarity: 'rare', usableIn: 'both'
  },
  {
    id: 'attack_potion', name: 'Зелье ярости',
    description: '+5 к атаке на 3 хода',
    effect: 'boost_attack', value: 5, duration: 3,
    cost: { gold: 600 }, rarity: 'uncommon', usableIn: 'battle'
  },
  {
    id: 'defense_potion', name: 'Зелье защиты',
    description: '+5 к защите на 3 хода',
    effect: 'boost_defense', value: 5, duration: 3,
    cost: { gold: 600 }, rarity: 'uncommon', usableIn: 'battle'
  },
  {
    id: 'speed_potion', name: 'Зелье скорости',
    description: '+3 к скорости на 3 хода',
    effect: 'boost_speed', value: 3, duration: 3,
    cost: { gold: 500 }, rarity: 'uncommon', usableIn: 'battle'
  },
  {
    id: 'resurrection_scroll', name: 'Свиток воскрешения',
    description: 'Воскрешает 20% павших',
    effect: 'resurrect', value: 20,
    cost: { gold: 2000, crystal: 2 }, rarity: 'rare', usableIn: 'battle'
  },
];

// ============================================================================
// ОСНОВНОЙ КЛАСС
// ============================================================================

export class PotionSystem {

  /**
   * Получить доступные зелья для покупки в городе
   */
  getAvailablePotions(townBuildings: string[]): Potion[] {
    const hasLab = townBuildings.some(b =>
      b.includes('mage_guild') || b.includes('lab') || b.includes('alchemy')
    );

    if (!hasLab) return [];

    // Фильтруем по редкости (чем выше гильдия магов — тем лучше зелья)
    const guildLevel = townBuildings.filter(b => b.includes('mage_guild')).length;

    return ALL_POTIONS.filter(p => {
      if (p.rarity === 'common') return true;
      if (p.rarity === 'uncommon' && guildLevel >= 1) return true;
      if (p.rarity === 'rare' && guildLevel >= 2) return true;
      return false;
    });
  }

  /**
   * Купить зелье
   */
  buyPotion(hero: Hero, potionId: string, resources: Resources): PotionResult {
    const potion = ALL_POTIONS.find(p => p.id === potionId);
    if (!potion) {
      return { success: false, message: 'Зелье не найдено' };
    }

    // Проверяем ресурсы
    if ((potion.cost.gold || 0) > resources.gold) {
      return { success: false, message: `Нужно ${potion.cost.gold} золота` };
    }
    if ((potion.cost.crystal || 0) > resources.crystal) {
      return { success: false, message: `Нужно ${potion.cost.crystal} кристаллов` };
    }
    if ((potion.cost.wood || 0) > resources.wood) {
      return { success: false, message: `Нужно ${potion.cost.wood} дерева` };
    }
    if ((potion.cost.ore || 0) > resources.ore) {
      return { success: false, message: `Нужно ${potion.cost.ore} руды` };
    }

    // Списываем ресурсы
    resources.gold -= potion.cost.gold || 0;
    resources.wood -= potion.cost.wood || 0;
    resources.ore -= potion.cost.ore || 0;
    resources.crystal -= potion.cost.crystal || 0;

    // Добавляем зелье герою (в инвентарь)
    if (!hero.scrolls) hero.scrolls = [];
    hero.scrolls.push(potion);

    return {
      success: true,
      message: `🧪 Куплено: ${potion.name}`,
      effect: potion.id
    };
  }

  /**
   * Использовать зелье на карте
   */
  usePotionOnMap(hero: Hero, potionId: string): PotionResult {
    const potionIndex = (hero.scrolls || []).findIndex((s: any) => s.id === potionId);
    if (potionIndex === -1) {
      return { success: false, message: 'Зелье не найдено в инвентаре' };
    }

    const potion = (hero.scrolls || [])[potionIndex] as Potion;

    if (potion.usableIn !== 'map' && potion.usableIn !== 'both') {
      return { success: false, message: 'Это зелье нельзя использовать на карте' };
    }

    let message = '';

    switch (potion.effect) {
      case 'heal':
        // На карте — полное лечение
        hero.stats.hp = hero.stats.maxHp || 100;
        message = `🧪 ${potion.name}: Герой полностью исцелён!`;
        break;
      case 'restore_mana':
        hero.mana = Math.min(hero.maxMana, hero.mana + potion.value);
        message = `🧪 ${potion.name}: +${potion.value} маны!`;
        break;
      case 'boost_attack':
        // На карте — постоянный бонус (до конца дня)
        (hero as any).tempAttack = ((hero as any).tempAttack || 0) + potion.value;
        message = `🧪 ${potion.name}: +${potion.value} к атаке!`;
        break;
      case 'boost_defense':
        (hero as any).tempDefense = ((hero as any).tempDefense || 0) + potion.value;
        message = `🧪 ${potion.name}: +${potion.value} к защите!`;
        break;
      case 'boost_speed':
        (hero as any).tempSpeed = ((hero as any).tempSpeed || 0) + potion.value;
        message = `🧪 ${potion.name}: +${potion.value} к скорости!`;
        break;
      case 'resurrect':
        // На карте — воскрешение 20% павших существ
        message = `🧪 ${potion.name}: Воскрешение доступно только в бою!`;
        break;
      default:
        message = `🧪 ${potion.name}: Эффект применён!`;
    }

    // Удаляем зелье из инвентаря
    (hero.scrolls as any[]).splice(potionIndex, 1);

    return { success: true, message };
  }

  /**
   * Получить случайное зелье (для нахождения на карте)
   */
  getRandomPotion(rarity?: string): Potion {
    const filtered = rarity
      ? ALL_POTIONS.filter(p => p.rarity === rarity)
      : ALL_POTIONS;
    // Fallback если rarity не найден
    const pool = filtered.length > 0 ? filtered : ALL_POTIONS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Получить все зелья
   */
  getAllPotions(): Potion[] {
    return [...ALL_POTIONS];
  }

  /**
   * Получить зелье по ID
   */
  getPotion(potionId: string): Potion | undefined {
    return ALL_POTIONS.find(p => p.id === potionId);
  }
}
