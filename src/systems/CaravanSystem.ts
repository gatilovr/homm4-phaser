/**
 * CaravanSystem — Передача существ между городами (караваны)
 * 
 * В HoMM4 можно отправить караван с существами из одного города в другой.
 * Караван идёт несколько дней (зависит от расстояния).
 */

import type { ArmySlot } from '../types';

export interface Caravan {
  id: string;
  fromTownId: string;
  toTownId: string;
  units: ArmySlot[];
  startDay: number;
  arrivalDay: number;
  progress: number; // 0-100
}

export class CaravanSystem {
  private caravans: Map<string, Caravan> = new Map();
  private nextId: number = 1;

  /**
   * Отправить караван
   * @param fromTownId Откуда
   * @param toTownId Куда
   * @param units Существа
   * @param currentDay Текущий день
   * @param distance Расстояние (в клетках)
   */
  sendCaravan(
    fromTownId: string,
    toTownId: string,
    units: ArmySlot[],
    currentDay: number,
    distance: number = 10
  ): Caravan {
    // 1 день пути на каждые 5 клеток (минимум 1 день)
    const travelDays = Math.max(1, Math.ceil(distance / 5));

    const caravan: Caravan = {
      id: `caravan_${this.nextId++}`,
      fromTownId,
      toTownId,
      units: [...units],
      startDay: currentDay,
      arrivalDay: currentDay + travelDays,
      progress: 0
    };

    this.caravans.set(caravan.id, caravan);
    return caravan;
  }

  /**
   * Обновить караваны (вызывается каждый день)
   * @returns Список караванов, которые прибыли сегодня
   */
  updateDay(currentDay: number): Caravan[] {
    const arrived: Caravan[] = [];

    for (const caravan of this.caravans.values()) {
      // Обновляем прогресс
      const totalDays = caravan.arrivalDay - caravan.startDay;
      const elapsed = currentDay - caravan.startDay;
      caravan.progress = Math.min(100, Math.floor((elapsed / totalDays) * 100));

      // Проверяем прибытие
      if (currentDay >= caravan.arrivalDay) {
        arrived.push(caravan);
      }
    }

    // Удаляем прибывшие
    for (const caravan of arrived) {
      this.caravans.delete(caravan.id);
    }

    return arrived;
  }

  /**
   * Получить активные караваны для города
   */
  getCaravansForTown(townId: string): { incoming: Caravan[]; outgoing: Caravan[] } {
    const incoming: Caravan[] = [];
    const outgoing: Caravan[] = [];

    for (const caravan of this.caravans.values()) {
      if (caravan.toTownId === townId) incoming.push(caravan);
      if (caravan.fromTownId === townId) outgoing.push(caravan);
    }

    return { incoming, outgoing };
  }

  /**
   * Получить все активные караваны
   */
  getAllCaravans(): Caravan[] {
    return [...this.caravans.values()];
  }

  /**
   * Отменить караван
   */
  cancelCaravan(caravanId: string): ArmySlot[] | null {
    const caravan = this.caravans.get(caravanId);
    if (!caravan) return null;
    this.caravans.delete(caravanId);
    return caravan.units;
  }
}
