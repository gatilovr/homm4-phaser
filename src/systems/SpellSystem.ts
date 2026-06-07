import Phaser from 'phaser';
import { BattleUnit, Spell, SpellEffect } from '../types';
import { GameRandom } from '../utils/Random';

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

      default:
        return { success: false, message: 'Неизвестное заклинание', affectedUnits: [] };
    }

    this.playSpellVisualEffect(spell, targets, targetPosition);

    return { success: true, message, affectedUnits };
  }

  // ============================================================================
  // ШКОЛА ВОДЫ
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
  // ШКОЛА ОГНЯ
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
  // ШКОЛА ЗЕМЛИ
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
  // ШКОЛА ВОЗДУХА
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
  // ШКОЛА РАЗУМА
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
    const colorMap: Record<string, number> = {
      water: 0x00bfff,
      fire: 0xff4500,
      earth: 0x8b4513,
      air: 0xffff00,
      mind: 0xff00ff
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
      if (effect.spellId === 'bloodlust') {
        modifier += effect.value || 0;
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
      if (effect.spellId === 'stoneskin') {
        modifier += effect.value || 0;
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
      if (effect.spellId === 'bless') {
        modifier *= 1 + (effect.value || 0) / 100;
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
      if (effect.spellId === 'shield') {
        modifier *= 1 - (effect.value || 0) / 100;
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
}
