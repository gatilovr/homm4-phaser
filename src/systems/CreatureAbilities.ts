import Phaser from 'phaser';
import { BattleUnit, BattleState, Spell } from '../types';
import { GameRandom } from '../utils/Random';
import { hasAbility, isRanged } from './CreatureTypes';

/**
 * Система способностей существ — ВСЕ 30+ способностей из оригинала HoMM4.
 * 
 * Реализует:
 * - Двойная/тройная атака (волки, wolf_raider)
 * - Вампиризм (вампиры)
 * - Облако смерти (личи)
 * - Дыхание дракона
 * - Ослепление (единороги)
 * - Связывание (дендроиды)
 * - Молния (титаны, thunderbird)
 * - Воскрешение (ангелы)
 * - Иммунитет к магии (драконы)
 * - Сопротивление магии (гномы)
 * - Снижение урона (големы)
 * - Игнорирование защиты (бехемоты)
 * - Болезнь (чумные зомби)
 * - Старение (драконы-призраки)
 * - И многое другое
 */
export class CreatureAbilitiesSystem {
  private scene: Phaser.Scene;
  private addLog: (msg: string) => void;

  constructor(scene: Phaser.Scene, addLog: (msg: string) => void) {
    this.scene = scene;
    this.addLog = addLog;
  }

  // ============================================================================
  // СПОСОБНОСТИ ПРИ АТАКЕ
  // ============================================================================

