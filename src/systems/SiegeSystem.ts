import { BattleState, BattleUnit, WallsState, WallSegment, Town, Building } from '../types';
import { GameRandom } from '../utils/Random';
import { CONFIG } from '../config';

/**
 * Система осады городов — стены, башни, ворота, катапульта.
 * 
 * В HoMM4 при атаке города:
 * - Стены защищают защитников
 * - 2 башни стреляют по атакующим
 * - Ворота можно открыть/закрыть
 * - Катапульта ломает стены
 * - Если стены разрушены — обычный бой
 */
export class SiegeSystem {
  /**
   * Создать состояние стен для осады
   */
  static createWallsState(town: Town): WallsState {
    const hasCitadel = town.builtBuildings.includes('citadel');
    const hasCastle = town.builtBuildings.includes('castle');
    
    const wallHp = hasCastle ? 500 : hasCitadel ? 300 : 100;
    const towerHp = hasCastle ? 200 : 100;

    return {
      mainGate: this.createWallSegment('main_gate', 'gate', wallHp * 2, 6, 5),
      upperWall: this.createWallSegment('upper_wall', 'wall', wallHp, 6, 2),
      lowerWall: this.createWallSegment('lower_wall', 'wall', wallHp, 6, 8),
      keepTower: this.createWallSegment('keep_tower', 'tower', towerHp, 8, 5),
      upperTower: this.createWallSegment('upper_tower', 'tower', towerHp, 7, 1),
      lowerTower: this.createWallSegment('lower_tower', 'tower', towerHp, 7, 9)
    };
  }

  private static createWallSegment(
    id: string,
    type: 'gate' | 'wall' | 'tower',
    hp: number,
    x: number,
    y: number
  ): WallSegment {
    return {
      id,
      type,
      currentHp: hp,
      maxHp: hp,
      x,
      y,
      isDestroyed: false
    };
  }

  /**
   * Создать юниты стен для боевой сцены
   */
  static createWallUnits(walls: WallsState): BattleUnit[] {
    const units: BattleUnit[] = [];

    // Стены и ворота
    const wallSegments = [walls.upperWall, walls.lowerWall, walls.mainGate];
    for (const segment of wallSegments) {
      if (!segment.isDestroyed) {
        units.push({
          id: `wall_${segment.id}`,
          creatureId: 'wall',
          count: 1,
          currentHealth: segment.currentHp,
          maxHealth: segment.maxHp,
          x: segment.x,
          y: segment.y,
          side: 'defender',
          hasActed: true,
          hasRetaliated: true,
          effects: [],
          isWall: true,
          wallHp: segment.currentHp
        });
      }
    }

    // Башни (активные юниты)
    const towers = [walls.upperTower, walls.lowerTower, walls.keepTower];
    for (const tower of towers) {
      if (!tower.isDestroyed) {
        units.push({
          id: `tower_${tower.id}`,
          creatureId: 'tower',
          count: 1,
          currentHealth: tower.currentHp,
          maxHealth: tower.maxHp,
          x: tower.x,
          y: tower.y,
          side: 'defender',
          hasActed: false,
          hasRetaliated: true,
          effects: [],
          isTower: true,
          wallHp: tower.currentHp
        });
      }
    }

    return units;
  }

  /**
   * Атака башни по атакующему юниту
   */
  static towerAttack(tower: BattleUnit, target: BattleUnit, allUnits: BattleUnit[]): number {
    // Башня стреляет по самому опасному атакующему
    const attackers = allUnits.filter(u => u.side === 'attacker' && u.count > 0);
    if (attackers.length === 0) return 0;

    // Башня всегда попадает и наносит фиксированный урон
    const damage = 50;
    return damage;
  }

