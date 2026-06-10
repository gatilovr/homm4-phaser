/**
 * MagicScrollSystem - система магических свитков (HoMM4 mechanics)
 * 
 * В каноне HoMM4 свитки (Scrolls) - это одноразовые артефакты:
 * - Содержат одно заклинание
 * - Можно использовать в бою (тратится 1 действие)
 * - После использования исчезают
 * - Обычно не требуют маны (или требуют минимум)
 * - Находятся на карте как объекты "magic_scroll"
 * - Можно купить в магазинах
 */

import { SeededRandom } from '../utils/Random';

// ============================================================================
// ТИПЫ
// ============================================================================

/**
 * Магический свиток
 */
export interface MagicScroll {
  /** Уникальный ID свитка */
  id: string;
  /** ID заклинания, которое содержит свиток */
  spellId: string;
  /** Название заклинания (для отображения) */
  spellName: string;
  /** Школа магии */
  school: 'life' | 'death' | 'order' | 'chaos' | 'natural';
  /** Уровень заклинания (1-5) */
  level: number;
  /** Стоимость маны для использования (0 = бесплатно) */
  manaCost: number;
  /** Описание */
  description: string;
  /** Редкость (для генерации) */
  rarity: 'common' | 'uncommon' | 'rare' | 'epic';
}

/**
 * Результат использования свитка
 */
export interface ScrollUseResult {
  /** Успешно ли использован */
  success: boolean;
  /** Сообщение */
  message: string;
  /** ID использованного свитка (если успех) */
  scrollId?: string;
  /** ID заклинания (если успех) */
  spellId?: string;
}

// ============================================================================
// СИСТЕМА СВИТКОВ
// ============================================================================