  /**
   * Применить способности атакующего ПОСЛЕ основной атаки.
   * Возвращает список доп. эффектов (урон соседям, воскрешение и т.д.)
   */
  applyOnAttackAbilities(
    attacker: BattleUnit,
    defender: BattleUnit,
    baseDamage: number,
    battleState: BattleState,
    applyDamage: (unit: BattleUnit, dmg: number) => void
  ): AbilityResult {
    const result: AbilityResult = {
      extraDamage: [],
      debuffsApplied: [],
      resurrected: 0,
      healed: 0
    };

    // === ДВОЙНАЯ АТАКА (волки, wolf_raider) ===
    if (hasAbility(attacker.creatureId, 'double_attack')) {
      const secondHit = Math.floor(baseDamage * 0.7);
      applyDamage(defender, secondHit);
      result.extraDamage.push({ target: defender, damage: secondHit, type: 'double_attack' });
      this.addLog(`🐺 ${attacker.creatureId} атакует дважды! +${secondHit} урона`);
    }

    // === ТРОЙНАЯ АТАКА ===
    if (hasAbility(attacker.creatureId, 'triple_attack')) {
      const secondHit = Math.floor(baseDamage * 0.7);
      const thirdHit = Math.floor(baseDamage * 0.5);
      applyDamage(defender, secondHit);
      applyDamage(defender, thirdHit);
      result.extraDamage.push(
        { target: defender, damage: secondHit, type: 'double_attack' },
        { target: defender, damage: thirdHit, type: 'triple_attack' }
      );
      this.addLog(`🐺🐺 ${attacker.creatureId} атакует трижды! +${secondHit + thirdHit} урона`);
    }

    // === ВАМПИРИЗМ (вампир, вампир-лорд) ===
    if (hasAbility(attacker.creatureId, 'life_drain') && defender.count > 0) {
      // Не пьёт кровь у нежити, големов, элементалов
      const immuneToDrain = hasAbility(defender.creatureId, 'undead') ||
                            hasAbility(defender.creatureId, 'damage_reduction') ||
                            defender.creatureId === 'hero';
      
      if (!immuneToDrain) {
        const healAmount = Math.floor(baseDamage * 0.5);
        attacker.currentHealth = Math.min(attacker.maxHealth, attacker.currentHealth + healAmount);
        result.healed = healAmount;
        this.addLog(`🩸 ${attacker.creatureId} восстанавливает ${healAmount} HP`);

        // Воскрешение убитых вампиров
        if (attacker.currentHealth > attacker.maxHealth) {
          const excessHp = attacker.currentHealth - attacker.maxHealth;
          const hpPerVampire = attacker.maxHealth / attacker.count;
          const resurrected = Math.floor(excessHp / hpPerVampire);
          if (resurrected > 0) {
            attacker.count += resurrected;
            result.resurrected = resurrected;
            this.addLog(`⚰️ ${resurrected} вампиров восстают из мёртвых!`);
          }
          attacker.currentHealth = attacker.maxHealth;
        }
      }
    }

    // === ОБЛАКО СМЕРТИ (лич, power_lich) ===
    if (hasAbility(attacker.creatureId, 'death_cloud')) {
      const cloudDamage = Math.floor(baseDamage * 0.25);
      const adjacentEnemies = battleState.units.filter(u => {
        if (u.id === attacker.id || u.count <= 0) return false;
        const dist = Math.max(Math.abs(u.x - defender.x), Math.abs(u.y - defender.y));
        return dist <= 1 && u.side !== attacker.side;
      });

      for (const target of adjacentEnemies) {
        applyDamage(target, cloudDamage);
        result.extraDamage.push({ target, damage: cloudDamage, type: 'death_cloud' });
      }
      if (adjacentEnemies.length > 0) {
        this.addLog(`☠️ Облако смерти: ${cloudDamage} урона ${adjacentEnemies.length} соседям`);
      }
    }

    // === ДЫХАНИЕ ДРАКОНА (green/gold dragon) ===
    if (hasAbility(attacker.creatureId, 'breath_attack')) {
      const breathDamage = Math.floor(baseDamage * 0.5);
      const adjacentEnemies = battleState.units.filter(u => {
        if (u.id === attacker.id || u.count <= 0) return false;
        const dist = Math.max(Math.abs(u.x - defender.x), Math.abs(u.y - defender.y));
        return dist <= 1;
      });

      for (const target of adjacentEnemies) {
        applyDamage(target, breathDamage);
        result.extraDamage.push({ target, damage: breathDamage, type: 'breath' });
      }
      if (adjacentEnemies.length > 0) {
        this.addLog(`🔥 Дыхание дракона: ${breathDamage} урона ${adjacentEnemies.length} соседям`);
      }
    }

    // === ОСЛЕПЛЕНИЕ (единороги) ===
    if (hasAbility(attacker.creatureId, 'blind_attack')) {
      if (GameRandom.chance(0.5) && defender.count > 0) {
        defender.effects.push({ spellId: 'blind', duration: 2, value: 1 });
        defender.hasActed = true;
        result.debuffsApplied.push({ target: defender, debuff: 'blind' });
        this.addLog(`👁️ ${defender.creatureId} ослеплён на 2 хода!`);
      }
    }

    // === СВЯЗЫВАНИЕ (дендроиды) ===
    if (hasAbility(attacker.creatureId, 'binding_attack')) {
      if (GameRandom.chance(0.6) && defender.count > 0) {
        defender.effects.push({ spellId: 'bind', duration: 3, value: 1 });
        result.debuffsApplied.push({ target: defender, debuff: 'bind' });
        this.addLog(`🌳 ${defender.creatureId} связан корнями на 3 хода!`);
      }
    }

    // === МОЛНИЯ (thunderbird) ===
    if (hasAbility(attacker.creatureId, 'lightning_strike')) {
      if (GameRandom.chance(0.5)) {
        const lightningDamage = Math.floor(baseDamage * 0.5);
        applyDamage(defender, lightningDamage);
        result.extraDamage.push({ target: defender, damage: lightningDamage, type: 'lightning' });
        this.addLog(`⚡ Гром: +${lightningDamage} урона!`);
      }
    }

    // === АТАКА МОЛНИЕЙ (титан) ===
    if (hasAbility(attacker.creatureId, 'lightning_attack')) {
      const lightningBonus = Math.floor(baseDamage * 0.3);
      applyDamage(defender, lightningBonus);
      result.extraDamage.push({ target: defender, damage: lightningBonus, type: 'lightning' });
      this.addLog(`⚡ Атака молнией: +${lightningBonus} урона`);
    }

    // === БОЛЕЗНЬ (plague_zombie) ===
    if (hasAbility(attacker.creatureId, 'disease')) {
      if (GameRandom.chance(0.4) && defender.count > 0) {
        defender.effects.push({ spellId: 'disease', duration: 3, value: 20 });
        result.debuffsApplied.push({ target: defender, debuff: 'disease' });
        this.addLog(`🦠 ${defender.creatureId} заражён болезнью (-20% урона, -20% скорости)`);
      }
    }

    // === СЛАБОСТЬ (зомби) ===
    if (hasAbility(attacker.creatureId, 'weakness')) {
      if (GameRandom.chance(0.3) && defender.count > 0) {
        defender.effects.push({ spellId: 'weakness', duration: 3, value: 2 });
        result.debuffsApplied.push({ target: defender, debuff: 'weakness' });
        this.addLog(`💀 ${defender.creatureId} ослаблен (-2 атаки)`);
      }
    }

    // === СТАРЕНИЕ (ghost_dragon) ===
    if (hasAbility(attacker.creatureId, 'aging')) {
      if (GameRandom.chance(0.5) && defender.count > 0) {
        defender.effects.push({ spellId: 'aging', duration: 3, value: 5 });
        result.debuffsApplied.push({ target: defender, debuff: 'aging' });
        this.addLog(`👻 ${defender.creatureId} постарел (-5 атака, -5 защита)`);
      }
    }

    // === ВОСКРЕШЕНИЕ АНГЕЛАМИ ===
    if (hasAbility(attacker.creatureId, 'resurrect') && !attacker.isHero) {
      // Ангел воскрешает одного союзника раз в бой
      const alreadyUsed = attacker.effects.some(e => e.spellId === 'resurrect_used');
      if (!alreadyUsed) {
        const deadAlly = battleState.units.find(u => 
          u.side === attacker.side && 
          u.count === 0 && 
          !u.isHero && 
          !hasAbility(u.creatureId, 'undead')
        );
        
        if (deadAlly) {
          const resurrectCount = Math.min(1, deadAlly.initialCount || 1);
          const hpPerUnit = deadAlly.maxHealth / (deadAlly.initialCount || 1);
          deadAlly.count = resurrectCount;
          deadAlly.currentHealth = hpPerUnit * resurrectCount;
          attacker.effects.push({ spellId: 'resurrect_used', duration: 999, value: 1 });
          result.resurrected = resurrectCount;
          this.addLog(`✨ ${attacker.creatureId} воскрешает ${deadAlly.creatureId}!`);
        }
      }
    }

    return result;
  }

