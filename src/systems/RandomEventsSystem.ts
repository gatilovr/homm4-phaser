// ============================================================================
// RandomEventsSystem — Случайные события (канон HoMM4)
// В HoMM4 каждую неделю с шансом ~30% происходит случайное событие
// ============================================================================

import { Hero, Resources, Town } from '../types';
import { SeededRandom } from '../utils/Random';

/** Типы случайных событий (канон HoMM4) */
export type RandomEventType =
  | 'plague'              // Чума: -50% прирост существ
  | 'good_luck'           // Удача: +2 удачи всем героям
  | 'bad_luck'            // Неудача: -2 удачи всем героям
  | 'gold_rush'           // Золотой дождь: +5000 золота
  | 'tax_collector'       // Налог: -2000 золота
  | 'magic_wind'          // Волшебный ветер: +20 маны всем героям
  | 'magic_drought'       // Магическая засуха: -15 маны
  | 'blessing'            // Благословение: +1 мораль всем героям
  | 'curse'               // Проклятие: -1 мораль
  | 'double_growth'       // Двойной прирост: ×2 прирост существ
  | 'raid'                // Внезапное нападение: ИИ атакует город
  | 'merchant'            // Торговец: скидка 30% на найм
  | 'refugees'            // Беженцы: +10 случайных существ
  | 'harvest'             // Урожай: +5 ко всем ресурсам
  | 'drought';            // Засуха: -2 ко всем ресурсам

/** Интерфейс случайного события */
export interface RandomEvent {
  type: RandomEventType;
  name: string;
  description: string;
  icon: string;
  color: number;
  positive: boolean;
  duration: number; // в днях (0 = мгновенное)
}

/** Состояние активного события */
export interface ActiveEvent {
  event: RandomEvent;
  daysRemaining: number;
  appliedTo: string[]; // ID героев/городов, к которым применено
}

/** Определение всех 15 событий (канон HoMM4) */
const EVENT_DEFINITIONS: Record<RandomEventType, Omit<RandomEvent, 'type'>> = {
  plague: {
    name: 'Чума',
    description: 'Страшная чума поразила ваши земли. Прирост существ уменьшен на 50% на этой неделе.',
    icon: '☠️',
    color: 0x8B008B, // тёмно-фиолетовый
    positive: false,
    duration: 7,
  },
  good_luck: {
    name: 'Удача',
    description: 'Благосклонная судьба улыбнулась вашим героям! Удача +2 на этой неделе.',
    icon: '🍀',
    color: 0x00FF00, // зелёный
    positive: true,
    duration: 7,
  },
  bad_luck: {
    name: 'Неудача',
    description: 'Злой рок преследует ваших героев. Удача -2 на этой неделе.',
    icon: '💀',
    color: 0xFF0000, // красный
    positive: false,
    duration: 7,
  },
  gold_rush: {
    name: 'Золотой дождь',
    description: 'Неожиданная находка! Вы получаете 5000 золота.',
    icon: '💰',
    color: 0xFFD700, // золотой
    positive: true,
    duration: 0,
  },
  tax_collector: {
    name: 'Сборщик налогов',
    description: 'Королевский сборщик налогов требует 2000 золота.',
    icon: '📜',
    color: 0x8B4513, // коричневый
    positive: false,
    duration: 0,
  },
  magic_wind: {
    name: 'Волшебный ветер',
    description: 'Магический ветер наполняет ваших героев силой! +20 маны всем героям.',
    icon: '💨',
    color: 0x87CEEB, // голубой
    positive: true,
    duration: 0,
  },
  magic_drought: {
    name: 'Магическая засуха',
    description: 'Магическая энергия иссякает. Все герои теряют 15 маны.',
    icon: '🏜️',
    color: 0xD2691E, // оранжевый
    positive: false,
    duration: 0,
  },
  blessing: {
    name: 'Благословение',
    description: 'Боги благословили ваших героев! Мораль +1 на этой неделе.',
    icon: '✨',
    color: 0xFFD700, // золотой
    positive: true,
    duration: 7,
  },
  curse: {
    name: 'Проклятие',
    description: 'Тёмные силы прокляли ваших героев. Мораль -1 на этой неделе.',
    icon: '🌑',
    color: 0x4B0082, // индиго
    positive: false,
    duration: 7,
  },
  double_growth: {
    name: 'Двойной прирост',
    description: 'Небывалый всплеск рождаемости! Прирост существ ×2 на этой неделе.',
    icon: '📈',
    color: 0x00FF00, // зелёный
    positive: true,
    duration: 7,
  },
  raid: {
    name: 'Внезапное нападение',
    description: 'Вражеские силы атакуют ваши границы! Будьте готовы к обороне.',
    icon: '⚔️',
    color: 0xFF4500, // красно-оранжевый
    positive: false,
    duration: 0,
  },
  merchant: {
    name: 'Странствующий торговец',
    description: 'Загадочный торговец предлагает скидку 30% на найм существ в городе.',
    icon: '🧙',
    color: 0x9370DB, // фиолетовый
    positive: true,
    duration: 7,
  },
  refugees: {
    name: 'Беженцы',
    description: 'Группа беженцев просит убежища. 10 случайных существ присоединяются к армии.',
    icon: '🏕️',
    color: 0x808080, // серый
    positive: true,
    duration: 0,
  },
  harvest: {
    name: 'Богатый урожай',
    description: 'Отличный урожай! +5 ко всем ресурсам (дерево, руда, кристаллы, ртуть, самоцветы).',
    icon: '🌾',
    color: 0xFFD700, // золотой
    positive: true,
    duration: 0,
  },
  drought: {
    name: 'Засуха',
    description: 'Сильная засуха уничтожила запасы. -2 ко всем ресурсам.',
    icon: '☀️',
    color: 0xFF8C00, // тёмно-оранжевый
    positive: false,
    duration: 0,
  },
};

