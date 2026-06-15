import { Resources } from '../types';

/**
 * ============================================================
 * 🏛️ ECONOMY SYSTEM — полная экономика HoMM4
 * ============================================================
 * - Шахты 7 типов с ежедневным доходом
 * - Еженедельный прирост существ
 * - Таблица апгрейдов (35+ апгрейдов)
 * - Рынок обмена ресурсов
 * - Магическая гильдия
 * - Ежедневный доход города
 * ============================================================
 */

// ============================================================
// 💎 ТИПЫ ШАХТ
// ============================================================

export type MineType = 'gold' | 'wood' | 'ore' | 'crystal' | 'gems' | 'sulfur' | 'mercury';

export const MINE_TYPES: Record<MineType, {
  name: string;
  icon: string;
  mineName: string;
  dailyIncome: number;
  color: number;
  weight: number;
}> = {
  gold: {
    name: 'Золотая шахта',
    icon: '💰',
    mineName: 'Золотая шахта',
    dailyIncome: 1000,
    color: 0xFFD700,
    weight: 35,
  },
  wood: {
    name: 'Лесопилка',
    icon: '🪵',
    mineName: 'Лесопилка',
    dailyIncome: 2,
    color: 0x8B4513,
    weight: 18,
  },
  ore: {
    name: 'Рудник',
    icon: '⛏️',
    mineName: 'Рудник',
    dailyIncome: 2,
    color: 0x808080,
    weight: 18,
  },
  crystal: {
    name: 'Хрустальная шахта',
    icon: '💎',
    mineName: 'Хрустальная шахта',
    dailyIncome: 1,
    color: 0x00FFFF,
    weight: 7,
  },
  gems: {
    name: 'Самоцветная шахта',
    icon: '💠',
    mineName: 'Самоцветная шахта',
    dailyIncome: 1,
    color: 0xFF69B4,
    weight: 7,
  },
  sulfur: {
    name: 'Серная шахта',
    icon: '🟡',
    mineName: 'Серная шахта',
    dailyIncome: 1,
    color: 0xFFFF00,
    weight: 8,
  },
  mercury: {
    name: 'Ртутная шахта',
    icon: '🩸',
    mineName: 'Ртутная шахта',
    dailyIncome: 1,
    color: 0xDC143C,
    weight: 7,
  },
};

/** Генерация случайного типа шахты по весам */
export function getRandomMineType(seed: number): MineType {
  const types = Object.keys(MINE_TYPES) as MineType[];
  const totalWeight = types.reduce((s, t) => s + MINE_TYPES[t].weight, 0);
  let r = Math.abs(seed * 9301 + 49297) % totalWeight;
  for (const t of types) {
    r -= MINE_TYPES[t].weight;
    if (r <= 0) return t;
  }
  return 'gold';
}

/** Применить доход от шахт ко всем ресурсам игрока */
export function applyMineIncome(
  resources: Resources,
  mineType: MineType
): Resources {
  const mine = MINE_TYPES[mineType];
  const newRes = { ...resources };
  if (mineType === 'gold') {
    newRes.gold = (newRes.gold || 0) + mine.dailyIncome;
  } else {
    (newRes as any)[mineType] = ((newRes as any)[mineType] || 0) + mine.dailyIncome;
  }
  return newRes;
}

// ============================================================
// 📈 ЕЖЕНЕДЕЛЬНЫЙ ПРИРОСТ СУЩЕСТВ
// ============================================================

