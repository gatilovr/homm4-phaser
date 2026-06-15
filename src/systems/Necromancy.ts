import { BattleUnit, BattleResult, NecromancyResult, Hero, ArmySlot } from '../types';
import { GameRandom } from '../utils/Random';
import { hasAbility } from './CreatureTypes';

/**
 * Система некромантии — подъём скелетов и зомби из павших врагов.
 * 
 * Формула:
 * - Базовый шанс: 10% + (skill.necromancy × 10%)
 * - Максимум: 30% от HP убитых врагов преобразуется в нежить
 * - Скелеты = 50%, Зомби = 30%, Вампиры = 20% (в зависимости от силы врага)
 */
export class NecromancySystem {
  /**
   * Проверить, может ли герой применять некромантию
   */
  static canUseNecromancy(hero: Hero): boolean {
    // Герой-некромант
    if (hero.class === 'Necromancer' || hero.class === 'Death Knight') {
      return true;
    }
    // Или герой с навыком некромантии
    return hero.skills.some(s => s.id === 'necromancy');
  }

  /**
   * Получить силу некромантии героя (0-1)
   */
  static getNecromancyPower(hero: Hero): number {
    // Базовая сила для некромантов
    let power = 0.1;

    // Навык некромантии
    const necroSkill = hero.skills.find(s => s.id === 'necromancy');
    if (necroSkill) {
      power += necroSkill.level * 0.1; // 0.1/0.2/0.3 за уровень
    }

    // Бонус от специализации
    if (hero.specialization === 'necromancy') {
      power += 0.1;
    }

    // Бонус от заклинания "Оживление мертвых" (если герой его знает)
    if (hero.spells && hero.spells.includes('animate_dead')) {
      power += 0.05; // +5% к некромантии
    }

    return Math.min(power, 0.5); // Максимум 50%
  }

  /**
   * Применить некромантию после победного боя.
   * @param deadEnemies - убитые враги
   * @param hero - герой-победитель
   * @returns результат некромантии
   */
  static applyNecromancy(
    deadEnemies: BattleUnit[],
    hero: Hero
  ): NecromancyResult {
    const result: NecromancyResult = {
      raisedUnits: [],
      totalDeadConverted: 0,
      necromancyPower: 0
    };

    if (!this.canUseNecromancy(hero)) {
      return result;
    }

    const power = this.getNecromancyPower(hero);
    result.necromancyPower = power;

    // Подсчёт HP убитых врагов (исключая нежить и неорганических)
    let totalDeadHp = 0;
    const deadHpByTier: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    for (const unit of deadEnemies) {
      // Нельзя поднимать нежить, големов, элементалов
      if (hasAbility(unit.creatureId, 'undead') || 
          hasAbility(unit.creatureId, 'damage_reduction')) {
        continue;
      }

      // Нельзя поднимать героев
      if (unit.isHero) continue;

      const initialCount = unit.initialCount || unit.count;
      const lostCount = Math.max(0, initialCount - unit.count);
      const hpPerUnit = unit.maxHealth / initialCount;
      const deadHp = lostCount * hpPerUnit;

      totalDeadHp += deadHp;

      // Определяем тир существа
      const tier = this.getCreatureTier(unit.creatureId);
      deadHpByTier[tier] = (deadHpByTier[tier] || 0) + deadHp;
    }

    if (totalDeadHp === 0) {
      return result;
    }

    // Преобразуем часть HP в нежить
    const convertibleHp = Math.floor(totalDeadHp * power);
    result.totalDeadConverted = convertibleHp;

    // Распределяем по типам нежити
    // Скелеты (1 тир, 5 HP) — основа
    const skeletonHp = Math.floor(convertibleHp * 0.6);
    const skeletons = Math.floor(skeletonHp / 5);
    if (skeletons > 0) {
      result.raisedUnits.push({ creatureId: 'skeleton_h4', count: skeletons });
    }

    // Призраки (2 тир, 10 HP) — из сильных существ
    const ghostHp = Math.floor(convertibleHp * 0.3);
    const ghosts = Math.floor(ghostHp / 10);
    if (ghosts > 0) {
      result.raisedUnits.push({ creatureId: 'ghost_h4', count: ghosts });
    }

    // Вампиры (3 тир, 30 HP) — только при высокой силе некромантии
    if (power >= 0.3) {
      const vampireHp = Math.floor(convertibleHp * 0.1);
      const vampires = Math.floor(vampireHp / 30);
      if (vampires > 0) {
        result.raisedUnits.push({ creatureId: 'vampire_h4', count: vampires });
      }
    }

    return result;
  }

  /**
   * Добавить поднятую нежить в армию героя
   */
  static addRaisedUnitsToArmy(hero: Hero, raised: NecromancyResult): void {
    for (const raisedUnit of raised.raisedUnits) {
      // Ищем существующий слот с такой нежитью
      const existingSlot = hero.army.find(s => s.creatureId === raisedUnit.creatureId);
      
      if (existingSlot) {
        existingSlot.count += raisedUnit.count;
      } else {
        // Находим пустой слот или добавляем новый
        const emptySlot = hero.army.find(s => s.count === 0);
        if (emptySlot) {
          emptySlot.creatureId = raisedUnit.creatureId;
          emptySlot.count = raisedUnit.count;
        } else if (hero.army.length < 7) {
          hero.army.push({ creatureId: raisedUnit.creatureId, count: raisedUnit.count });
        }
        // Если армия заполнена — нежить теряется (можно добавить в гарнизон города)
      }
    }
  }

  /**
   * Получить тир существа (1-5)
   */
  private static getCreatureTier(id: string): number {
    const tierMap: Record<string, number> = {
      // Тир 1
      pikeman: 1, skeleton: 1, goblin: 1, wolf: 1, golem: 1,
      // Тир 2
      halberdier: 2, archer: 2, skeleton_warrior: 2, zombie: 2,
      hobgoblin: 2, wolf_rider: 2, orc: 2, elf: 2, dwarf: 2, mage: 2,
      // Тир 3
      griffin: 3, swordsman: 3, vampire: 3, lich: 3,
      ogre: 3, roc: 3, unicorn: 3, dendroid: 3, druid: 3, genie: 3, naga: 3,
      // Тир 4
      royal_griffin: 4, champion: 4, cavalier: 4,
      vampire_lord: 4, power_lich: 4, wolf_raider: 4, orc_chieftain: 4,
      ogre_mage: 4, thunderbird: 4, cyclop: 4,
      grand_elf: 4, silver_unicorn: 4, battle_dwarf: 4, dendroid_soldier: 4,
      elder_druid: 4, obsidian_golem: 4, archmage: 4, master_genie: 4, naga_queen: 4,
      // Тир 5
      angel: 5, archangel: 5, bone_dragon: 5, ghost_dragon: 5,
      behemoth: 5, ancient_behemoth: 5, green_dragon: 5, gold_dragon: 5,
      titan: 5, storm_titan: 5
    };
    return tierMap[id] || 1;
  }

  /**
   * Получить красивое описание результата некромантии
   */
  static getResultDescription(result: NecromancyResult): string {
    if (result.raisedUnits.length === 0) {
      return '💀 Некромантия не сработала';
    }

    const parts = result.raisedUnits.map(r => {
      const names: Record<string, string> = {
        skeleton: 'скелетов',
        zombie: 'зомби',
        vampire: 'вампиров'
      };
      return `${r.count} ${names[r.creatureId] || r.creatureId}`;
    });

    const powerPercent = Math.round(result.necromancyPower * 100);
    return `☠️ Некромантия (${powerPercent}%): восстали ${parts.join(', ')}`;
  }
}
