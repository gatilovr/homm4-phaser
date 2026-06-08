/**
 * NavalSystem - Система кораблей и морских путешествий
 * Канон HoMM4: верфи, посадка/высадка, движение по воде, морские сражения
 */

import { Hero, Ship, Resources, MapObject } from '../types';
import { CONFIG } from '../config';

/**
 * Тип корабля (в каноне HoMM4 был только 'boat')
 */
export type ShipType = 'boat';

/**
 * Стоимость кораблей
 */
export const SHIP_COSTS: Record<ShipType, number> = {
  boat: 1000,   // Обычная лодка - 1000 золота (канон HoMM4)
};

/**
 * Вместимость кораблей (количество слотов армии)
 */
export const SHIP_CAPACITY: Record<ShipType, number> = {
  boat: 7,      // Лодка - 7 слотов
};

/**
 * Бонусы скорости на воде
 */
export const SHIP_SPEED_BONUS: Record<ShipType, number> = {
  boat: 1.0,    // Лодка - базовая скорость
};

/**
 * Проверка возможности постройки верфи
 * Верфь требует: город у воды (хотя бы 1 водный тайл рядом)
 */
export function canBuildShipyard(
  townX: number,
  townY: number,
  map: any[][],
  mapWidth: number,
  mapHeight: number
): boolean {
  const radius = 2; // Проверяем 2 клетки вокруг города
  
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = townX + dx;
      const y = townY + dy;
      
      // Проверка границ карты
      if (x < 0 || x >= mapWidth || y < 0 || y >= mapHeight) {
        continue;
      }
      
      // Проверка воды
      const tile = map[y][x];
      if (tile && tile.type === 'water') {
        return true; // Нашли воду рядом с городом
      }
    }
  }
  
  return false; // Воды рядом нет
}

/**
 * Проверка доступности ресурсов для постройки корабля
 */
export function canAffordShip(resources: Resources, shipType: ShipType): boolean {
  const cost = SHIP_COSTS[shipType];
  return resources.gold >= cost;
}

/**
 * Постройка корабля (списание ресурсов)
 */
export function buildShip(resources: Resources, shipType: ShipType): Resources {
  const cost = SHIP_COSTS[shipType];
  return {
    ...resources,
    gold: resources.gold - cost,
  };
}

/**
 * Создание объекта корабля на карте
 */