/** Базовый еженедельный прирост существ по ID */
export const BASE_WEEKLY_GROWTH: Record<string, number> = {
  // Haven (4 tiers, choice)
  squire: 14, ballista: 14, pikeman_h4: 8, archer_h4: 8,
  crusader_h4: 5, monk_h4: 5, champion_h4: 2, angel_h4: 1,
  // Necropolis
  skeleton_h4: 14, imp_h4: 14, ghost_h4: 8, cerberus: 8,
  vampire_h4: 4, venom_spawn: 4, bone_dragon_h4: 2, devil_h4: 1,
  // Preserve
  sprite: 14, wolf_h4: 14, elf_h4: 8, white_tiger: 8,
  griffin_h4: 5, unicorn_h4: 5, faerie_dragon_h4: 2, phoenix_h4: 1,
  // Asylum
  bandit: 14, orc_h4: 14, medusa: 7, minotaur_h4: 7,
  nightmare: 4, efreet: 4, hydra: 2, black_dragon: 1,
  // Academy
  dwarf_h4: 10, halfling: 10, gold_golem_h4: 7, mage_h4: 7,
  naga_h4: 4, genie_h4: 4, dragon_golem: 2, titan_h4: 1,
  // Stronghold
  berserker: 14, centaur: 14, harpy: 7, nomad: 7,
  ogre_mage_h4: 4, cyclops_h4: 4, thunderbird_h4: 2, behemoth_h4: 1,
};

/** Расчёт еженедельного прироста для жилища */
export function calculateWeeklyGrowth(
  creatureId: string,
  hasCitadel: boolean = false,
  hasCastle: boolean = false,
  isUpgraded: boolean = false
): number {
  let base = BASE_WEEKLY_GROWTH[creatureId] || 2;
  // В каноне HoMM4: Цитадель +50%, Замок +100%
  if (hasCastle) {
    base = Math.floor(base * 2.0); // Замок: +100%
  } else if (hasCitadel) {
    base = Math.floor(base * 1.5); // Цитадель: +50%
  }
  if (isUpgraded) base = Math.floor(base * 1.5);
  return Math.max(1, base);
}

// ============================================================
// 💵 ЕЖЕДНЕВНЫЙ ДОХОД ГОРОДА
// ============================================================

/** Доход города в день (в золоте) - канон HoMM4 */
export function calculateTownDailyIncome(builtBuildings: string[]): number {
  let income = 250; // базовый доход (Village Hall)
  if (builtBuildings.includes('town_hall')) income += 250; // Town Hall: +250 (total 500)
  if (builtBuildings.includes('city_hall')) income += 500; // City Hall: +500 (total 1000)
  if (builtBuildings.includes('capitol')) income += 1000; // Capitol: +1000 (total 2000)
  return income;
}

// ============================================================
// ⬆️ ТАБЛИЦА АПГРЕЙДОВ
// ============================================================

export interface UpgradeCost {
  gold: number;
  wood?: number;
  ore?: number;
  crystal?: number;
  gems?: number;
  sulfur?: number;
  mercury?: number;
}

export interface UpgradeEntry {
  from: string;
  to: string;
  toName: string;
  cost: UpgradeCost;
  faction: string;
}

export const UPGRADE_TABLE: UpgradeEntry[] = [
  // HoMM4 не имеет апгрейдов существ — вместо этого система ВЫБОРА:
  // На каждом уровне 2 варианта существ, строишь жилище — выбираешь какое нанимать.
  // Таблица апгрейдов пуста (совместимость с UI).
];

/** Получить апгрейд для существа */
export function getUpgrade(creatureId: string): UpgradeEntry | undefined {
  return UPGRADE_TABLE.find(u => u.from === creatureId);
}

/** Проверить может ли игрок оплатить апгрейд */
export function canAffordUpgrade(resources: Resources, cost: UpgradeCost): boolean {
  if ((resources.gold || 0) < cost.gold) return false;
  if (cost.wood && (resources.wood || 0) < cost.wood) return false;
  if (cost.ore && (resources.ore || 0) < cost.ore) return false;
  if (cost.crystal && (resources.crystal || 0) < cost.crystal) return false;
  if (cost.gems && (resources.gems || 0) < cost.gems) return false;
  if (cost.sulfur && (resources.sulfur || 0) < cost.sulfur) return false;
  if (cost.mercury && (resources.mercury || 0) < cost.mercury) return false;
  return true;
}

