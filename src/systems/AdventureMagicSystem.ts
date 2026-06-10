/**
 * AdventureMagicSystem - Система заклинаний на карте приключений (канон HoMM4)
 * 
 * Реализует 8 канонных заклинаний:
 * - Town Portal (Городской портал)
 * - Dimension Door (Дверь измерений)
 * - Fly (Полёт)
 * - Water Walk (Хождение по воде)
 * - Summon Boat (Призыв корабля)
 * - Scuttle Boat (Потопление корабля)
 * - Visions (Видения)
 * - Identify Hero (Опознать героя)
 */

import { Hero, MapObject, Tile, TileType, Resources } from '../types';
import { SpellSystem } from './SpellSystem';

/**
 * Тип заклинания на карте
 */
export type AdventureSpellId = 
  | 'townPortal'
  | 'dimensionDoor'
  | 'fly'
  | 'waterWalk'
  | 'summonBoat'
  | 'scuttleBoat'
  | 'visions'
  | 'identifyHero';

/**
 * Информация о заклинании на карте
 */
export interface AdventureSpell {
  id: AdventureSpellId;
  name: string;
  icon: string;
  description: string;
  manaCost: { basic: number; advanced: number; expert: number };
  school: 'life' | 'death' | 'order' | 'chaos' | 'natural' | 'tactics';
  targetType: 'self' | 'town' | 'tile' | 'boat' | 'hero';
  duration?: 'instant' | 'day';
}

/**
 * Результат применения заклинания
 */
export interface AdventureSpellResult {
  success: boolean;
  message: string;
  manaUsed: number;
  data?: any;
}

/**
 * Информация о вражеском герое (для Visions/Identify Hero)
 */
export interface HeroInfo {
  name: string;
  level: number;
  stats: { attack: number; defense: number; spellPower: number; knowledge: number };
  army: { creature: string; count: number }[];
  equipment?: any;
}

/**
 * Конфигурация всех заклинаний на карте (канон HoMM4)
 */
export const ADVENTURE_SPELLS: Record<AdventureSpellId, AdventureSpell> = {
  townPortal: {
    id: 'townPortal',
    name: 'Городской портал',
    icon: '🏰',
    description: 'Мгновенно перемещает героя в ближайший свой город',
    manaCost: { basic: 20, advanced: 15, expert: 10 },
    school: 'order',
    targetType: 'town',
    duration: 'instant'
  },
  
  dimensionDoor: {
    id: 'dimensionDoor',
    name: 'Дверь измерений',
    icon: '🌀',
    description: 'Телепортирует героя на выбранную клетку (макс. 3 клетки)',
    manaCost: { basic: 25, advanced: 20, expert: 15 },
    school: 'order',
    targetType: 'tile',
    duration: 'instant'
  },
  
  fly: {
    id: 'fly',
    name: 'Полёт',
    icon: '🦅',
    description: 'Герой летит над препятствиями до конца дня',
    manaCost: { basic: 20, advanced: 15, expert: 10 },
    school: 'natural',
    targetType: 'self',
    duration: 'day'
  },
  
  waterWalk: {
    id: 'waterWalk',
    name: 'Хождение по воде',
    icon: '🌊',
    description: 'Герой идёт по воде как по суше до конца дня',
    manaCost: { basic: 15, advanced: 10, expert: 8 },
    school: 'natural',
    targetType: 'self',
    duration: 'day'
  },
  
  summonBoat: {
    id: 'summonBoat',
    name: 'Призыв корабля',
    icon: '⛵',
    description: 'Призывает ближайший корабль к берегу рядом с героем',
    manaCost: { basic: 12, advanced: 10, expert: 8 },
    school: 'natural',
    targetType: 'boat',
    duration: 'instant'
  },
  
  scuttleBoat: {
    id: 'scuttleBoat',
    name: 'Потопление корабля',
    icon: '💥',
    description: 'Уничтожает чужой корабль (60% шанс на Expert)',
    manaCost: { basic: 15, advanced: 12, expert: 10 },
    school: 'natural',
    targetType: 'boat',
    duration: 'instant'
  },
  
  visions: {
    id: 'visions',
    name: 'Видения',
    icon: '👁️',
    description: 'Показывает статы ближайших вражеских существ',
    manaCost: { basic: 10, advanced: 8, expert: 5 },
    school: 'natural',
    targetType: 'self',
    duration: 'instant'
  },
  
  identifyHero: {
    id: 'identifyHero',
    name: 'Опознать героя',
    icon: '🔍',
    description: 'Показывает экипировку и армию вражеского героя',
    manaCost: { basic: 10, advanced: 8, expert: 5 },
    school: 'order',
    targetType: 'hero',
    duration: 'instant'
  }
};