/**
 * Система случайных событий
 */
export class RandomEventsSystem {
  private static rng = new SeededRandom();
  private static activeEvent: ActiveEvent | null = null;
  private static eventHistory: RandomEvent[] = [];

  /**
   * Инициализация с seed
   */
  static init(seed: number): void {
    this.rng = new SeededRandom(seed);
    this.activeEvent = null;
    this.eventHistory = [];
  }

  /**
   * Установить seed для генератора
   */
  static setSeed(seed: number): void {
    this.rng = new SeededRandom(seed);
  }

  /**
   * Попытка сгенерировать событие (вызывается в начале каждой недели)
   * Шанс 30% что событие произойдёт
   */
  static tryGenerateEvent(): RandomEvent | null {
    // 30% шанс события
    if (this.rng.random() > 0.3) {
      return null;
    }

    // Выбираем случайное событие
    const types = Object.keys(EVENT_DEFINITIONS) as RandomEventType[];
    const randomType = types[this.rng.randomInt(0, types.length - 1)];
    const def = EVENT_DEFINITIONS[randomType];

    const event: RandomEvent = {
      type: randomType,
      ...def,
    };

    // Применяем событие
    this.applyEvent(event);

    // Сохраняем в истории
    this.eventHistory.push(event);

    // Устанавливаем как активное (если длительность > 0)
    if (event.duration > 0) {
      this.activeEvent = {
        event,
        daysRemaining: event.duration,
        appliedTo: [],
      };
    }

    return event;
  }

  /**
   * Применить эффект события
   */
  static applyEvent(event: RandomEvent): void {
    // Эффекты применяются через методы-обработчики
    // WorldScene вызывает соответствующие методы после показа UI
    console.log(`[RandomEvents] Применено событие: ${event.name}`);
  }

  /**
   * Применить эффект "Чума" (-50% прирост)
   * Возвращает множитель для прироста существ
   */
  static getGrowthMultiplier(): number {
    if (!this.activeEvent) return 1.0;

    switch (this.activeEvent.event.type) {
      case 'plague':
        return 0.5;
      case 'double_growth':
        return 2.0;
      default:
        return 1.0;
    }
  }

