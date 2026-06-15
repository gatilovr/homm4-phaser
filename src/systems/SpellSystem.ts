import Phaser from 'phaser';
import { BattleUnit, Spell, SpellEffect } from '../types';
import { GameRandom } from '../utils/Random';
import { hasAbility } from './CreatureTypes';

/**
 * Система магии в бою.
 * Реализует все 19 заклинаний из spells.json с визуальными эффектами.
 */
export class SpellSystem {
  private scene: Phaser.Scene;
  private spells: Record<string, Spell> = {};

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Загрузка данных заклинаний из JSON
   */
  loadSpells(spellsData: Record<string, Spell>): void {
    this.spells = spellsData;
  }

  /**
   * Получить заклинание по ID
   */
  getSpell(id: string): Spell | undefined {
    return this.spells[id];
  }

  /**
   * Получить все доступные заклинания
   */
  getAllSpells(): Spell[] {
    return Object.values(this.spells);
  }

  /**
   * Получить заклинания определённой школы
   */
  getSpellsBySchool(school: string): Spell[] {
    return Object.values(this.spells).filter(s => s.school === school);
  }

  /**
   * Применить заклинание к цели
   */
  applySpell(
    spell: Spell,
    caster: BattleUnit | null,
    targets: BattleUnit[],
    targetPosition?: { x: number; y: number },
    spellPower: number = 1
  ): { success: boolean; message: string; affectedUnits: BattleUnit[] } {
    const affectedUnits: BattleUnit[] = [];
    let message = '';

    switch (spell.id) {
      case 'bless':
        message = this.applyBless(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'heal':
        message = this.applyHeal(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'slow':
        message = this.applySlow(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'teleport':
        message = this.applyTeleport(targets, targetPosition);
        affectedUnits.push(...targets);
        break;

      case 'clone':
        message = this.applyClone(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'bloodlust':
        message = this.applyBloodlust(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'fireball':
        message = this.applyFireball(targets, spellPower, targetPosition);
        affectedUnits.push(...targets);
        break;

      case 'berserk':
        message = this.applyBerserk(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'armageddon':
        message = this.applyArmageddon(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'shield':
        message = this.applyShield(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'stoneskin':
        message = this.applyStoneskin(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'meteor':
        message = this.applyMeteor(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'resurrect':
        message = this.applyResurrect(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'haste':
        message = this.applyHaste(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'lightning':
        message = this.applyLightning(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'chain_lightning':
        message = this.applyChainLightning(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'fly':
        message = this.applyFly(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'blind':
        message = this.applyBlind(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      case 'forgetfulness':
        message = this.applyForgetfulness(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ЖИЗНИ ===
      case 'anti_magic':
        message = this.applyBuff.stat(targets, 'magic_immunity', 3);
        affectedUnits.push(...targets);
        break;
      case 'regeneration':
        message = this.applyBuff.stat(targets, 'regeneration', 3, 5 + spellPower * 2);
        affectedUnits.push(...targets);
        break;
      case 'purify':
        message = this.applyDispel(targets);
        affectedUnits.push(...targets);
        break;
      case 'guardian_angel':
        message = this.applyBuff.stat(targets, 'immortal', 999);
        affectedUnits.push(...targets);
        break;
      case 'mass_bless':
        message = this.applyBless(targets, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'mass_antimagic':
        message = this.applyBuff.stat(targets, 'magic_immunity', 3);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА СМЕРТИ ===
      case 'weakness':
        message = this.applyDebuff.stat(targets, 'attack', 5 + spellPower, 3);
        affectedUnits.push(...targets);
        break;
      case 'curse':
        message = this.applyDebuff.stat(targets, 'min_damage', 0, 3);
        affectedUnits.push(...targets);
        break;
      case 'implosion':
        message = this.applyDamageSpell(targets, 30 + spellPower * 5);
        this.applyDebuff.stat(targets, 'defense', 5, 3);
        affectedUnits.push(...targets);
        break;
      case 'drain_life':
        message = this.applyDrainLife(targets, 20 + spellPower * 5, caster);
        affectedUnits.push(...targets);
        break;
      case 'age':
        this.applyDebuff.stat(targets, 'attack', 5, 3);
        message = this.applyDebuff.stat(targets, 'defense', 5, 3);
        affectedUnits.push(...targets);
        break;
      case 'soul_eater':
        message = this.applyDamageSpell(targets, 40 + spellPower * 8);
        affectedUnits.push(...targets);
        break;
      case 'animate_dead':
        message = '💀 Оживление мертвых: призыв нежити';
        break;
      case 'mass_curse':
        message = this.applyDebuff.stat(targets, 'min_damage', 0, 3);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ПОРЯДКА ===
      case 'dispel':
        message = this.applyDispel(targets);
        affectedUnits.push(...targets);
        break;
      case 'precision':
        message = this.applyBuff.stat(targets, 'ranged_damage', 3, 50 + spellPower * 10);
        affectedUnits.push(...targets);
        break;
      case 'shield_wall':
        message = this.applyShield(targets, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'precision_shot':
        message = this.applyBuff.stat(targets, 'critical_chance', 1, 100);
        affectedUnits.push(...targets);
        break;
      case 'time_warp':
        message = this.applyExtraTurn(targets);
        affectedUnits.push(...targets);
        break;
      case 'mass_slow':
        message = this.applySlow(targets, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'mass_haste':
        message = this.applyHaste(targets, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'mass_shield':
        message = this.applyShield(targets, spellPower);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ХАОСА ===
      case 'poison':
        message = this.applyDebuff.stat(targets, 'poison', 5 + spellPower, 3);
        affectedUnits.push(...targets);
        break;
      case 'confusion':
        message = this.applyDebuff.stat(targets, 'confusion', 0, 3);
        affectedUnits.push(...targets);
        break;
      case 'inferno':
        message = this.applyFireball(targets, 60 + spellPower * 10, targetPosition);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ПРИРОДЫ ===
      case 'strength':
        message = this.applyBloodlust(targets, spellPower + 5);
        affectedUnits.push(...targets);
        break;
      case 'antidote':
        message = this.applyDispel(targets);
        affectedUnits.push(...targets);
        break;
      case 'earthquake':
        message = this.applyDamageSpell(targets, 40 + spellPower * 8);
        affectedUnits.push(...targets);
        break;
      case 'thunderbolt':
        message = this.applyLightning(targets, spellPower);
        this.applyBlind(targets, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'bark_skin':
        message = this.applyStoneskin(targets, spellPower + 3);
        affectedUnits.push(...targets);
        break;
      case 'eruption':
        message = this.applyFireball(targets, 45 + spellPower * 8, targetPosition);
        affectedUnits.push(...targets);
        break;
      case 'summon_elementals':
        message = '🌲 Призыв элементалей: 5 элементалей на 3 хода';
        break;
      case 'mirage':
        message = '🌲 Мираж: иллюзии созданы';
        break;
      case 'water_walk':
        message = '💧 Хождение по воде активировано';
        break;

      // === НОВЫЕ ЗАКЛИНАНИЯ ===

      // === ШКОЛА ЖИЗНИ ===
      case 'holy_word':
        message = this.applyDamageSpell(targets.filter(t => hasAbility(t.creatureId, 'undead')), 25 + spellPower * 5);
        affectedUnits.push(...targets.filter(t => hasAbility(t.creatureId, 'undead')));
        break;
      case 'celestial_armor':
        message = this.applyBuff.stat(targets, 'defense', 3, 10);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА СМЕРТИ ===
      case 'spectral_arms':
        message = this.applyBuff.stat(targets, 'attack', 3, 8);
        affectedUnits.push(...targets);
        break;
      case 'fear':
        message = this.applyDebuff.stat(targets, 'morale', 3, 3);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ПОРЯДКА ===
      case 'invisibility':
        message = this.applyBuff.stat(targets, 'invisible', 2, 1);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ХАОСА ===
      case 'devil_sight':
        message = this.applyBuff.stat(targets, 'damage_vs_weakened', 3, 50);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ПРИРОДЫ ===
      case 'mass_stoneskin':
        message = this.applyStoneskin(targets, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'summon_boat':
        message = '⛵ Корабль призван у ближайшего берега!';
        break;

      // === НЕДОСТАЮЩИЕ ЗАКЛИНАНИЯ (канон HoMM4) ===

      // === ШКОЛА СМЕРТИ ===
      case 'destroy_unholy':
        message = this.applyDestroyUnholy(targets, spellPower);
        affectedUnits.push(...targets.filter(t => hasAbility(t.creatureId, 'undead')));
        break;
      case 'hellfire':
        message = this.applyDamageSpell(targets, 50 + spellPower * 10);
        affectedUnits.push(...targets);
        break;
      case 'misery':
        message = this.applyDebuff.stat(targets, 'morale', 3, 5 + spellPower);
        affectedUnits.push(...targets);
        break;
      case 'sacrifice':
        message = this.applySacrifice(targets, caster, spellPower);
        affectedUnits.push(...targets);
        break;
      case 'summon_daemons':
        message = '😈 Призыв демонов: 3 демонов на 5 ходов';
        break;
      case 'vampirism':
        message = this.applyBuff.stat(targets, 'lifesteal', 3, 30 + spellPower * 10);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ПОРЯДКА ===
      case 'dimension_door':
        message = this.applyTeleport(targets, targetPosition);
        affectedUnits.push(...targets);
        break;
      case 'force_field':
        message = '🔮 Силовое поле: непроходимый барьер создан';
        break;
      case 'portal':
        message = '🌀 Портал: телепортация между двумя точками';
        break;
      case 'transmutation':
        message = '⚡ Трансмутация: ресурсы преобразованы';
        break;

      // === ШКОЛА ПРИРОДЫ ===
      case 'land_mine':
        message = '💣 Сухопутная мина: ловушка установлена';
        break;
      case 'pathfinding':
        message = this.applyBuff.stat(targets, 'movement', 3, 50 + spellPower * 10);
        affectedUnits.push(...targets);
        break;
      case 'retaliation_free':
        message = this.applyBuff.stat(targets, 'free_retaliation', 1, 1);
        affectedUnits.push(...targets);
        break;
      case 'thunder_storm':
        message = this.applyDamageSpell(targets, 35 + spellPower * 7);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ЖИЗНИ ===
      case 'holy_light':
        message = this.applyHeal(targets, spellPower * 1.5);
        affectedUnits.push(...targets);
        break;
      case 'resurrection_mass':
        message = this.applyResurrect(targets, spellPower * 2);
        affectedUnits.push(...targets);
        break;

      // === ШКОЛА ХАОСА ===
      case 'metamorphosis':
        message = '🔮 Метаморфоза: юнит трансформирован';
        break;

      default:
        return { success: false, message: 'Неизвестное заклинание', affectedUnits: [] };
    }

    this.playSpellVisualEffect(spell, targets, targetPosition);

    return { success: true, message, affectedUnits };
  }

  // ============================================================================
  // ШКОЛА ЖИЗНИ (Life Magic)
  // ============================================================================

  private applyBless(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'bless',
        duration: 3,
        value: 20 + spellPower * 5
      });
    }
    return `✨ Благословение: +${20 + spellPower * 5}% урона на 3 хода`;
  }

  private applyHeal(targets: BattleUnit[], spellPower: number): string {
    const healAmount = 30 + spellPower * 10;
    let totalHealed = 0;

    for (const target of targets) {
      const before = target.currentHealth;
      target.currentHealth = Math.min(target.maxHealth, target.currentHealth + healAmount);
      totalHealed += target.currentHealth - before;
    }

    return `💚 Исцеление: восстановлено ${totalHealed} HP`;
  }

  private applySlow(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'slow',
        duration: 3,
        value: 50
      });
    }
    return `❄️ Замедление: скорость -50% на 3 хода`;
  }

  private applyTeleport(targets: BattleUnit[], targetPosition?: { x: number; y: number }): string {
    if (!targetPosition || targets.length === 0) return 'Ошибка телепортации';
    const target = targets[0];
    target.x = targetPosition.x;
    target.y = targetPosition.y;
    return `🌀 Телепорт: ${target.creatureId} перемещён`;
  }

  private applyClone(targets: BattleUnit[], spellPower: number): string {
    // Клонирование реализуется на уровне сцены (создание нового юнита)
    for (const target of targets) {
      target.effects.push({
        spellId: 'clone_source',
        duration: 3,
        value: spellPower
      });
    }
    return `👥 Клонирование: создана копия существа`;
  }

  // ============================================================================
  // ШКОЛА ХАОСА (Chaos Magic)
  // ============================================================================

  private applyBloodlust(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'bloodlust',
        duration: 3,
        value: 5 + spellPower
      });
    }
    return `🔥 Жажда крови: +${5 + spellPower} атаки на 3 хода`;
  }

  private applyFireball(targets: BattleUnit[], spellPower: number, targetPosition?: { x: number; y: number }): string {
    const damage = 25 + spellPower * 5;
    let totalDamage = 0;

    for (const target of targets) {
      const actualDamage = Math.min(target.currentHealth, damage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
    }

    return `🔥 Огненный шар: ${totalDamage} урона по области`;
  }

  private applyBerserk(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'berserk',
        duration: 2,
        value: spellPower
      });
    }
    return `💢 Берсерк: юнит теряет контроль на 2 хода`;
  }

  private applyArmageddon(targets: BattleUnit[], spellPower: number): string {
    const damage = 100 + spellPower * 10;
    let totalDamage = 0;

    for (const target of targets) {
      const actualDamage = Math.min(target.currentHealth, damage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
    }

    return `☄️ АРМАГЕДДОН: ${totalDamage} урона всем!`;
  }

  // ============================================================================
  // ШКОЛА ПОРЯДКА (Order Magic) — защита
  // ============================================================================

  private applyShield(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'shield',
        duration: 3,
        value: 30 + spellPower * 5
      });
    }
    return `🛡 Щит: -${30 + spellPower * 5}% урона на 3 хода`;
  }

  private applyStoneskin(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'stoneskin',
        duration: 3,
        value: 5 + spellPower
      });
    }
    return `🪨 Каменная кожа: +${5 + spellPower} защиты на 3 хода`;
  }

  private applyMeteor(targets: BattleUnit[], spellPower: number): string {
    const damage = 50 + spellPower * 10;
    let totalDamage = 0;

    for (const target of targets) {
      const actualDamage = Math.min(target.currentHealth, damage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
    }

    return `☄️ Метеор: ${totalDamage} урона`;
  }

  private applyResurrect(targets: BattleUnit[], spellPower: number): string {
    const healAmount = 50 + spellPower * 15;
    let totalHealed = 0;

    for (const target of targets) {
      const before = target.currentHealth;
      target.currentHealth = Math.min(target.maxHealth, target.currentHealth + healAmount);
      totalHealed += target.currentHealth - before;

      // Восстановление количества существ
      const healthPerUnit = target.maxHealth / (target.count || 1);
      const resurrected = Math.floor((target.currentHealth - before) / healthPerUnit);
      target.count = Math.min(target.maxHealth / healthPerUnit, target.count + resurrected);
    }

    return `✨ Воскрешение: восстановлено ${totalHealed} HP`;
  }

  // ============================================================================
  // ШКОЛА ПОРЯДКА (Order Magic) — контроль
  // ============================================================================

  private applyHaste(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'haste',
        duration: 3,
        value: 50 + spellPower * 10
      });
    }
    return `💨 Ускорение: +${50 + spellPower * 10}% скорости на 3 хода`;
  }

  private applyLightning(targets: BattleUnit[], spellPower: number): string {
    const damage = 30 + spellPower * 8;
    let totalDamage = 0;

    for (const target of targets) {
      const actualDamage = Math.min(target.currentHealth, damage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
    }

    return `⚡ Молния: ${totalDamage} урона`;
  }

  private applyChainLightning(targets: BattleUnit[], spellPower: number): string {
    const baseDamage = 25 + spellPower * 6;
    let totalDamage = 0;
    let currentDamage = baseDamage;

    for (let i = 0; i < targets.length; i++) {
      const target = targets[i];
      const actualDamage = Math.min(target.currentHealth, currentDamage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
      currentDamage *= 0.75; // -25% за каждую цель
    }

    return `⚡ Цепная молния: ${totalDamage} урона по ${targets.length} целям`;
  }

  private applyFly(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'fly',
        duration: 3,
        value: spellPower
      });
    }
    return `🕊️ Полёт: юнит летает 3 хода`;
  }

  // ============================================================================
  // ШКОЛА ПОРЯДКА (Order Magic) — разум
  // ============================================================================

  private applyBlind(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'blind',
        duration: 1,
        value: spellPower
      });
      target.hasActed = true; // Пропускает текущий ход
    }
    return `👁️ Ослепление: юнит пропускает ход`;
  }

  private applyForgetfulness(targets: BattleUnit[], spellPower: number): string {
    for (const target of targets) {
      target.effects.push({
        spellId: 'forgetfulness',
        duration: 3,
        value: spellPower
      });
    }
    return `🧠 Забывчивость: стрелок не может стрелять 3 хода`;
  }

  // ============================================================================
  // УТИЛИТЫ
  // ============================================================================

  /**
   * Нанести урон целям
   */
  private applyDamageSpell(targets: BattleUnit[], damage: number): string {
    let totalDamage = 0;
    for (const target of targets) {
      const actualDamage = Math.min(target.currentHealth, damage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
    }
    return `💥 ${totalDamage} урона`;
  }

  /**
   * Пожирание жизни: урон + лечение заклинателя
   */
  private applyDrainLife(targets: BattleUnit[], damage: number, caster: BattleUnit | null): string {
    let totalDamage = 0;
    for (const target of targets) {
      const actualDamage = Math.min(target.currentHealth, damage);
      target.currentHealth -= actualDamage;
      totalDamage += actualDamage;
      this.applyDamageToCount(target, actualDamage);
    }
    if (caster) {
      const heal = Math.floor(totalDamage * 0.5);
      caster.currentHealth = Math.min(caster.maxHealth, caster.currentHealth + heal);
      return `💀 Пожирание жизни: ${totalDamage} урона, +${heal} HP`;
    }
    return `💀 Пожирание жизни: ${totalDamage} урона`;
  }

  /**
   * Снять все эффекты с целей
   */
  private applyDispel(targets: BattleUnit[]): string {
    for (const target of targets) {
      target.effects = [];
    }
    return '✨ Эффекты сняты';
  }

  /**
   * Дать дополнительный ход
   */
  private applyExtraTurn(targets: BattleUnit[]): string {
    for (const target of targets) {
      target.hasActed = false;
      target.effects.push({ spellId: 'extra_turn', duration: 1, value: 1 });
    }
    return '⏱ Дополнительный ход!';
  }

  /**
   * Буфф: добавить эффект stat
   */
  private applyBuff = {
    stat: (targets: BattleUnit[], stat: string, duration: number, value: number = 1): string => {
      for (const target of targets) {
        target.effects.push({ spellId: stat, duration, value });
      }
      return `✨ Буфф: ${stat} на ${duration} ходов`;
    }
  };

  /**
   * Дебафф: добавить негативный эффект stat
   */
  private applyDebuff = {
    stat: (targets: BattleUnit[], stat: string, value: number, duration: number): string => {
      for (const target of targets) {
        target.effects.push({ spellId: `debuff_${stat}`, duration, value });
      }
      return `💀 Дебафф: -${stat} на ${duration} ходов`;
    }
  };

  /**
   * Применить урон к количеству существ в отряде
   */
  private applyDamageToCount(unit: BattleUnit, damage: number): void {
    if (unit.count <= 0) return;

    const healthPerUnit = unit.maxHealth / unit.count;
    const deadCount = Math.floor(damage / healthPerUnit);
    unit.count = Math.max(0, unit.count - deadCount);
  }

  /**
   * Визуальный эффект заклинания
   */
  private playSpellVisualEffect(
    spell: Spell,
    targets: BattleUnit[],
    targetPosition?: { x: number; y: number }
  ): void {
    // Цвета школ магии HoMM4 (канон)
    const colorMap: Record<string, number> = {
      life: 0xffd700,      // Золотой — Жизнь
      death: 0x8b008b,     // Тёмно-фиолетовый — Смерть
      order: 0x4169e1,     // Королевский синий — Порядок
      chaos: 0xff4500,     // Оранжево-красный — Хаос
      natural: 0x228b22,   // Лесной зелёный — Природа
      tactics: 0xdc143c    // Багровый — Тактика
    };

    const color = colorMap[spell.school] || 0xffffff;

    for (const target of targets) {
      const sprite = this.scene.children.getByName(`unit_${target.id}`) as Phaser.GameObjects.Sprite;
      if (sprite) {
        // Вспышка цвета школы
        this.scene.tweens.add({
          targets: sprite,
          tint: color,
          duration: 150,
          yoyo: true,
          repeat: 2
        });

        // Частицы для AoE
        if (spell.target === 'area' || spell.target === 'all') {
          this.createParticleEffect(sprite.x, sprite.y, color);
        }
      }
    }
  }

  /**
   * Создать эффект частиц
   */
  private createParticleEffect(x: number, y: number, color: number): void {
    const particles = this.scene.add.particles(x, y, 'particle', {
      speed: { min: 50, max: 150 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: color,
      lifespan: 600,
      quantity: 15
    });

    this.scene.time.delayedCall(600, () => particles.destroy());
  }

  /**
   * Обновить длительность эффектов в конце хода
   */
  tickEffects(unit: BattleUnit): string[] {
    const expired: string[] = [];
    unit.effects = unit.effects.filter(effect => {
      effect.duration--;
      if (effect.duration <= 0) {
        expired.push(effect.spellId);
        return false;
      }
      return true;
    });
    return expired;
  }

  /**
   * Получить модификатор атаки с учётом эффектов
   */
  getAttackModifier(unit: BattleUnit): number {
    let modifier = 0;
    for (const effect of unit.effects) {
      if (effect.spellId === 'bloodlust' || effect.spellId === 'attack') {
        modifier += effect.value || 0;
      }
      if (effect.spellId === 'debuff_attack') {
        modifier -= effect.value || 0;
      }
    }
    return modifier;
  }

  /**
   * Получить модификатор защиты с учётом эффектов
   */
  getDefenseModifier(unit: BattleUnit): number {
    let modifier = 0;
    for (const effect of unit.effects) {
      if (effect.spellId === 'stoneskin' || effect.spellId === 'defense') {
        modifier += effect.value || 0;
      }
      if (effect.spellId === 'debuff_defense') {
        modifier -= effect.value || 0;
      }
    }
    return modifier;
  }

  /**
   * Получить модификатор скорости с учётом эффектов
   */
  getSpeedModifier(unit: BattleUnit): number {
    let modifier = 1;
    for (const effect of unit.effects) {
      if (effect.spellId === 'haste') {
        modifier *= 1 + (effect.value || 0) / 100;
      } else if (effect.spellId === 'slow') {
        modifier *= 1 - (effect.value || 0) / 100;
      }
    }
    return modifier;
  }

  /**
   * Получить модификатор урона с учётом эффектов
   */
  getDamageModifier(unit: BattleUnit): number {
    let modifier = 1;
    for (const effect of unit.effects) {
      if (effect.spellId === 'bless' || effect.spellId === 'damage') {
        modifier *= 1 + (effect.value || 0) / 100;
      }
      if (effect.spellId === 'ranged_damage') {
        modifier *= 1 + (effect.value || 0) / 100;
      }
      if (effect.spellId === 'debuff_min_damage') {
        modifier = 0.5; // Проклятие: минимальный урон
      }
    }
    return modifier;
  }

  /**
   * Получить модификатор получаемого урона
   */
  getIncomingDamageModifier(unit: BattleUnit): number {
    let modifier = 1;
    for (const effect of unit.effects) {
      if (effect.spellId === 'shield' || effect.spellId === 'defense') {
        modifier *= 1 - (effect.value || 0) / 100;
      }
      if (effect.spellId === 'magic_immunity') {
        return 0; // Антимагия:免疫 к магическому урону
      }
    }
    return modifier;
  }

  /**
   * Проверить, ослеплён ли юнит
   */
  isBlinded(unit: BattleUnit): boolean {
    return unit.effects.some(e => e.spellId === 'blind');
  }

  /**
   * Проверить, может ли стрелок стрелять
   */
  canShoot(unit: BattleUnit): boolean {
    return !unit.effects.some(e => e.spellId === 'forgetfulness');
  }

  /**
   * Проверить, в берсерке ли юнит
   */
  isBerserk(unit: BattleUnit): boolean {
    return unit.effects.some(e => e.spellId === 'berserk');
  }

  /**
   * Проверить, может ли юнит летать
   */
  canFly(unit: BattleUnit): boolean {
    return unit.effects.some(e => e.spellId === 'fly');
  }

  // ============================================================================
  // НОВЫЕ МЕТОДЫ ДЛЯ НЕДОСТАЮЩИХ ЗАКЛИНАНИЙ
  // ============================================================================

  /**
   * Уничтожение нежити (Death school)
   * Наносит巨额 урон нежити, лечит живых союзников
   */
  private applyDestroyUnholy(targets: BattleUnit[], spellPower: number): string {
    let damage = 0;
    let healed = 0;
    
    for (const target of targets) {
      if (hasAbility(target.creatureId, 'undead')) {
        // Урон нежити
        const dmg = 50 + spellPower * 15;
        target.currentHealth -= dmg;
        damage += dmg;
      } else {
        // Лечение живых союзников
        const heal = 20 + spellPower * 5;
        const before = target.currentHealth;
        target.currentHealth = Math.min(target.maxHealth, target.currentHealth + heal);
        healed += target.currentHealth - before;
      }
    }
    
    return `💀 Уничтожение нежити: ${damage} урона нежити, ${healed} лечения`;
  }

  /**
   * Жертва (Death school)
   * Жертвует одним юнитом для лечения другого
   */
  private applySacrifice(targets: BattleUnit[], caster: BattleUnit | null, spellPower: number): string {
    if (targets.length < 2 || !caster) {
      return '❌ Жертва требует 2 юнита';
    }
    
    // Первый юнит — жертва, второй — получатель
    const victim = targets[0];
    const recipient = targets[1];
    
    // Жертва погибает
    const sacrificeHeal = victim.currentHealth * (0.5 + spellPower * 0.1);
    victim.currentHealth = 0;
    
    // Получатель лечится
    const before = recipient.currentHealth;
    recipient.currentHealth = Math.min(recipient.maxHealth, recipient.currentHealth + sacrificeHeal);
    const healed = recipient.currentHealth - before;
    
    return `💀 Жертва: ${victim.creatureId} погибает, ${recipient.creatureId} восстанавливает ${Math.round(healed)} HP`;
  }
}