/**
 * Максимальная дистанция Dimension Door
 */
export const DIMENSION_DOOR_RANGE = 3;

/**
 * Максимальная дистанция Summon Boat
 */
export const SUMMON_BOAT_RANGE = 10;

/**
 * Шанс успеха Scuttle Boat по уровням
 */
export const SCUTTLE_BOAT_CHANCE = {
  basic: 0.30,      // 30%
  advanced: 0.45,   // 45%
  expert: 0.60      // 60%
};

/**
 * Основной класс системы заклинаний на карте
 */
export class AdventureMagicSystem {
  
  /**
   * Проверка: может ли герой использовать заклинание?
   */
  static canCastSpell(hero: Hero, spellId: AdventureSpellId): { canCast: boolean; reason?: string } {
    const spell = ADVENTURE_SPELLS[spellId];
    if (!spell) {
      return { canCast: false, reason: 'Заклинание не существует' };
    }
    
    // Проверка наличия заклинания (hero.spells — это string[])
    const hasSpell = hero.spells.includes(spellId);
    if (!hasSpell) {
      return { canCast: false, reason: 'У героя нет этого заклинания' };
    }
    
    // Определение уровня школы
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    
    // Расчёт стоимости маны
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    // Проверка маны
    if (hero.mana < manaCost) {
      return { canCast: false, reason: `Недостаточно маны (нужно ${manaCost}, есть ${hero.mana})` };
    }
    
    return { canCast: true };
  }
  
  /**
   * Получить уровень школы магии героя.
   * Ищет навык соответствующей школы магии (life_magic, death_magic, order_magic, chaos_magic, natural_magic).
   * Для обратной совместимости со старыми сохранениями также проверяет устаревшие названия.
   */
  static getSchoolLevel(hero: Hero, school: string): 'basic' | 'advanced' | 'expert' {
    // Маппинг школ к ключевым словам в названиях навыков (HoMM4 канон)
    const schoolKeywords: Record<string, string[]> = {
      life: ['life', 'жизн', 'light'],
      death: ['death', 'смерт', 'dark'],
      order: ['order', 'поряд'],
      chaos: ['chaos', 'хаос'],
      natural: ['natural', 'природ'],
      tactics: ['tactics', 'тактик']
    };
    
    const keywords = schoolKeywords[school] || [school];
    
    // Ищем навык соответствующей школы
    const schoolSkill = hero.skills.find(s => {
      const nameLower = s.name.toLowerCase();
      return keywords.some(kw => nameLower.includes(kw)) ||
             nameLower.includes('школа') ||
             nameLower.includes('magic');
    });
    
    if (!schoolSkill) return 'basic';
    
    const level = schoolSkill.level || 1;
    if (level >= 3) return 'expert';
    if (level >= 2) return 'advanced';
    return 'basic';
  }
  
  /**
   * Расчёт стоимости маны с учётом уровня школы
   */
  static calculateManaCost(spell: AdventureSpell, schoolLevel: 'basic' | 'advanced' | 'expert'): number {
    return spell.manaCost[schoolLevel];
  }
  
  /**
   * Применение Town Portal (Городской портал)
   * @returns Позиция города или null
   */
  static castTownPortal(
    hero: Hero, 
    playerTowns: { id: string; name: string; x: number; y: number }[],
    map: Tile[][]
  ): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.townPortal;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    // Проверка маны
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    // Найти ближайший свой город
    let nearestTown = null;
    let minDistance = Infinity;
    
    for (const town of playerTowns) {
      const distance = Math.abs(hero.x - town.x) + Math.abs(hero.y - town.y);
      if (distance < minDistance) {
        minDistance = distance;
        nearestTown = town;
      }
    }
    
    if (!nearestTown) {
      return { success: false, message: 'Нет доступных городов', manaUsed: 0 };
    }
    
    // Проверка: клетка рядом с городом свободна?
    const targetPos = this.findFreeTileNear(nearestTown.x, nearestTown.y, map);
    if (!targetPos) {
      return { success: false, message: 'Нет свободного места рядом с городом', manaUsed: 0 };
    }
    
    // Применение
    hero.mana -= manaCost;
    
