import { BattleUnit, Hero } from '../types';
import { GameRandom } from '../utils/Random';
import { CONFIG } from '../config';
import { getCreatureType, isRanged, isFlying, hasAbility } from './CreatureTypes';

/**
 * Умный ИИ для боевых юнитов.
 * Выбирает цели по приоритетам и применяет тактики в зависимости от типа юнита.
 */
export class BattleAI {
  private getCreatureStats: (id: string) => { attack: number; defense: number; speed: number; damage: { min: number; max: number } };

  constructor(
    getCreatureStats: (id: string) => { attack: number; defense: number; speed: number; damage: { min: number; max: number } }
  ) {
    this.getCreatureStats = getCreatureStats;
  }

  /**
   * Выбрать лучшее действие для юнита ИИ.
   */
  decideAction(
    unit: BattleUnit,
    allUnits: BattleUnit[]
  ): { type: 'move'; x: number; y: number } | { type: 'attack'; target: BattleUnit } | { type: 'wait' } | { type: 'shoot'; target: BattleUnit } {
    const enemies = allUnits.filter(u => u.side !== unit.side && u.count > 0);
    const allies = allUnits.filter(u => u.side === unit.side && u.count > 0 && u.id !== unit.id);

    if (enemies.length === 0) {
      return { type: 'wait' };
    }

    const isRangedUnit = isRanged(unit.creatureId);
    const isFlyingUnit = isFlying(unit.creatureId);

    // === ТАКТИКА СТРЕЛКА ===
    if (isRangedUnit && this.canShootFromPosition(unit, enemies)) {
      const target = this.selectTarget(unit, enemies, true);
      if (target) {
        return { type: 'shoot', target };
      }
    }

    // === ТАКТИКА БЛИЖНЕГО БОЯ ===
    // 1. Атаковать ближайшего уязвимого врага (если рядом)
    const adjacentEnemies = enemies.filter(e => {
      const dist = Math.max(Math.abs(e.x - unit.x), Math.abs(e.y - unit.y));
      return dist <= 1;
    });

    if (adjacentEnemies.length > 0) {
      const target = this.selectTarget(unit, adjacentEnemies, false);
      if (target) {
        return { type: 'attack', target };
      }
    }

    // 2. Для летающих — сразу лететь к слабому врагу
    if (isFlyingUnit) {
      const weakestEnemy = this.getWeakestEnemy(unit, enemies);
      if (weakestEnemy) {
        const targetPos = this.getAdjacentPosition(weakestEnemy, allUnits);
        if (targetPos) {
          return { type: 'move', x: targetPos.x, y: targetPos.y };
        }
      }
    }

    // 3. Для стрелков, к которым подошли — отступать
    if (isRangedUnit && adjacentEnemies.length > 0) {
      const retreatPos = this.findRetreatPosition(unit, enemies, allUnits);
      if (retreatPos) {
        return { type: 'move', x: retreatPos.x, y: retreatPos.y };
      }
    }

    // 4. Приоритетные цели: стрелки → маги → герои → слабые
    const priorityTarget = this.selectPriorityTarget(unit, enemies);
    if (priorityTarget) {
      const targetPos = this.getAdjacentPosition(priorityTarget, allUnits);
      if (targetPos) {
        return { type: 'move', x: targetPos.x, y: targetPos.y };
      }
    }

    // 5. Двигаться к ближайшему врагу
    const closestEnemy = this.getClosestEnemy(unit, enemies);
    if (closestEnemy) {
      const targetPos = this.getAdjacentPosition(closestEnemy, allUnits);
      if (targetPos) {
        return { type: 'move', x: targetPos.x, y: targetPos.y };
      }
    }

    return { type: 'wait' };
  }

  /**
   * Проверить, может ли стрелок атаковать с текущей позиции
   */
  private canShootFromPosition(unit: BattleUnit, enemies: BattleUnit[]): boolean {
    // Стрелки могут стрелять на расстоянии
    for (const enemy of enemies) {
      const dist = Math.max(Math.abs(enemy.x - unit.x), Math.abs(enemy.y - unit.y));
      if (dist <= 10) return true;
    }
    return false;
  }