export function createShipObject(
  x: number,
  y: number,
  shipType: ShipType,
  id?: string
): MapObject {
  return {
    id: id || `ship_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    type: 'boat',
    x,
    y,
    level: 'surface',
    data: {
      shipType,
      owner: 'neutral',
      capacity: SHIP_CAPACITY[shipType],
      speedBonus: SHIP_SPEED_BONUS[shipType],
    },
  };
}

/**
 * Проверка: может ли герой сесть на корабль
 * Требования:
 * 1. Герой на берегу (соседняя клетка с водой)
 * 2. Корабль на соседней водной клетке
 * 3. Корабль нейтральный или принадлежит игроку
 */
export function canBoardShip(
  hero: Hero,
  ship: MapObject,
  map: any[][]
): boolean {
  // Проверка расстояния (максимум 1 клетка)
  const dx = Math.abs(hero.x - ship.x);
  const dy = Math.abs(hero.y - ship.y);
  if (dx > 1 || dy > 1) {
    return false; // Слишком далеко
  }
  
  // Проверка что корабль на воде
  const shipTile = map[ship.y]?.[ship.x];
  if (!shipTile || shipTile.type !== 'water') {
    return false; // Корабль не на воде
  }
  
  // Проверка что герой на суше (не может сесть с воды на воду)
  // В HoMM4 герой не может перейти с одного корабля на другой
  if (hero.onShipId) {
    return false; // Герой уже на корабле
  }
  
  // Проверка владельца корабля
  const shipOwner = ship.data?.owner;
  if (shipOwner === 'enemy') {
    return false; // Вражеский корабль - нужно морское сражение
  }
  
  return true;
}

/**
 * Проверка: может ли герой высадиться с корабля
 * Требования:
 * 1. Герой на корабле
 * 2. Рядом есть суша (не вода, не скалы)
 */
export function canDisembark(
  hero: Hero,
  targetX: number,
  targetY: number,
  map: any[][]
): boolean {
  // Проверка что герой на корабле
  if (!hero.onShipId) {
    return false; // Герой не на корабле
  }
  
  // Проверка расстояния (максимум 1 клетка)
  const dx = Math.abs(hero.x - targetX);
  const dy = Math.abs(hero.y - targetY);
  if (dx > 1 || dy > 1) {
    return false; // Слишком далеко
  }
  
  // Проверка что целевая клетка - суша
  const targetTile = map[targetY]?.[targetX];
  if (!targetTile) {
    return false; // Клетка не существует
  }
  
  // Суша: всё кроме воды и скал
  const passableTypes = ['grass', 'sand', 'dirt', 'forest', 'swamp', 'lava', 'snow'];
  if (!passableTypes.includes(targetTile.type)) {
    return false; // Непроходимая местность
  }
  
  // Проверка что клетка свободна (нет объектов кроме собираемых)
  if (targetTile.object) {
    const blockingTypes = ['town', 'mine', 'garrison'];
    if (blockingTypes.includes(targetTile.object.type)) {
      return false; // Блокирующий объект
    }
  }
  
  return true;
}

/**
 * Посадка героя на корабль
 * Возвращает обновлённого героя (с onShipId) и флаг что корабль нужно убрать с карты
 */
export function boardShip(hero: Hero, ship: MapObject): { hero: Hero; shipConsumed: boolean } {
  return {
    hero: {
      ...hero,
      onShipId: ship.id, // Герой теперь на этом корабле
    },
    shipConsumed: true, // Корабль "входит" в героя (убирается с карты)
  };
}

/**
 * Высадка героя с корабля
 * Возвращает обновлённого героя и новый объект корабля на карте
 */
export function disembark(
  hero: Hero,
  targetX: number,
  targetY: number,
  shipType: ShipType = 'boat'
): { hero: Hero; shipObject: MapObject | null } {
  if (!hero.onShipId) {
    return { hero, shipObject: null };
  }
  
  // Создаём объект корабля на старой позиции героя
  const shipObject = createShipObject(hero.x, hero.y, shipType);
  shipObject.data!.owner = hero.owner; // Корабль принадлежит игроку
  
  return {
    hero: {
      ...hero,
      x: targetX,
      y: targetY,
      onShipId: null, // Герой больше не на корабле
    },
    shipObject,
  };
}

/**
 * Проверка: может ли герой двигаться по воде
 */
export function canMoveOnWater(hero: Hero): boolean {
  // Герой на корабле может двигаться по воде
  if (hero.onShipId) {
    return true;
  }
  
  // Заклинание Water Walk (если есть) - TODO: реализовать
  if (hero.waterWalk) {
    return true;
  }
  
  return false;
}

/**
 * Расчёт скорости героя на воде
 */
export function getWaterMovementSpeed(hero: Hero): number {
  if (!hero.onShipId) {
    return 0; // Не может двигаться по воде без корабля
  }
  
  const baseSpeed = hero.movementPoints;
  const bonus = SHIP_SPEED_BONUS.boat; // В каноне только один тип корабля
  
  return Math.floor(baseSpeed * bonus);
}

/**
 * Морское сражение ( boarding combat )
 * Когда герой на корабле встречает вражеский корабль
 * TODO: реализовать отдельную сцену морского боя
 */
export function initiateNavalBattle(
  attacker: Hero,
  defenderShip: MapObject
): { battleInitiated: boolean; message: string } {
  // Пока просто возвращаем сообщение
  // В будущем здесь будет запуск BattleScene с типом 'naval'
  return {
    battleInitiated: false,
    message: '⚓ Морские сражения пока не реализованы',
  };
}

/**
 * Потопление корабля (при поражении в морском бою)
 */
export function sinkShip(hero: Hero): { hero: Hero; message: string } {
  if (!hero.onShipId) {
    return { hero, message: 'У героя нет корабля' };
  }
  
  return {
    hero: {
      ...hero,
      onShipId: null,
      // Герой теряет всю армию при потоплении (канон HoMM4)
      army: [],
    },
    message: '💀 Корабль потоплен! Вся армия потеряна!',
  };
}

/**
 * Класс для управления флотом
 */
export class NavalSystem {
  private ships: Map<string, Ship> = new Map();
  
  /**
   * Зарегистрировать корабль
   */
  registerShip(ship: Ship): void {
    this.ships.set(ship.id, ship);
  }
  
  /**
   * Удалить корабль
   */
  unregisterShip(shipId: string): void {
    this.ships.delete(shipId);
  }
  
  /**
   * Получить корабль по ID
   */
  getShip(shipId: string): Ship | undefined {
    return this.ships.get(shipId);
  }
  
  /**
   * Получить все корабли
   */
  getAllShips(): Ship[] {
    return Array.from(this.ships.values());
  }
  
  /**
   * Получить корабли игрока
   */
  getPlayerShips(): Ship[] {
    return this.getAllShips().filter(ship => ship.owner === 'player');
  }
  
  /**
   * Получить корабли ИИ
   */
  getAIShips(): Ship[] {
    return this.getAllShips().filter(ship => ship.owner === 'ai');
  }
  
  /**
   * Очистить все данные
   */
  clear(): void {
    this.ships.clear();
  }
}

// Singleton instance
export const navalSystem = new NavalSystem();