  /**
   * Атака катапульты по стене
   * Катапульта — это юнит циклопа или специальное здание
   */
  static catapultAttack(
    attacker: BattleUnit,
    wallSegment: WallSegment
  ): { damage: number; destroyed: boolean } {
    // Базовый урон катапульты
    let damage = 50;

    // Циклопы особенно эффективны против стен
    if (attacker.creatureId === 'cyclop' || attacker.creatureId === 'cyclop_king') {
      damage = 100;
    }

    wallSegment.currentHp -= damage;
    
    if (wallSegment.currentHp <= 0) {
      wallSegment.currentHp = 0;
      wallSegment.isDestroyed = true;
      return { damage, destroyed: true };
    }

    return { damage, destroyed: false };
  }

  /**
   * Проверить, разрушены ли все стены (можно атаковать защитников напрямую)
   */
  static areWallsDestroyed(walls: WallsState): boolean {
    return walls.upperWall.isDestroyed && 
           walls.lowerWall.isDestroyed && 
           walls.mainGate.isDestroyed;
  }

  /**
   * Проверить, разрушены ли все башни
   */
  static areTowersDestroyed(walls: WallsState): boolean {
    return walls.upperTower.isDestroyed && 
           walls.lowerTower.isDestroyed && 
           walls.keepTower.isDestroyed;
  }

  /**
   * Может ли атакующий атаковать защитников (стены разрушены или юнит внутри)
   */
  static canAttackDefenders(walls: WallsState, attacker: BattleUnit): boolean {
    // Летающие существа могут перелететь стены
    if (attacker.creatureId.includes('dragon') || 
        attacker.creatureId.includes('griffin') ||
        attacker.creatureId.includes('angel') ||
        attacker.creatureId.includes('vampire') ||
        attacker.creatureId.includes('genie')) {
      return true;
    }

    // Стрелки могут стрелять через стены
    if (attacker.creatureId === 'archer' || 
        attacker.creatureId === 'crossbowman' ||
        attacker.creatureId === 'lich' ||
        attacker.creatureId === 'orc' ||
        attacker.creatureId === 'titan') {
      return true;
    }

    // Если все стены разрушены — можно атаковать
    return this.areWallsDestroyed(walls);
  }

  /**
   * Открыть/закрыть ворота
   */
  static toggleGate(walls: WallsState): void {
    if (!walls.mainGate.isDestroyed) {
      // Ворота можно открыть (для вылазки) или закрыть
      // В нашей упрощённой версии — ворота разрушаются как стена
    }
  }

  /**
   * Получить HP стены в процентах (для визуализации)
   */
  static getWallHpPercent(wall: WallSegment): number {
    return Math.max(0, (wall.currentHp / wall.maxHp) * 100);
  }

  /**
   * Получить цвет HP бара стены
   */
  static getWallHpColor(percent: number): number {
    if (percent > 60) return 0x2ecc71; // Зелёный
    if (percent > 30) return 0xf39c12; // Оранжевый
    return 0xe74c3c; // Красный
  }

  /**
   * Описать состояние осады
   */
  static getSiegeStatus(walls: WallsState): string {
    const status: string[] = [];

    if (walls.mainGate.isDestroyed) {
      status.push('🚪 Ворота разрушены');
    } else {
      const gatePercent = Math.round(this.getWallHpPercent(walls.mainGate));
      status.push(`🚪 Ворота: ${gatePercent}%`);
    }

    if (!walls.upperWall.isDestroyed) {
      status.push(`🧱 Верхняя стена: ${Math.round(this.getWallHpPercent(walls.upperWall))}%`);
    }
    if (!walls.lowerWall.isDestroyed) {
      status.push(`🧱 Нижняя стена: ${Math.round(this.getWallHpPercent(walls.lowerWall))}%`);
    }

    if (!walls.upperTower.isDestroyed) {
      status.push(`🗼 Верхняя башня: ${Math.round(this.getWallHpPercent(walls.upperTower))}%`);
    }
    if (!walls.lowerTower.isDestroyed) {
      status.push(`🗼 Нижняя башня: ${Math.round(this.getWallHpPercent(walls.lowerTower))}%`);
    }
    if (!walls.keepTower.isDestroyed) {
      status.push(`🏰 Главная башня: ${Math.round(this.getWallHpPercent(walls.keepTower))}%`);
    }

    return status.join('\n');
  }

