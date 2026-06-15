/**
 * ExternalDwellingSystem — система внешних жилищ существ (канон HoMM4)
 *
 * В каноне HoMM IV внешние жилища:
 * - Дают еженедельный прирост существ определённого типа
 * - Накапливают существ (банк), если их не нанимают
 * - Имеют флаг владельца (player/ai/neutral)
 * - Можно улучшить (как городские жилища)
 * - Можно нанимать существ прямо на карте
 *
 * Реализует:
 * - Еженедельный прирост для внешних жилищ
 * - Банк существ (накопление до 4 недель)
 * - Найм существ из жилища
 * - Захват жилища
 * - Улучшение жилища
 * - Сериализация для SaveSystem
 */

import { Hero, ArmySlot, OwnerType, FactionId, DwellingData, Resources } from '../types';

// ============================================================================
// КОНФИГУРАЦИЯ ВНЕШНИХ ЖИЛИЩ
// ============================================================================

/** Определение внешнего жилища */
export interface DwellingDefinition {
  /** Уникальный ID жилища */
  id: string;
  /** Название жилища */
  name: string;
  /** ID существа для найма (базовое) */
  creatureId: string;
  /** Название существа */
  creatureName: string;
  /** Фракция */
  faction: FactionId;
  /** Тир существа (1-7) */
  tier: number;
  /** Базовый прирост в неделю */
  baseGrowth: number;
  /** ID улучшенного существа */
  upgradedCreatureId?: string;
  /** Название улучшенного существа */
  upgradedCreatureName?: string;
  /** Стоимость улучшения */
  upgradeCost?: Partial<Resources>;
}

/** Результат найма из жилища */
export interface HireFromDwellingResult {
  success: boolean;
  message: string;
  creatureId: string;
  count: number;
  /** Стоимость золотом */
  goldCost: number;
}

/** Результат захвата жилища */
export interface CaptureDwellingResult {
  success: boolean;
  message: string;
  dwellingId: string;
  previousOwner: OwnerType;
  newOwner: OwnerType;
}

/** Результат улучшения жилища */
export interface UpgradeDwellingResult {
  success: boolean;
  message: string;
  dwellingId: string;
  cost: Partial<Resources>;
}

/** Результат прироста */
export interface WeeklyGrowthResult {
  dwellingId: string;
  creatureId: string;
  growth: number;
  newBankTotal: number;
}

// ============================================================================
// КОНФИГУРАЦИЯ ЦЕН
// ============================================================================

/** Стоимость найма существ из внешнего жилища (базовая) */
const HIRE_COST_PER_TIER: Record<number, number> = {
  1: 50,
  2: 80,
  3: 150,
  4: 250,
  5: 400,
  6: 600,
  7: 1000
};

/** Максимальный размер банка (в неделях накопления) */
const MAX_BANK_WEEKS = 4;

// ============================================================================
// ОПРЕДЕЛЕНИЯ ВНЕШНИХ ЖИЛИЩ
// ============================================================================