export class MagicScrollSystem {
  /** Таблица всех возможных свитков по редкости */
  private static readonly SCROLL_POOL: Array<{
    spellId: string;
    spellName: string;
    school: 'life' | 'death' | 'order' | 'chaos' | 'natural';
    level: number;
    manaCost: number;
    description: string;
    rarity: 'common' | 'uncommon' | 'rare' | 'epic';
    weight: number;
  }> = [
    // === LIFE (Жизнь) ===
    { spellId: 'cure', spellName: 'Исцеление', school: 'life', level: 1, manaCost: 0, description: 'Лечит 30 HP отряду', rarity: 'common', weight: 15 },
    { spellId: 'bless', spellName: 'Благословение', school: 'life', level: 1, manaCost: 0, description: '+20% урон на 3 хода', rarity: 'common', weight: 12 },
    { spellId: 'heal', spellName: 'Лечение', school: 'life', level: 2, manaCost: 0, description: 'Лечит 50 HP отряду', rarity: 'uncommon', weight: 10 },
    { spellId: 'resurrection', spellName: 'Воскрешение', school: 'life', level: 4, manaCost: 10, description: 'Воскрешает павших существ', rarity: 'rare', weight: 4 },
    { spellId: 'guardian_angel', spellName: 'Ангел-хранитель', school: 'life', level: 5, manaCost: 15, description: 'Полная защита на 1 ход', rarity: 'epic', weight: 2 },

    // === DEATH (Смерть) ===
    { spellId: 'curse', spellName: 'Проклятие', school: 'death', level: 1, manaCost: 0, description: '-20% урон врагу на 3 хода', rarity: 'common', weight: 15 },
    { spellId: 'weakness', spellName: 'Слабость', school: 'death', level: 2, manaCost: 0, description: '-2 к атаке врага', rarity: 'uncommon', weight: 10 },
    { spellId: 'death_ripple', spellName: 'Волна смерти', school: 'death', level: 3, manaCost: 5, description: '25 урона всем врагам', rarity: 'rare', weight: 5 },
    { spellId: 'implosion', spellName: 'Имплозия', school: 'death', level: 4, manaCost: 12, description: '100 урона одному отряду', rarity: 'rare', weight: 3 },
    { spellId: 'animate_dead', spellName: 'Оживление мёртвых', school: 'death', level: 3, manaCost: 8, description: 'Поднимает нежить из павших', rarity: 'rare', weight: 5 },

    // === ORDER (Порядок) ===
    { spellId: 'haste', spellName: 'Ускорение', school: 'order', level: 1, manaCost: 0, description: '+3 к скорости на 3 хода', rarity: 'common', weight: 15 },
    { spellId: 'slow', spellName: 'Замедление', school: 'order', level: 1, manaCost: 0, description: '-3 к скорости врагу', rarity: 'common', weight: 15 },
    { spellId: 'shield', spellName: 'Щит', school: 'order', level: 2, manaCost: 0, description: '+30% защиты на 3 хода', rarity: 'uncommon', weight: 10 },
    { spellId: 'teleport', spellName: 'Телепорт', school: 'order', level: 3, manaCost: 5, description: 'Переместить отряд', rarity: 'rare', weight: 5 },
    { spellId: 'clone', spellName: 'Клонирование', school: 'order', level: 5, manaCost: 20, description: 'Создать копию отряда', rarity: 'epic', weight: 1 },

    // === CHAOS (Хаос) ===
    { spellId: 'fireball', spellName: 'Огненный шар', school: 'chaos', level: 2, manaCost: 0, description: '40 урона по области 3×3', rarity: 'uncommon', weight: 12 },
    { spellId: 'lightning', spellName: 'Молния', school: 'chaos', level: 2, manaCost: 0, description: '50 урона одному отряду', rarity: 'uncommon', weight: 12 },
    { spellId: 'chain_lightning', spellName: 'Цепная молния', school: 'chaos', level: 3, manaCost: 8, description: '40 урона, переходит на соседей', rarity: 'rare', weight: 5 },
    { spellId: 'meteor', spellName: 'Метеорит', school: 'chaos', level: 4, manaCost: 12, description: '80 урона по области', rarity: 'rare', weight: 3 },
    { spellId: 'armageddon', spellName: 'Армагеддон', school: 'chaos', level: 5, manaCost: 20, description: '100 урона всем (включая своих)', rarity: 'epic', weight: 1 },

    // === NATURAL (Природа) ===
    { spellId: 'stoneskin', spellName: 'Каменная кожа', school: 'natural', level: 1, manaCost: 0, description: '+5 к защите на 3 хода', rarity: 'common', weight: 15 },
    { spellId: 'bloodlust', spellName: 'Жажда крови', school: 'natural', level: 1, manaCost: 0, description: '+5 к атаке на 3 хода', rarity: 'common', weight: 15 },
    { spellId: 'summon_wolves', spellName: 'Призыв волков', school: 'natural', level: 2, manaCost: 5, description: 'Призывает 5 волков', rarity: 'uncommon', weight: 8 },
    { spellId: 'summon_elementals', spellName: 'Призыв элементалей', school: 'natural', level: 4, manaCost: 15, description: 'Призывает 3 элементаля', rarity: 'rare', weight: 3 },
    { spellId: 'vines', spellName: 'Лианы', school: 'natural', level: 2, manaCost: 0, description: 'Обездвиживает врага на 2 хода', rarity: 'uncommon', weight: 10 }
  ];

  /** Генератор случайных чисел */
  private static rng: SeededRandom = new SeededRandom();

  /**
   * Установить seed для генерации
   */
  public static setSeed(seed: number): void {
    this.rng = new SeededRandom(seed);
  }