  /**
   * Применить бонусы удачи к герою
   */
  static applyLuckBonus(hero: Hero): void {
    if (!this.activeEvent) return;

    switch (this.activeEvent.event.type) {
      case 'good_luck':
        hero.luck = (hero.luck || 0) + 2;
        break;
      case 'bad_luck':
        hero.luck = (hero.luck || 0) - 2;
        break;
    }
  }

  /**
   * Применить бонусы морали к герою
   */
  static applyMoraleBonus(hero: Hero): void {
    if (!this.activeEvent) return;

    switch (this.activeEvent.event.type) {
      case 'blessing':
        hero.morale = (hero.morale || 0) + 1;
        break;
      case 'curse':
        hero.morale = (hero.morale || 0) - 1;
        break;
    }
  }

  /**
   * Применить мгновенные эффекты к ресурсам
   */
  static applyResourceEffect(resources: Resources): Resources {
    if (!this.activeEvent) return resources;

    const newResources = { ...resources };

    switch (this.activeEvent.event.type) {
      case 'gold_rush':
        newResources.gold += 5000;
        break;
      case 'tax_collector':
        newResources.gold = Math.max(0, newResources.gold - 2000);
        break;
      case 'harvest':
        newResources.wood += 5;
        newResources.ore += 5;
        newResources.crystal += 5;
        newResources.mercury += 5;
        newResources.gems += 5;
        break;
      case 'drought':
        newResources.wood = Math.max(0, newResources.wood - 2);
        newResources.ore = Math.max(0, newResources.ore - 2);
        newResources.crystal = Math.max(0, newResources.crystal - 2);
        newResources.mercury = Math.max(0, newResources.mercury - 2);
        newResources.gems = Math.max(0, newResources.gems - 2);
        break;
    }

    return newResources;
  }

  /**
   * Применить эффект маны к герою
   */
  static applyManaEffect(hero: Hero): void {
    if (!this.activeEvent) return;

    switch (this.activeEvent.event.type) {
      case 'magic_wind':
        hero.mana = (hero.mana || 0) + 20;
        hero.maxMana = (hero.maxMana || 20) + 20;
        break;
      case 'magic_drought':
        hero.mana = Math.max(0, (hero.mana || 0) - 15);
        break;
    }
  }

  /**
   * Обновить длительность активного события (вызывается каждый день)
   */
  static updateDaily(): void {
    if (!this.activeEvent) return;

    this.activeEvent.daysRemaining--;

    if (this.activeEvent.daysRemaining <= 0) {
      console.log(`[RandomEvents] Событие "${this.activeEvent.event.name}" завершилось`);
      this.activeEvent = null;
    }
  }

  /**
   * Получить активное событие
   */
  static getActiveEvent(): ActiveEvent | null {
    return this.activeEvent;
  }

  /**
   * Очистить активное событие
   */
  static clearActiveEvent(): void {
    this.activeEvent = null;
  }

  /**
   * Получить историю событий
   */
  static getHistory(): RandomEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Проверить, активно ли событие конкретного типа
   */
  static isEventActive(type: RandomEventType): boolean {
    return this.activeEvent?.event.type === type;
  }

  /**
   * Получить скидку торговца (если активен)
   */
  static getMerchantDiscount(): number {
    if (this.isEventActive('merchant')) {
      return 0.3; // 30% скидка
    }
    return 0;
  }

  /**
   * Сериализация для сохранения
   */
  static serialize(): any {
    return {
      activeEvent: this.activeEvent,
      eventHistory: this.eventHistory.map(e => e.type),
    };
  }

  /**
   * Восстановление из сохранения
   */
  static deserialize(data: any): void {
    if (!data) {
      this.activeEvent = null;
      this.eventHistory = [];
      return;
    }

    this.activeEvent = data.activeEvent || null;
    this.eventHistory = (data.eventHistory || []).map((type: RandomEventType) => ({
      type,
      ...EVENT_DEFINITIONS[type],
    }));
  }
}