/** Все доступные внешние жилища */
export const DWELLING_DEFINITIONS: DwellingDefinition[] = [
  // === Нейтральные (любая фракция) ===
  {
    id: 'hill_fort',
    name: 'Холмная крепость',
    creatureId: 'goblin',
    creatureName: 'Гоблин',
    faction: 'neutral',
    tier: 1,
    baseGrowth: 8,
    upgradeCost: { gold: 1000, wood: 3 }
  },
  {
    id: 'dwarven_cottage',
    name: 'Домик гномов',
    creatureId: 'dwarf_h4',
    creatureName: 'Гном',
    faction: 'neutral',
    tier: 1,
    baseGrowth: 6,
    upgradeCost: { gold: 1200, ore: 3 }
  },
  {
    id: 'gnoll_hollow',
    name: 'Логово гноллов',
    creatureId: 'goblin',
    creatureName: 'Гнолл',
    faction: 'stronghold',
    tier: 1,
    baseGrowth: 7,
    upgradedCreatureId: 'hobgoblin',
    upgradedCreatureName: 'Гнолл-мародёр',
    upgradeCost: { gold: 800, wood: 2 }
  },
  {
    id: 'cyclops_cave',
    name: 'Пещера циклопов',
    creatureId: 'ogre_neutral',
    creatureName: 'Огр',
    faction: 'asylum',
    tier: 3,
    baseGrowth: 3,
    upgradedCreatureId: 'ogre_mage',
    upgradedCreatureName: 'Огр-маг',
    upgradeCost: { gold: 3000, ore: 5, crystal: 2 }
  },
  {
    id: 'dragon_cave',
    name: 'Логово драконов',
    creatureId: 'dragon_neutral',
    creatureName: 'Костяной дракон',
    faction: 'necropolis',
    tier: 7,
    baseGrowth: 1,
    upgradedCreatureId: 'ghost_dragon',
    upgradedCreatureName: 'Призрачный дракон',
    upgradeCost: { gold: 10000, mercury: 5, sulfur: 5 }
  },
  {
    id: 'elemental_altar',
    name: 'Алтарь элементалей',
    creatureId: 'fire_elemental',
    creatureName: 'Огненный элементаль',
    faction: 'academy',
    tier: 2,
    baseGrowth: 4,
    upgradeCost: { gold: 1500, crystal: 2 }
  },
  // === Haven ===
  {
    id: 'haven_outpost',
    name: 'Дозорный пост',
    creatureId: 'pikeman',
    creatureName: 'Пикинёр',
    faction: 'haven',
    tier: 1,
    baseGrowth: 10,
    upgradedCreatureId: 'halberdier',
    upgradedCreatureName: 'Алебардщик',
    upgradeCost: { gold: 1000, wood: 2 }
  },
  {
    id: 'haven_ranger_hut',
    name: 'Хижина лучника',
    creatureId: 'archer',
    creatureName: 'Лучник',
    faction: 'haven',
    tier: 2,
    baseGrowth: 7,
    upgradedCreatureId: 'crossbowman',
    upgradedCreatureName: 'Арбалетчик',
    upgradeCost: { gold: 1500, wood: 3 }
  },
  // === Necropolis ===
  {
    id: 'necro_grave',
    name: 'Старое кладбище',
    creatureId: 'skeleton',
    creatureName: 'Скелет',
    faction: 'necropolis',
    tier: 1,
    baseGrowth: 12,
    upgradedCreatureId: 'skeleton_warrior',
    upgradedCreatureName: 'Скелет-воин',
    upgradeCost: { gold: 500, ore: 2 }
  },
  {
    id: 'necro_haunted_house',
    name: 'Призрачный дом',
    creatureId: 'ghost',
    creatureName: 'Привидение',
    faction: 'necropolis',
    tier: 3,
    baseGrowth: 3,
    upgradedCreatureId: 'wraith',
    upgradedCreatureName: 'Призрак',
    upgradeCost: { gold: 2000, mercury: 2 }
  },
  // === Preserve ===
  {
    id: 'preserve_wolf_den',
    name: 'Волчье логово',
    creatureId: 'wolf',
    creatureName: 'Волк',
    faction: 'preserve',
    tier: 1,
    baseGrowth: 8,
    upgradedCreatureId: 'dire_wolf',
    upgradedCreatureName: 'Лютоволк',
    upgradeCost: { gold: 600, wood: 2 }
  },
  {
    id: 'preserve_elf_grove',
    name: 'Эльфийская роща',
    creatureId: 'elf',
    creatureName: 'Эльф',
    faction: 'preserve',
    tier: 2,
    baseGrowth: 5,
    upgradedCreatureId: 'grand_elf',
    upgradedCreatureName: 'Высший эльф',
    upgradeCost: { gold: 1000, wood: 3 }
  },
  // === Academy ===
  {
    id: 'academy_workshop',
    name: 'Мастерская',
    creatureId: 'gremlin',
    creatureName: 'Гремлин',
    faction: 'academy',
    tier: 1,
    baseGrowth: 10,
    upgradedCreatureId: 'master_gremlin',
    upgradedCreatureName: 'Мастер-гремлин',
    upgradeCost: { gold: 800, ore: 2 }
  },
  // === Stronghold ===
  {
    id: 'stronghold_gnoll_hut',
    name: 'Хижина гноллов',
    creatureId: 'gnoll',
    creatureName: 'Гнолл',
    faction: 'stronghold',
    tier: 1,
    baseGrowth: 9,
    upgradedCreatureId: 'gnoll_marauder',
    upgradedCreatureName: 'Гнолл-мародёр',
    upgradeCost: { gold: 600, wood: 2 }
  },
];