  /**
   * Сгенерировать случайный свиток с учётом весов редкости
   * @param minLevel Минимальный уровень заклинания (1-5)
   * @param maxLevel Максимальный уровень заклинания (1-5)
   */
  public static generateRandomScroll(minLevel: number = 1, maxLevel: number = 5): MagicScroll {
    // Фильтруем по уровню
    const availableScrolls = this.SCROLL_POOL.filter(
      s => s.level >= minLevel && s.level <= maxLevel
    );

    if (availableScrolls.length === 0) {
      // Fallback на любой свиток
      return this.generateRandomScroll(1, 5);
    }

    // Выбираем с учётом весов
    const totalWeight = availableScrolls.reduce((sum, s) => sum + s.weight, 0);
    let roll = this.rng.randomInt(1, totalWeight);

    for (const scroll of availableScrolls) {
      roll -= scroll.weight;
      if (roll <= 0) {
        return {
          id: `scroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          spellId: scroll.spellId,
          spellName: scroll.spellName,
          school: scroll.school,
          level: scroll.level,
          manaCost: scroll.manaCost,
          description: scroll.description,
          rarity: scroll.rarity
        };
      }
    }

    // Fallback
    const fallback = availableScrolls[0];
    return {
      id: `scroll_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      spellId: fallback.spellId,
      spellName: fallback.spellName,
      school: fallback.school,
      level: fallback.level,
      manaCost: fallback.manaCost,
      description: fallback.description,
      rarity: fallback.rarity
    };
  }

  /**
   * Сгенерировать несколько случайных свитков
   */
  public static generateMultipleScrolls(count: number, minLevel: number = 1, maxLevel: number = 5): MagicScroll[] {
    const scrolls: MagicScroll[] = [];
    for (let i = 0; i < count; i++) {
      scrolls.push(this.generateRandomScroll(minLevel, maxLevel));
    }
    return scrolls;
  }

  /**
   * Получить цвет редкости (для UI)
   */
  public static getRarityColor(rarity: 'common' | 'uncommon' | 'rare' | 'epic'): string {
    switch (rarity) {
      case 'common': return '#b0b0b0';      // Серый
      case 'uncommon': return '#1eff00';    // Зелёный
      case 'rare': return '#0070dd';        // Синий
      case 'epic': return '#a335ee';        // Фиолетовый
    }
  }

  /**
   * Получить имя редкости на русском
   */
  public static getRarityName(rarity: 'common' | 'uncommon' | 'rare' | 'epic'): string {
    switch (rarity) {
      case 'common': return 'Обычный';
      case 'uncommon': return 'Необычный';
      case 'rare': return 'Редкий';
      case 'epic': return 'Эпический';
    }
  }

  /**
   * Получить стоимость свитка в золоте (для продажи/покупки)
   */
  public static getScrollValue(scroll: MagicScroll): number {
    const baseCost = scroll.level * 100;
    const rarityMultiplier = {
      common: 1,
      uncommon: 1.5,
      rare: 2.5,
      epic: 5
    }[scroll.rarity];

    return Math.floor(baseCost * rarityMultiplier);
  }

  /**
   * Проверить может ли герой использовать свиток
   * @param hero Герой
   * @param scroll Свиток
   */
  public static canUseScroll(hero: any, scroll: MagicScroll): { canUse: boolean; reason?: string } {
    // Проверяем наличие маны
    if (hero.mana < scroll.manaCost) {
      return { canUse: false, reason: `Недостаточно маны (нужно ${scroll.manaCost}, есть ${hero.mana})` };
    }

    return { canUse: true };
  }

  /**
   * Использовать свиток (в бою)
   * @param hero Герой
   * @param scroll Свиток
   * @param targetId ID цели (для заклинаний)
   */
  public static useScroll(hero: any, scroll: MagicScroll, targetId?: string): ScrollUseResult {
    const check = this.canUseScroll(hero, scroll);
    if (!check.canUse) {
      return { success: false, message: check.reason || 'Невозможно использовать' };
    }

    // Тратим ману (если нужно)
    if (scroll.manaCost > 0) {
      hero.mana -= scroll.manaCost;
    }

    return {
      success: true,
      message: `📜 Использован свиток: ${scroll.spellName}`,
      scrollId: scroll.id,
      spellId: scroll.spellId
    };
  }

  /**
   * Добавить свиток герою
   * @param hero Герой
   * @param scroll Свиток
   */
  public static addScrollToHero(hero: any, scroll: MagicScroll): void {
    if (!hero.scrolls) {
      hero.scrolls = [];
    }
    hero.scrolls.push(scroll);
  }

  /**
   * Удалить свиток у героя (после использования)
   * @param hero Герой
   * @param scrollId ID свитка
   */
  public static removeScrollFromHero(hero: any, scrollId: string): boolean {
    if (!hero.scrolls) return false;

    const index = hero.scrolls.findIndex((s: MagicScroll) => s.id === scrollId);
    if (index === -1) return false;

    hero.scrolls.splice(index, 1);
    return true;
  }

  /**
   * Получить все свитки героя
   */
  public static getHeroScrolls(hero: any): MagicScroll[] {
    return hero.scrolls || [];
  }

  /**
   * Получить эмодзи школы магии
   */
  public static getSchoolEmoji(school: 'life' | 'death' | 'order' | 'chaos' | 'natural'): string {
    switch (school) {
      case 'life': return '✨';
      case 'death': return '💀';
      case 'order': return '⚖️';
      case 'chaos': return '🔥';
      case 'natural': return '🌿';
    }
  }
}