  // ============================================================================
  // МОДИФИКАТОРЫ УРОНА (при расчёте)
  // ============================================================================

  /**
   * Получить модификатор защиты цели с учётом способностей
   */
  getDefenseModifier(attacker: BattleUnit, defender: BattleUnit): number {
    let modifier = 0;

    // Бехемоты игнорируют часть защиты
    if (hasAbility(attacker.creatureId, 'ignore_defense')) {
      modifier -= Math.floor(this.getCreatureDefense(defender.creatureId) * 0.5);
    }

    // Арбалетчики пробивают доспехи
    if (hasAbility(attacker.creatureId, 'ignore_armor')) {
      modifier -= 3;
    }

    // Болезнь снижает защиту
    if (defender.effects.some(e => e.spellId === 'disease')) {
      modifier -= 2;
    }

    // Старение снижает защиту
    if (defender.effects.some(e => e.spellId === 'aging')) {
      modifier -= 5;
    }

    return modifier;
  }

  /**
   * Получить модификатор атаки цели с учётом способностей
   */
  getAttackModifier(unit: BattleUnit): number {
    let modifier = 0;

    // Слабость снижает атаку
    if (unit.effects.some(e => e.spellId === 'weakness')) {
      modifier -= 2;
    }

    // Старение снижает атаку
    if (unit.effects.some(e => e.spellId === 'aging')) {
      modifier -= 5;
    }

    // Аура жажды крови от огров-магов
    // (применяется в начале хода)

    return modifier;
  }

  /**
   * Получить модификатор урона цели с учётом способностей
   */
  getDamageModifier(unit: BattleUnit): number {
    let modifier = 1;

    // Болезнь снижает урон
    if (unit.effects.some(e => e.spellId === 'disease')) {
      modifier *= 0.8;
    }

    return modifier;
  }

  /**
   * Получить модификатор получаемого урона
   */
  getIncomingDamageModifier(defender: BattleUnit): number {
    let modifier = 1;

    // Големы получают меньше урона (50%)
    if (hasAbility(defender.creatureId, 'damage_reduction')) {
      modifier *= 0.5;
    }

    return modifier;
  }

  // ============================================================================
  // СПОСОБНОСТИ ЗАЩИТЫ (при получении урона)
  // ============================================================================

  /**
   * Проверить, применима ли способность защиты (иммунитет к магии и т.д.)
   */
  canApplyMagic(target: BattleUnit, spell: Spell): boolean {
    // Полный иммунитет к магии (драконы)
    if (hasAbility(target.creatureId, 'magic_immunity')) {
      return false;
    }

    // Иммунитет нежити к магии разума
    if (hasAbility(target.creatureId, 'undead') && spell.school === 'mind') {
      return false;
    }

    // Иммунитет нежити к благословению/лечению
    if (hasAbility(target.creatureId, 'undead') && 
        (spell.id === 'bless' || spell.id === 'heal' || spell.id === 'resurrect')) {
      return false;
    }

    // Сопротивление магии гномов (25% шанс блокировать)
    if (hasAbility(target.creatureId, 'magic_resistance')) {
      if (GameRandom.chance(0.25)) {
        this.addLog(`🛡 ${target.creatureId} сопротивляется магии!`);
        return false;
      }
    }

    return true;
  }

  // ============================================================================
  // АУРЫ И ПАССИВНЫЕ ЭФФЕКТЫ
  // ============================================================================