// ============================================================================
// ОСНОВНОЙ КЛАСС
// ============================================================================

export class ExternalDwellingSystem {
  /** Все жилища на карте */
  private dwellings: Map<string, DwellingData> = new Map();

  /** Определения жилищ (для быстрого доступа) */
  private definitions: Map<string, DwellingDefinition> = new Map();

  constructor() {
    // Индексируем определения
    for (const def of DWELLING_DEFINITIONS) {
      this.definitions.set(def.id, def);
    }
  }

  // ==========================================================================
  // СОЗДАНИЕ ЖИЛИЩ
  // ==========================================================================

  /**
   * Создать жилище на карте
   */
  createDwelling(
    dwellingId: string,
    definitionId: string,
    x: number,
    y: number,
    owner: OwnerType = 'neutral'
  ): DwellingData | null {
    const def = this.definitions.get(definitionId);
    if (!def) {
      console.warn(`[ExternalDwellingSystem] Unknown definition: ${definitionId}`);
      return null;
    }

    const dwelling: DwellingData = {
      dwellingId,
      dwellingName: def.name,
      creatureId: def.creatureId,
      creatureName: def.creatureName,
      faction: def.faction,
      tier: def.tier,
      baseGrowth: def.baseGrowth,
      bankedCreatures: def.baseGrowth, // Начальный банк = 1 неделя прироста
      owner,
      isUpgraded: false,
      upgradedCreatureId: def.upgradedCreatureId,
      upgradedCreatureName: def.upgradedCreatureName,
      lastGrowthDay: 0
    };

    this.dwellings.set(dwellingId, dwelling);
    return dwelling;
  }

  /**
   * Загрузить жилище из сохранения
   */
  loadDwelling(data: DwellingData): void {
    this.dwellings.set(data.dwellingId, data);
  }

  // ==========================================================================
  // ЕЖЕНЕДЕЛЬНЫЙ ПРИРОСТ
  // ==========================================================================

  /**
   * Применить еженедельный прирост для всех жилищ владельца
   */
  applyWeeklyGrowth(
    owner: OwnerType,
    currentDay: number,
    weekMultiplier: number = 1.0
  ): WeeklyGrowthResult[] {
    const results: WeeklyGrowthResult[] = [];

    for (const [id, dwelling] of this.dwellings) {
      if (dwelling.owner !== owner) continue;

      // Проверяем, не был ли уже применён прирост на этой неделе
      const currentWeek = Math.floor(currentDay / 7);
      const lastWeek = Math.floor(dwelling.lastGrowthDay / 7);
      if (currentWeek <= lastWeek && dwelling.lastGrowthDay > 0) continue;

      // Рассчитываем прирост
      let growth = dwelling.baseGrowth;

      // Модификатор недели
      growth = Math.floor(growth * weekMultiplier);

      // Модификатор улучшения (+50%)
      if (dwelling.isUpgraded) {
        growth = Math.floor(growth * 1.5);
      }

      // Добавляем в банк (с лимитом)
      const maxBank = dwelling.baseGrowth * MAX_BANK_WEEKS;
      dwelling.bankedCreatures = Math.min(
        dwelling.bankedCreatures + growth,
        maxBank
      );
      dwelling.lastGrowthDay = currentDay;

      results.push({
        dwellingId: id,
        creatureId: dwelling.isUpgraded ? (dwelling.upgradedCreatureId || dwelling.creatureId) : dwelling.creatureId,
        growth,
        newBankTotal: dwelling.bankedCreatures
      });
    }

    return results;
  }

  // ==========================================================================
  // НАЙМ СУЩЕСТВ
  // ==========================================================================