  /**
   * Выбрать цель с учётом приоритетов.
   */
  private selectTarget(unit: BattleUnit, enemies: BattleUnit[], preferRanged: boolean): BattleUnit | null {
    if (enemies.length === 0) return null;

    // Приоритеты:
    // 1. Вражеские стрелки (если мы можем до них добраться)
    // 2. Вражеские герои
    // 3. Слабые юниты (мало HP)
    // 4. Ближайшие

    const scored = enemies.map(enemy => {
      let score = 0;

      // Стрелки - приоритет
      if (isRanged(enemy.creatureId)) score += 100;

      // Герои - высокий приоритет
      if (enemy.isHero) score += 80;

      // Слабые юниты - средний приоритет
      const enemyHealthPercent = enemy.currentHealth / enemy.maxHealth;
      score += (1 - enemyHealthPercent) * 50;

      // Малое количество существ
      if (enemy.count <= 3) score += 30;

      // Расстояние (чем ближе, тем лучше для атаки)
      const dist = Math.max(Math.abs(enemy.x - unit.x), Math.abs(enemy.y - unit.y));
      score += Math.max(0, 20 - dist * 2);

      // Опасность врага (высокая атака)
      const enemyStats = this.getCreatureStats(enemy.creatureId);
      score += enemyStats.attack * 2;

      return { enemy, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.enemy || null;
  }

  /**
   * Выбрать приоритетную цель (для движения к ней)
   */
  private selectPriorityTarget(unit: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
    // Приоритеты: стрелки → маги → герои → слабые → ближние
    const rangedEnemies = enemies.filter(e => isRanged(e.creatureId));
    if (rangedEnemies.length > 0) {
      return this.getClosestEnemy(unit, rangedEnemies);
    }

    const heroes = enemies.filter(e => e.isHero);
    if (heroes.length > 0) {
      return heroes[0];
    }

    return this.getWeakestEnemy(unit, enemies);
  }

  /**
   * Найти самого слабого врага
   */
  private getWeakestEnemy(unit: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
    if (enemies.length === 0) return null;
    return enemies.reduce((weakest, current) => {
      const weakestPower = weakest.count * this.getCreatureStats(weakest.creatureId).damage.max;
      const currentPower = current.count * this.getCreatureStats(current.creatureId).damage.max;
      return currentPower < weakestPower ? current : weakest;
    }, enemies[0]);
  }

  /**
   * Найти ближайшего врага
   */
  private getClosestEnemy(unit: BattleUnit, enemies: BattleUnit[]): BattleUnit | null {
    if (enemies.length === 0) return null;
    return enemies.reduce((closest, current) => {
      const closestDist = Math.max(Math.abs(closest.x - unit.x), Math.abs(closest.y - unit.y));
      const currentDist = Math.max(Math.abs(current.x - unit.x), Math.abs(current.y - unit.y));
      return currentDist < closestDist ? current : closest;
    }, enemies[0]);
  }

  /**
   * Получить позицию рядом с целью (для атаки)
   */
  private getAdjacentPosition(target: BattleUnit, allUnits: BattleUnit[]): { x: number; y: number } | null {
    const directions = [
      { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
      { x: -1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: 1, y: 1 }
    ];

    for (const dir of directions) {
      const x = target.x + dir.x;
      const y = target.y + dir.y;

      if (x >= 0 && x < CONFIG.BATTLE_WIDTH && y >= 0 && y < CONFIG.BATTLE_HEIGHT) {
        const occupied = allUnits.some(u => u.count > 0 && u.x === x && u.y === y);
        if (!occupied) {
          return { x, y };
        }
      }
    }

    return null;
  }

  /**
   * Найти позицию для отступления (для стрелков)
   */
  private findRetreatPosition(
    unit: BattleUnit,
    enemies: BattleUnit[],
    allUnits: BattleUnit[]
  ): { x: number; y: number } | null {
    const speed = this.getCreatureStats(unit.creatureId).speed;

    // Для стрелков атакующих - отступать влево
    // Для стрелков защитников - отступать вправо
    const direction = unit.side === 'attacker' ? -1 : 1;

    // Попытаться отступить в свою сторону
    for (let dist = 1; dist <= speed; dist++) {
      const newX = unit.x + direction * dist;
      if (newX >= 0 && newX < CONFIG.BATTLE_WIDTH) {
        const occupied = allUnits.some(u => u.count > 0 && u.x === newX && u.y === unit.y);
        if (!occupied) {
          // Проверить, что новая позиция дальше от врагов
          const oldMinDist = Math.min(...enemies.map(e => Math.max(Math.abs(e.x - unit.x), Math.abs(e.y - unit.y))));
          const newMinDist = Math.min(...enemies.map(e => Math.max(Math.abs(e.x - newX), Math.abs(e.y - unit.y))));
          if (newMinDist > oldMinDist) {
            return { x: newX, y: unit.y };
          }
        }
      }
    }

    return null;
  }
}