  // ==========================================================================
  // ОСАДНЫЕ МАШИНЫ (канон HoMM4)
  // ==========================================================================

  /**
   * Создать юнит баллисты (осадная машина)
   */
  static createBallistaUnit(x: number = 0, y: number = 5): BattleUnit {
    return {
      id: 'war_machine_ballista',
      creatureId: 'ballista_machine',
      count: 1,
      currentHealth: 100,
      maxHealth: 100,
      x,
      y,
      side: 'attacker',
      hasActed: false,
      hasRetaliated: true,
      effects: [],
      isWarMachine: true
    };
  }

  /**
   * Создать юнит катапульты (осадная машина)
   */
  static createCatapultUnit(x: number = 0, y: number = 6): BattleUnit {
    return {
      id: 'war_machine_catapult',
      creatureId: 'catapult_machine',
      count: 1,
      currentHealth: 200,
      maxHealth: 200,
      x,
      y,
      side: 'attacker',
      hasActed: false,
      hasRetaliated: true,
      effects: [],
      isWarMachine: true
    };
  }

  /**
   * Создать палатку первой помощи (осадная машина)
   */
  static createFirstAidTentUnit(x: number = 0, y: number = 7): BattleUnit {
    return {
      id: 'war_machine_first_aid',
      creatureId: 'first_aid_tent_machine',
      count: 1,
      currentHealth: 50,
      maxHealth: 50,
      x,
      y,
      side: 'attacker',
      hasActed: false,
      hasRetaliated: true,
      effects: [],
      isWarMachine: true
    };
  }

  /**
   * Атака баллисты (стреляет по вражескому юниту)
   */
  static ballistaAttack(
    ballista: BattleUnit,
    target: BattleUnit,
    skillLevel: number = 0
  ): { damage: number; hit: boolean } {
    // Баллиста всегда попадает (100% точность)
    let damage = 25; // Базовый урон
    
    // Бонус от навыка Артиллерии
    if (skillLevel >= 1) damage = Math.floor(damage * 1.25); // Basic: +25%
    if (skillLevel >= 2) damage = Math.floor(damage * 1.5);  // Advanced: +50%
    if (skillLevel >= 3) damage = Math.floor(damage * 2.0);  // Expert: +100%
    
    return { damage, hit: true };
  }

  /**
   * Атака катапульты (стреляет по стенам/башням)
   */
  static catapultAttackWarMachine(
    catapult: BattleUnit,
    target: WallSegment,
    skillLevel: number = 0
  ): { damage: number; destroyed: boolean } {
    let damage = 50; // Базовый урон
    
    // Бонус от навыка Артиллерии
    if (skillLevel >= 1) damage = Math.floor(damage * 1.25);
    if (skillLevel >= 2) damage = Math.floor(damage * 1.5);
    if (skillLevel >= 3) damage = Math.floor(damage * 2.0);
    
    target.currentHp -= damage;
    const destroyed = target.currentHp <= 0;
    if (destroyed) {
      target.currentHp = 0;
      target.isDestroyed = true;
    }
    
    return { damage, destroyed };
  }

  /**
   * Лечение палаткой первой помощи (лечит одного юнита)
   */
  static firstAidTentHeal(
    tent: BattleUnit,
    target: BattleUnit,
    skillLevel: number = 0
  ): { healed: number; success: boolean } {
    let healAmount = 50; // Базовое лечение
    
    // Бонус от навыка Первой помощи
    if (skillLevel >= 1) healAmount = Math.floor(healAmount * 1.25);
    if (skillLevel >= 2) healAmount = Math.floor(healAmount * 1.5);
    if (skillLevel >= 3) healAmount = Math.floor(healAmount * 2.0);
    
    const before = target.currentHealth;
    target.currentHealth = Math.min(target.maxHealth, target.currentHealth + healAmount);
    const healed = target.currentHealth - before;
    
    return { healed, success: healed > 0 };
  }
}