  /**
   * Нанять существ из внешнего жилища
   */
  hireFromDwelling(
    hero: Hero,
    dwellingId: string,
    count: number,
    resources?: Resources
  ): HireFromDwellingResult {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling) {
      return { success: false, message: 'Жилище не найдено', creatureId: '', count: 0, goldCost: 0 };
    }

    if (dwelling.bankedCreatures < count) {
      return {
        success: false,
        message: `Недостаточно существ (${dwelling.bankedCreatures} доступно)`,
        creatureId: '',
        count: 0,
        goldCost: 0
      };
    }

    // Стоимость найма (канон HoMM4: внешние жилища требуют золото)
    const costPerCreature = HIRE_COST_PER_TIER[dwelling.tier] || 100;
    const goldCost = costPerCreature * count;

    // Проверяем и списываем золото
    if (resources) {
      if (resources.gold < goldCost) {
        return {
          success: false,
          message: `Нужно ${goldCost} золота для найма ${count} существ`,
          creatureId: '',
          count: 0,
          goldCost
        };
      }
      resources.gold -= goldCost;
    }

    const creatureId = dwelling.isUpgraded ? (dwelling.upgradedCreatureId || dwelling.creatureId) : dwelling.creatureId;
    const creatureName = dwelling.isUpgraded ? (dwelling.upgradedCreatureName || dwelling.creatureName) : dwelling.creatureName;

    // Добавляем существа в армию героя
    const existing = hero.army.find(s => s.creatureId === creatureId);
    if (existing) {
      existing.count += count;
    } else {
      hero.army.push({ creatureId, count });
    }

    // Уменьшаем банк
    dwelling.bankedCreatures -= count;