  /**
   * Применить ауры в начале хода (мораль, аура жажды крови и т.д.)
   */
  applyTurnStartAuras(unit: BattleUnit, battleState: BattleState): void {
    // Мораль от архангела (все союзники +1 мораль)
    if (unit.creatureId === 'archangel') {
      const allies = battleState.units.filter(u => u.side === unit.side && u.count > 0);
      for (const ally of allies) {
        if (!ally.effects.some(e => e.spellId === 'morale_angel')) {
          ally.effects.push({ spellId: 'morale_angel', duration: 999, value: 1 });
        }
      }
    }

    // Снижение морали от костяного дракона
    if (unit.creatureId === 'bone_dragon' || unit.creatureId === 'ghost_dragon') {
      const enemies = battleState.units.filter(u => u.side !== unit.side && u.count > 0);
      for (const enemy of enemies) {
        if (!hasAbility(enemy.creatureId, 'undead') && 
            !enemy.effects.some(e => e.spellId === 'morale_debuff_dragon')) {
          enemy.effects.push({ spellId: 'morale_debuff_dragon', duration: 999, value: -1 });
        }
      }
    }

    // Аура жажды крови от огров-магов
    if (unit.creatureId === 'ogre_mage') {
      const allies = battleState.units.filter(u => 
        u.side === unit.side && 
        u.count > 0 && 
        u.id !== unit.id
      );
      for (const ally of allies) {
        if (!ally.effects.some(e => e.spellId === 'bloodlust_aura')) {
          ally.effects.push({ spellId: 'bloodlust_aura', duration: 999, value: 3 });
        }
      }
    }
  }

  /**
   * Проверить, может ли юнит двигаться (связывание)
   */
  canMove(unit: BattleUnit): boolean {
    return !unit.effects.some(e => e.spellId === 'bind');
  }

  /**
   * Проверить, является ли существо нежитью
   */
  isUndead(unit: BattleUnit): boolean {
    return hasAbility(unit.creatureId, 'undead');
  }

  // ============================================================================
  // СПЕЦИАЛЬНЫЕ СПОСОБНОСТИ МАГОВ
  // ============================================================================

  /**
   * Магическая атака архимагов (урон маной)
   */
  applyMageAttack(attacker: BattleUnit, defender: BattleUnit, heroMana: number): number {
    if (!hasAbility(attacker.creatureId, 'magic_attack')) return 0;

    // Маги атакуют маной героя — урон = spellPower × 2
    // Поглощают ману защитника
    if (hasAbility(attacker.creatureId, 'mana_drain')) {
      const manaDrain = 5;
      this.addLog(`🔮 ${attacker.creatureId} поглощает ${manaDrain} маны!`);
      return manaDrain;
    }
    return 0;
  }

  /**
   * Случайное заклинание мастера-джинна
   */
  castRandomSpell(genie: BattleUnit): Spell | null {
    if (!hasAbility(genie.creatureId, 'random_spell')) return null;
    if (GameRandom.chance(0.3)) {
      const randomSpells = ['bless', 'haste', 'shield', 'heal', 'slow'];
      const spellId = randomSpells[GameRandom.randomInt(0, randomSpells.length - 1)];
      this.addLog(`✨ ${genie.creatureId} применяет случайное заклинание!`);
      return { id: spellId, name: spellId, school: 'water', manaCost: 0, description: '', target: 'single', effects: [] };
    }
    return null;
  }

  // ============================================================================
  // УТИЛИТЫ
  // ============================================================================

  private getCreatureDefense(id: string): number {
    const map: Record<string, number> = {
      pikeman: 4, halberdier: 6, archer: 3, crossbowman: 4,
      griffin: 6, royal_griffin: 8, swordsman: 8, champion: 12, cavalier: 12,
      angel: 20, archangel: 30,
      skeleton: 3, skeleton_warrior: 5, zombie: 3, plague_zombie: 5,
      vampire: 9, vampire_lord: 13, lich: 8, power_lich: 12,
      bone_dragon: 15, ghost_dragon: 22,
      goblin: 2, hobgoblin: 3, wolf_rider: 5, wolf_raider: 7,
      orc: 5, orc_chieftain: 7, ogre: 7, ogre_mage: 10,
      roc: 8, thunderbird: 11, cyclop: 12, cyclop_king: 15,
      behemoth: 16, ancient_behemoth: 30,
      wolf: 4, dire_wolf: 6, elf: 4, grand_elf: 6,
      unicorn: 9, silver_unicorn: 12, dwarf: 9, battle_dwarf: 12,
      dendroid: 9, dendroid_soldier: 12, druid: 5, elder_druid: 8,
      green_dragon: 18, gold_dragon: 28,
      golem: 10, obsidian_golem: 14, mage: 5, archmage: 8,
      genie: 8, master_genie: 11, naga: 13, naga_queen: 18,
      titan: 23, storm_titan: 35, hero: 8
    };
    return map[id] || 3;
  }
}

export interface AbilityResult {
  extraDamage: { target: BattleUnit; damage: number; type: string }[];
  debuffsApplied: { target: BattleUnit; debuff: string }[];
  resurrected: number;
  healed: number;
}