/** Применить апгрейд — списать ресурсы и вернуть новое существо */
export function applyUpgrade(
  resources: Resources,
  cost: UpgradeCost
): Resources {
  return {
    gold: (resources.gold || 0) - cost.gold,
    wood: (resources.wood || 0) - (cost.wood || 0),
    ore: (resources.ore || 0) - (cost.ore || 0),
    crystal: (resources.crystal || 0) - (cost.crystal || 0),
    gems: (resources.gems || 0) - (cost.gems || 0),
    sulfur: (resources.sulfur || 0) - (cost.sulfur || 0),
    mercury: (resources.mercury || 0) - (cost.mercury || 0),
  };
}

// ============================================================
// 💱 РЫНОК — курсы обмена
// ============================================================

/** Базовые курсы рынка (продажа/покупка) */
export const BASE_MARKET_RATES: Record<string, { sell: number; buy: number }> = {
  wood: { sell: 400, buy: 750 },
  ore: { sell: 400, buy: 750 },
  crystal: { sell: 900, buy: 1500 },
  gems: { sell: 900, buy: 1500 },
  sulfur: { sell: 900, buy: 1500 },
  mercury: { sell: 900, buy: 1500 },
};

// ============================================================
// 🧙 МАГИЧЕСКАЯ ГИЛЬДИЯ
// ============================================================

export interface MageGuildOffer {
  spellId: string;
  spellName: string;
  school: string;
  level: number;
  cost: number;
}