    return {
      success: true,
      message: `🏰 Телепортация в ${nearestTown.name}!`,
      manaUsed: manaCost,
      data: { x: targetPos.x, y: targetPos.y, townName: nearestTown.name }
    };
  }
  
  /**
   * Применение Dimension Door (Дверь измерений)
   */
  static castDimensionDoor(
    hero: Hero,
    targetX: number,
    targetY: number,
    map: Tile[][]
  ): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.dimensionDoor;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    // Проверка маны
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    // Проверка дистанции (макс 3 клетки)
    const distance = Math.max(Math.abs(hero.x - targetX), Math.abs(hero.y - targetY));
    if (distance > DIMENSION_DOOR_RANGE) {
      return { success: false, message: `Слишком далеко (макс ${DIMENSION_DOOR_RANGE} клетки)`, manaUsed: 0 };
    }
    
    // Проверка проходимости клетки
    if (!map[targetY] || !map[targetY][targetX]) {
      return { success: false, message: 'Недопустимая клетка', manaUsed: 0 };
    }
    
    const targetTile = map[targetY][targetX];
    if (targetTile.type === 'water' || targetTile.type === 'rock' || targetTile.type === 'lava') {
      return { success: false, message: 'Нельзя телепортироваться в воду, скалы или лаву', manaUsed: 0 };
    }
    
    if (targetTile.object) {
      return { success: false, message: 'Клетка занята объектом', manaUsed: 0 };
    }
    
    // Применение
    hero.mana -= manaCost;
    
    return {
      success: true,
      message: `🌀 Телепортация на (${targetX}, ${targetY})!`,
      manaUsed: manaCost,
      data: { x: targetX, y: targetY }
    };
  }
  
  /**
   * Применение Fly (Полёт)
   */
  static castFly(hero: Hero): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.fly;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    hero.mana -= manaCost;
    
    // Устанавливаем флаг полёта (сбрасывается в конце дня)
    (hero as any).flyActive = true;
    
    return {
      success: true,
      message: '🦅 Герой летит над препятствиями!',
      manaUsed: manaCost,
      data: { flyActive: true }
    };
  }
  
  /**
   * Применение Water Walk (Хождение по воде)
   */
  static castWaterWalk(hero: Hero): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.waterWalk;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    hero.mana -= manaCost;
    
    // Устанавливаем флаг (сбрасывается в конце дня)
    (hero as any).waterWalkActive = true;
    
    return {
      success: true,
      message: '🌊 Герой идёт по воде!',
      manaUsed: manaCost,
      data: { waterWalkActive: true }
    };
  }
  
  /**
   * Применение Summon Boat (Призыв корабля)
   */
  static castSummonBoat(
    hero: Hero,
    ships: MapObject[],
    map: Tile[][]
  ): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.summonBoat;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    // Найти ближайший корабль
    let nearestShip = null;
    let minDistance = Infinity;
    
    for (const ship of ships) {
      if (ship.type !== 'boat') continue;
      const distance = Math.abs(hero.x - ship.x) + Math.abs(hero.y - ship.y);
      if (distance < minDistance && distance <= SUMMON_BOAT_RANGE) {
        minDistance = distance;
        nearestShip = ship;
      }
    }
    
    if (!nearestShip) {
      return { success: false, message: 'Нет кораблей в радиусе', manaUsed: 0 };
    }
    
    // Найти водную клетку рядом с героем
    const waterTile = this.findWaterTileNear(hero.x, hero.y, map);
    if (!waterTile) {
      return { success: false, message: 'Нет воды рядом с героем', manaUsed: 0 };
    }
    
    hero.mana -= manaCost;
    
    return {
      success: true,
      message: '⛵ Корабль призван к берегу!',
      manaUsed: manaCost,
      data: { 
        shipId: nearestShip.id,
        fromX: nearestShip.x,
        fromY: nearestShip.y,
        toX: waterTile.x,
        toY: waterTile.y
      }
    };
  }
  
  /**
   * Применение Scuttle Boat (Потопление корабля)
   */
  static castScuttleBoat(hero: Hero, targetShip: MapObject): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.scuttleBoat;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    // Проверка: это чужой корабль?
    if (targetShip.owner === hero.owner) {
      return { success: false, message: 'Нельзя потопить свой корабль', manaUsed: 0 };
    }
    
    // Шанс успеха зависит от уровня школы
    const chance = SCUTTLE_BOAT_CHANCE[schoolLevel];
    const success = Math.random() < chance;
    
    hero.mana -= manaCost;
    
    if (success) {
      return {
        success: true,
        message: `💥 Корабль потоплен! (шанс ${Math.round(chance * 100)}%)`,
        manaUsed: manaCost,
        data: { shipId: targetShip.id }
      };
    } else {
      return {
        success: false,
        message: `💨 Попытка не удалась (шанс был ${Math.round(chance * 100)}%)`,
        manaUsed: manaCost
      };
    }
  }
  
  /**
   * Применение Visions (Видения)
   */
  static castVisions(hero: Hero, nearbyEnemies: MapObject[]): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.visions;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    if (nearbyEnemies.length === 0) {
      return { success: false, message: 'Нет врагов в радиусе обзора', manaUsed: 0 };
    }
    
    hero.mana -= manaCost;
    
    // Собрать информацию о врагах
    const enemyInfo = nearbyEnemies.map(enemy => ({
      id: enemy.id,
      type: enemy.type,
      name: enemy.data?.name || enemy.type,
      count: enemy.data?.count || 1,
      position: { x: enemy.x, y: enemy.y }
    }));
    
    return {
      success: true,
      message: `👁️ Обнаружено ${enemyInfo.length} врагов!`,
      manaUsed: manaCost,
      data: { enemies: enemyInfo }
    };
  }
  
  /**
   * Применение Identify Hero (Опознать героя)
   */
  static castIdentifyHero(hero: Hero, targetHero: Hero): AdventureSpellResult {
    const spell = ADVENTURE_SPELLS.identifyHero;
    const schoolLevel = this.getSchoolLevel(hero, spell.school);
    const manaCost = this.calculateManaCost(spell, schoolLevel);
    
    if (hero.mana < manaCost) {
      return { success: false, message: 'Недостаточно маны', manaUsed: 0 };
    }
    
    if (targetHero.owner === hero.owner) {
      return { success: false, message: 'Нельзя опознать своего героя', manaUsed: 0 };
    }
    
    hero.mana -= manaCost;
    
    // Собрать информацию о вражеском герое
    const heroInfo: HeroInfo = {
      name: targetHero.name,
      level: targetHero.level,
      stats: targetHero.stats,
      army: targetHero.army.map(slot => ({
        creature: slot.creatureId,
        count: slot.count
      })),
      equipment: targetHero.equipment
    };
    
    return {
      success: true,
      message: `🔍 Герой ${targetHero.name} опознан!`,
      manaUsed: manaCost,
      data: { heroInfo }
    };
  }
  
  /**
   * Сброс дневных эффектов (Fly, Water Walk) в конце дня
   */
  static resetDailyEffects(hero: Hero): void {
    (hero as any).flyActive = false;
    (hero as any).waterWalkActive = false;
  }
  
  /**
   * Проверка: активен ли полёт?
   */
  static isFlying(hero: Hero): boolean {
    return !!(hero as any).flyActive;
  }
  
  /**
   * Проверка: активно ли хождение по воде?
   */
  static isWaterWalking(hero: Hero): boolean {
    return !!(hero as any).waterWalkActive;
  }
  
  /**
   * Вспомогательный: найти свободную клетку рядом с позицией
   */
  private static findFreeTileNear(x: number, y: number, map: Tile[][]): { x: number; y: number } | null {
    const directions = [
      [0, 1], [1, 0], [0, -1], [-1, 0],  // 4 основных
      [1, 1], [1, -1], [-1, 1], [-1, -1]  // 4 диагональных
    ];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (map[ny] && map[ny][nx]) {
        const tile = map[ny][nx];
        if (tile.type !== 'water' && 
            tile.type !== 'rock' && 
            tile.type !== 'lava' &&
            !tile.object) {
          return { x: nx, y: ny };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Вспомогательный: найти водную клетку рядом с позицией
   */
  private static findWaterTileNear(x: number, y: number, map: Tile[][]): { x: number; y: number } | null {
    const directions = [
      [0, 1], [1, 0], [0, -1], [-1, 0],
      [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      
      if (map[ny] && map[ny][nx]) {
        const tile = map[ny][nx];
        if (tile.type === 'water' && !tile.object) {
          return { x: nx, y: ny };
        }
      }
    }
    
    return null;
  }
  
  /**
   * Получить список всех доступных заклинаний для героя
   */
  static getAvailableSpells(hero: Hero): AdventureSpell[] {
    return Object.values(ADVENTURE_SPELLS).filter(spell => {
      const check = this.canCastSpell(hero, spell.id);
      return check.canCast;
    });
  }
  
  /**
   * Получить все заклинания героя с проверкой доступности
   */
  static getSpellsWithStatus(hero: Hero): Array<{
    spell: AdventureSpell;
    canCast: boolean;
    manaCost: number;
    reason?: string;
  }> {
    return Object.values(ADVENTURE_SPELLS).map(spell => {
      const check = this.canCastSpell(hero, spell.id);
      const schoolLevel = this.getSchoolLevel(hero, spell.school);
      const manaCost = this.calculateManaCost(spell, schoolLevel);
      
      return {
        spell,
        canCast: check.canCast,
        manaCost,
        reason: check.reason
      };
    });
  }
}