    return {
      success: true,
      message: `Нанято ${count}×${creatureName} из ${dwelling.dwellingName} за ${goldCost} золота`,
      creatureId,
      count,
      goldCost
    };
  }

  // ==========================================================================
  // ЗАХВАТ ЖИЛИЩА
  // ==========================================================================

  /**
   * Захватить жилище (после боя с нейтралами или вражеским.hero)
   */
  captureDwelling(
    dwellingId: string,
    newOwner: OwnerType
  ): CaptureDwellingResult {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling) {
      return {
        success: false,
        message: 'Жилище не найдено',
        dwellingId,
        previousOwner: 'neutral',
        newOwner
      };
    }

    const previousOwner = dwelling.owner;
    dwelling.owner = newOwner;

    return {
      success: true,
      message: `${dwelling.dwellingName} захвачено!`,
      dwellingId,
      previousOwner,
      newOwner
    };
  }

  // ==========================================================================
  // УЛУЧШЕНИЕ ЖИЛИЩА
  // ==========================================================================

  /**
   * Улучшить внешнее жилище
   */
  upgradeDwelling(
    dwellingId: string,
    resources: Resources
  ): UpgradeDwellingResult {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling) {
      return {
        success: false,
        message: 'Жилище не найдено',
        dwellingId,
        cost: {}
      };
    }

    if (dwelling.isUpgraded) {
      return {
        success: false,
        message: 'Жилище уже улучшено',
        dwellingId,
        cost: {}
      };
    }

    if (!dwelling.upgradedCreatureId) {
      return {
        success: false,
        message: 'Это жилище нельзя улучшить',
        dwellingId,
        cost: {}
      };
    }

    // Получаем определение для стоимости улучшения
    const def = this.definitions.get(dwelling.dwellingId);
    const cost = def?.upgradeCost || { gold: 1000 };

    // Проверяем ресурсы
    if ((cost.gold || 0) > resources.gold) {
      return {
        success: false,
        message: `Нужно ${cost.gold} золота`,
        dwellingId,
        cost
      };
    }
    if ((cost.wood || 0) > resources.wood) {
      return {
        success: false,
        message: `Нужно ${cost.wood} дерева`,
        dwellingId,
        cost
      };
    }
    if ((cost.ore || 0) > resources.ore) {
      return {
        success: false,
        message: `Нужно ${cost.ore} руды`,
        dwellingId,
        cost
      };
    }
    if ((cost.crystal || 0) > resources.crystal) {
      return {
        success: false,
        message: `Нужно ${cost.crystal} кристаллов`,
        dwellingId,
        cost
      };
    }
    if ((cost.mercury || 0) > resources.mercury) {
      return {
        success: false,
        message: `Нужно ${cost.mercury} ртути`,
        dwellingId,
        cost
      };
    }

    // Списываем ресурсы
    resources.gold -= cost.gold || 0;
    resources.wood -= cost.wood || 0;
    resources.ore -= cost.ore || 0;
    resources.crystal -= cost.crystal || 0;
    resources.mercury -= cost.mercury || 0;

    // Улучшаем жилище
    dwelling.isUpgraded = true;
    dwelling.creatureId = dwelling.upgradedCreatureId;
    dwelling.creatureName = dwelling.upgradedCreatureName || dwelling.creatureName;

    // Увеличиваем банк улучшенных существ
    dwelling.bankedCreatures = Math.floor(dwelling.bankedCreatures * 1.5);

    return {
      success: true,
      message: `${dwelling.dwellingName} улучшено! Теперь нанимают ${dwelling.creatureName}`,
      dwellingId,
      cost
    };
  }

  // ==========================================================================
  // ПОЛУЧЕНИЕ ИНФОРМАЦИИ
  // ==========================================================================

  /**
   * Получить данные жилища
   */
  getDwelling(dwellingId: string): DwellingData | undefined {
    return this.dwellings.get(dwellingId);
  }

  /**
   * Получить все жилища владельца
   */
  getDwellingsByOwner(owner: OwnerType): DwellingData[] {
    return Array.from(this.dwellings.values()).filter(d => d.owner === owner);
  }

  /**
   * Получить все жилища
   */
  getAllDwellings(): DwellingData[] {
    return Array.from(this.dwellings.values());
  }

  /**
   * Получить определение жилища
   */
  getDefinition(definitionId: string): DwellingDefinition | undefined {
    return this.definitions.get(definitionId);
  }

  /**
   * Получить стоимость найма
   */
  getHireCost(dwellingId: string, count: number): number {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling) return 0;
    return (HIRE_COST_PER_TIER[dwelling.tier] || 100) * count;
  }

  /**
   * Проверить, можно ли нанять из жилища
   */
  canHireFromDwelling(dwellingId: string, count: number): boolean {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling) return false;
    return dwelling.bankedCreatures >= count;
  }

  /**
   * Проверить, можно ли улучшить жилище
   */
  canUpgradeDwelling(dwellingId: string, resources: Resources): boolean {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling || dwelling.isUpgraded || !dwelling.upgradedCreatureId) return false;

    const def = this.definitions.get(dwelling.dwellingId);
    const cost = def?.upgradeCost || { gold: 1000 };

    return (
      (cost.gold || 0) <= resources.gold &&
      (cost.wood || 0) <= resources.wood &&
      (cost.ore || 0) <= resources.ore &&
      (cost.crystal || 0) <= resources.crystal &&
      (cost.mercury || 0) <= resources.mercury
    );
  }

  /**
   * Получить информацию для отображения на карте
   */
  getDwellingDisplayInfo(dwellingId: string): string | null {
    const dwelling = this.dwellings.get(dwellingId);
    if (!dwelling) return null;

    const creatureName = dwelling.isUpgraded
      ? (dwelling.upgradedCreatureName || dwelling.creatureName)
      : dwelling.creatureName;

    return `${dwelling.bankedCreatures}× ${creatureName}`;
  }

  // ==========================================================================
  // СЕРИАЛИЗАЦИЯ
  // ==========================================================================

  /**
   * Получить состояние для сохранения
   */
  serialize(): DwellingData[] {
    return Array.from(this.dwellings.values());
  }

  /**
   * Восстановить состояние из сохранения
   */
  deserialize(data: DwellingData[]): void {
    this.dwellings.clear();
    for (const dwelling of data) {
      this.dwellings.set(dwelling.dwellingId, dwelling);
    }
  }
}