/** Генерация предложений магической гильдии */
export function generateMageGuildOffers(
  guildLevel: number,
  availableSpellIds: string[]
): MageGuildOffer[] {
  const offers: MageGuildOffer[] = [];
  const count = Math.min(2 + guildLevel, 5);

  // Примеры заклинаний с правильными школами HoMM4 (канон)
  const sampleSpells = [
    // LIFE (Жизнь)
    { id: 'bless', name: 'Благословение', school: 'life', level: 1, cost: 500 },
    { id: 'mass_bless', name: 'Массовое благословение', school: 'life', level: 3, cost: 2500 },
    { id: 'heal', name: 'Исцеление', school: 'life', level: 2, cost: 1000 },
    { id: 'guardian_angel', name: 'Ангел-хранитель', school: 'life', level: 4, cost: 4000 },
    { id: 'resurrect', name: 'Воскрешение', school: 'life', level: 4, cost: 4000 },
    { id: 'resurrection_mass', name: 'Массовое воскрешение', school: 'life', level: 5, cost: 8000 },
    { id: 'regeneration', name: 'Регенерация', school: 'life', level: 2, cost: 1000 },
    { id: 'anti_magic', name: 'Антимагия', school: 'life', level: 3, cost: 2500 },
    { id: 'mass_antimagic', name: 'Массовая антимагия', school: 'life', level: 5, cost: 8000 },
    { id: 'holy_light', name: 'Святой свет', school: 'life', level: 4, cost: 4000 },
    { id: 'destroy_unholy', name: 'Разрушение нечисти', school: 'life', level: 4, cost: 4000 },
    { id: 'purify', name: 'Очищение', school: 'life', level: 2, cost: 1000 },
    
    // DEATH (Смерть)
    { id: 'implosion', name: 'Имплозия', school: 'death', level: 3, cost: 2500 },
    { id: 'animate_dead', name: 'Оживление мёртвых', school: 'death', level: 4, cost: 4000 },
    { id: 'drain_life', name: 'Пожирание жизни', school: 'death', level: 2, cost: 1000 },
    { id: 'weakness', name: 'Слабость', school: 'death', level: 1, cost: 500 },
    { id: 'curse', name: 'Проклятие', school: 'death', level: 1, cost: 500 },
    { id: 'mass_curse', name: 'Массовое проклятие', school: 'death', level: 3, cost: 2500 },
    { id: 'soul_eater', name: 'Пожиратель душ', school: 'death', level: 4, cost: 4000 },
    { id: 'misery', name: 'Скорбь', school: 'death', level: 2, cost: 1000 },
    { id: 'vampirism', name: 'Вампиризм', school: 'death', level: 4, cost: 4000 },
    { id: 'summon_daemons', name: 'Призыв демонов', school: 'death', level: 5, cost: 8000 },
    
    // ORDER (Порядок)
    { id: 'slow', name: 'Замедление', school: 'order', level: 1, cost: 500 },
    { id: 'mass_slow', name: 'Массовое замедление', school: 'order', level: 3, cost: 2500 },
    { id: 'haste', name: 'Ускорение', school: 'order', level: 1, cost: 500 },
    { id: 'mass_haste', name: 'Массовое ускорение', school: 'order', level: 3, cost: 2500 },
    { id: 'shield', name: 'Щит', school: 'order', level: 1, cost: 500 },
    { id: 'mass_shield', name: 'Массовый щит', school: 'order', level: 3, cost: 2500 },
    { id: 'teleport', name: 'Телепорт', school: 'order', level: 3, cost: 2500 },
    { id: 'dimension_door', name: 'Дверь измерений', school: 'order', level: 4, cost: 4000 },
    { id: 'blind', name: 'Ослепление', school: 'order', level: 2, cost: 1500 },
    { id: 'forgetfulness', name: 'Забывчивость', school: 'order', level: 2, cost: 1500 },
    { id: 'clone', name: 'Зеркальный образ', school: 'order', level: 4, cost: 4000 },
    { id: 'dispel', name: 'Развеивание магии', school: 'order', level: 2, cost: 1000 },
    { id: 'precision', name: 'Точность', school: 'order', level: 2, cost: 1000 },
    { id: 'shield_wall', name: 'Стена щитов', school: 'order', level: 2, cost: 1000 },
    { id: 'view_air', name: 'Взгляд с воздуха', school: 'order', level: 3, cost: 2500 },
    { id: 'view_earth', name: 'Взгляд с высоты', school: 'order', level: 4, cost: 4000 },
    
    // CHAOS (Хаос)
    { id: 'bloodlust', name: 'Жажда крови', school: 'chaos', level: 1, cost: 500 },
    { id: 'fireball', name: 'Огненный шар', school: 'chaos', level: 3, cost: 2500 },
    { id: 'lightning', name: 'Молния', school: 'chaos', level: 2, cost: 1500 },
    { id: 'chain_lightning', name: 'Цепная молния', school: 'chaos', level: 4, cost: 4000 },
    { id: 'inferno', name: 'Инферно', school: 'chaos', level: 4, cost: 4000 },
    { id: 'meteor', name: 'Метеоритный дождь', school: 'chaos', level: 4, cost: 4000 },
    { id: 'armageddon', name: 'Армагеддон', school: 'chaos', level: 5, cost: 8000 },
    { id: 'berserk', name: 'Берсерк', school: 'chaos', level: 3, cost: 2500 },
    { id: 'poison', name: 'Отравление', school: 'chaos', level: 2, cost: 1000 },
    { id: 'confusion', name: 'Путаница', school: 'chaos', level: 3, cost: 2500 },
    { id: 'hellfire', name: 'Адский огонь', school: 'chaos', level: 4, cost: 4000 },
    { id: 'thunder_storm', name: 'Грозовой шторм', school: 'chaos', level: 4, cost: 4000 },
    
    // NATURAL (Природа)
    { id: 'stoneskin', name: 'Каменная кожа', school: 'natural', level: 1, cost: 500 },
    { id: 'bark_skin', name: 'Кора дерева', school: 'natural', level: 1, cost: 500 },
    { id: 'fly', name: 'Полёт', school: 'natural', level: 3, cost: 2500 },
    { id: 'water_walk', name: 'Хождение по воде', school: 'natural', level: 3, cost: 2500 },
    { id: 'earthquake', name: 'Землетрясение', school: 'natural', level: 4, cost: 4000 },
    { id: 'summon_elementals', name: 'Призыв элементалей', school: 'natural', level: 4, cost: 4000 },
    { id: 'antidote', name: 'Антидот', school: 'natural', level: 2, cost: 1000 },
    { id: 'strength', name: 'Сила', school: 'natural', level: 2, cost: 1000 },
    { id: 'eruption', name: 'Извержение', school: 'natural', level: 3, cost: 2500 },
    { id: 'mirage', name: 'Мираж', school: 'natural', level: 3, cost: 2500 },
    { id: 'thunderbolt', name: 'Громовой удар', school: 'natural', level: 3, cost: 2500 },
    { id: 'pathfinding', name: 'Сквозной путь', school: 'natural', level: 2, cost: 1000 },
    { id: 'land_mine', name: 'Земляная мина', school: 'natural', level: 2, cost: 1000 },
    { id: 'force_field', name: 'Силовое поле', school: 'natural', level: 3, cost: 2500 },
  ];

  // Фильтруем по уровню гильдии
  const filtered = sampleSpells.filter(s => s.level <= guildLevel + 1);

  // Перемешиваем и берём N штук
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  for (let i = 0; i < count && i < shuffled.length; i++) {
    const s = shuffled[i];
    offers.push({
      spellId: s.id,
      spellName: s.name,
      school: s.school,
      level: s.level,
      cost: s.cost,
    });
  }

  return offers;
}

// ============================================================
// 🏛️ ECONOMY SYSTEM — основной класс
// ============================================================

export class EconomySystem {
  private mineIncome: Map<string, MineType> = new Map();

  constructor() {}

  /** Зарегистрировать шахту */
  registerMine(mineId: string, type: MineType): void {
    this.mineIncome.set(mineId, type);
  }

  /** Удалить шахту (если захвачена) */
  unregisterMine(mineId: string): void {
    this.mineIncome.delete(mineId);
  }

  /** Получить доход игрока за день от всех шахт */
  calculateDailyMineIncome(playerMineIds: string[]): { resources: Partial<Resources>; details: string[] } {
    const income: Partial<Resources> = {};
    const details: string[] = [];

    for (const mineId of playerMineIds) {
      const type = this.mineIncome.get(mineId);
      if (!type) continue;
      const mine = MINE_TYPES[type];

      if (type === 'gold') {
        income.gold = (income.gold || 0) + mine.dailyIncome;
      } else {
        (income as any)[type] = ((income as any)[type] || 0) + mine.dailyIncome;
      }

      details.push(`${mine.icon} ${mine.mineName}: +${mine.dailyIncome} ${type === 'gold' ? 'золота' : type}`);
    }

    return { resources: income, details };
  }

  /** Применить весь дневной доход (шахты + города) */
  applyDailyIncome(
    resources: Resources,
    playerMineIds: string[],
    playerTowns: Array<{ builtBuildings: string[] }>
  ): { newResources: Resources; incomeDetails: string[] } {
    const details: string[] = [];
    let newRes = { ...resources };

    // Доход от шахт
    const mineIncome = this.calculateDailyMineIncome(playerMineIds);
    for (const key of Object.keys(mineIncome.resources) as (keyof Resources)[]) {
      (newRes as any)[key] = ((newRes as any)[key] || 0) + (mineIncome.resources[key] || 0);
    }
    details.push(...mineIncome.details);

    // Доход от городов
    let townTotal = 0;
    for (const town of playerTowns) {
      const income = calculateTownDailyIncome(town.builtBuildings);
      townTotal += income;
    }
    if (townTotal > 0) {
      newRes.gold = (newRes.gold || 0) + townTotal;
      details.push(`🏰 Доход городов: +${townTotal} золота`);
    }

    return { newResources: newRes, incomeDetails: details };
  }
}
