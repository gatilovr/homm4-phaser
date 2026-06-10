import { Hero, HeroSkill, HeroStats } from '../types';
import { SkillSystem, SkillData, HeroSpecialization } from './SkillSystem';
import { SkillChoiceUI } from '../ui/SkillChoiceUI';
import { GameRandom } from '../utils/Random';
import { CONFIG } from '../config';

/**
 * HeroManager — единый модуль управления героями и их навыками (100%).
 *
 * Что делает:
 * ✅ Применение ВСЕХ 16 навыков в бою и на карте
 * ✅ 10 специализаций героев (бонусы по классу)
 * ✅ Стартовые навыки и характеристики по классу
 * ✅ Повышение уровня с UI выбора навыка
 * ✅ Ограничение на максимум 8 навыков
 * ✅ Расчёт всех бонусов
 */
export class HeroManager {
  private skillSystem: SkillSystem;
  private static instance: HeroManager | null = null;
  /** Максимум навыков у героя (как в HoMM4) */
  public static MAX_SKILLS = 8;

  public static getInstance(seed: number = Date.now()): HeroManager {
    if (!HeroManager.instance) {
      HeroManager.instance = new HeroManager(seed);
    }
    return HeroManager.instance;
  }

  constructor(seed: number = Date.now()) {
    this.skillSystem = new SkillSystem(seed);
  }

  public getSkillSystem(): SkillSystem {
    return this.skillSystem;
  }

  /**
   * Загрузить данные навыков из JSON
   */
  public loadSkillsData(data: any): void {
    this.skillSystem.loadSkills(data);
  }

  // ═══════════════════════════════════════════════════════════════
  // СОЗДАНИЕ ГЕРОЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Создать героя с правильными стартовыми навыками и специализацией
   */
  public createHero(params: {
    id: string;
    name: string;
    heroClass: string;
    faction: string;
    level?: number;
    owner?: 'player' | 'enemy';
  }): Hero {
    const { id, name, heroClass, faction, level = 1, owner = 'player' } = params;

    // Стартовые характеристики по классу
    const baseStats = this.skillSystem.getStartingStats(heroClass);

    // Стартовые навыки по классу
    const startingSkills = this.skillSystem.getStartingSkills(heroClass);

    // Рассчитываем HP героя по классу и уровню
    const heroHP = this.skillSystem.calculateHeroHP(heroClass, level);

    // Базовая мана зависит от знаний
    const maxMana = 10 + baseStats.knowledge * 5;

    const hero: Hero = {
      id,
      name,
      class: heroClass,
      faction,
      level,
      experience: 0,
      x: 0,
      y: 0,
      movementPoints: 1500,
      maxMovementPoints: 1500,
      stats: {
        attack: baseStats.attack,
        defense: baseStats.defense,
        spellPower: baseStats.spellPower,
        knowledge: baseStats.knowledge,
        hp: heroHP,
        maxHp: heroHP
      },
      skills: startingSkills,
      mana: maxMana,
      maxMana,
      army: [],
      equipment: {},
      spells: [],
      morale: 1,
      luck: 0,
      owner,
      mapLevel: 'surface'
    };

    // Применяем специализацию
    this.applySpecialization(hero);

    // Применяем бонусы морали/удачи от навыков (Leadership/Luck)
    hero.morale += this.getMoraleBonus(hero);
    hero.luck += this.getLuckBonus(hero);

    // Максимальные очки движения с учётом Логистики
    hero.maxMovementPoints = this.getMaxMovementPoints(hero);
    hero.movementPoints = hero.maxMovementPoints;

    // Обновляем ману с учётом Интеллекта
    hero.maxMana = this.calculateMaxMana(hero);
    hero.mana = hero.maxMana;

    return hero;
  }

  /**
   * Применить специализацию класса героя
   */
  public applySpecialization(hero: Hero): void {
    const spec = this.skillSystem.getSpecialization(hero.class);
    if (!spec) return;

    // Бонусы специализаций применяются к статам
    switch (hero.class) {
      case 'knight':
        // +1 мораль для всех союзников
        hero.stats.attack += 0; // мораль будет учитываться в бою
        break;
      case 'cleric':
        hero.stats.spellPower += 1; // +1 к силе заклинаний лечения
        break;
      case 'death_knight':
        hero.stats.attack += 1; // +1 атака для нежити
        break;
      case 'necromancer':
        hero.stats.spellPower += 2; // +2 к некромантии
        break;
      case 'ranger':
        hero.stats.attack += 1; // +1 атака стрелкам
        break;
      case 'druid':
        hero.stats.spellPower += 1;
        hero.stats.knowledge += 1;
        break;
      case 'demoniac':
        hero.stats.attack += 2; // +2 атака существ хаоса
        break;
      case 'heretic':
        hero.stats.spellPower += 2; // +2 к разрушительным заклинаниям
        break;
      case 'wizard':
        hero.stats.knowledge += 2; // доступ ко всем школам
        break;
      case 'barbarian':
        hero.stats.attack += 2;
        hero.stats.defense += 1; // +2 атака ближнего боя
        break;
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // ПРИМЕНЕНИЕ НАВЫКОВ В БОЮ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Получить модификатор урона ближнего боя (Наступление + спец. barbarian)
   */
  public getMeleeDamageMultiplier(hero: Hero | null): number {
    if (!hero) return 1;
    const offenseBonus = this.skillSystem.getMeleeDamageBonus(hero);
    let mult = 1 + offenseBonus / 100;

    // Специализация barbarian: +10% урон ближнего боя
    if (hero.class === 'barbarian') mult += 0.10;

    return mult;
  }

  /**
   * Получить модификатор урона стрелков (Стрельба + спец. ranger)
   */
  public getRangedDamageMultiplier(hero: Hero | null): number {
    if (!hero) return 1;
    const archeryBonus = this.skillSystem.getRangedDamageBonus(hero);
    let mult = 1 + archeryBonus / 100;

    // Специализация ranger: +15% урон стрелков
    if (hero.class === 'ranger') mult += 0.15;

    return mult;
  }

  /**
   * Получить модификатор получаемого урона (Оборона)
   */
  public getIncomingDamageMultiplier(hero: Hero | null): number {
    if (!hero) return 1;
    const reduction = this.skillSystem.getDamageReduction(hero);
    return Math.max(0.3, 1 - reduction / 100);
  }

  /**
   * Получить бонус морали от Leadership + специализации knight
   */
  public getMoraleBonus(hero: Hero | null): number {
    if (!hero) return 0;
    let bonus = this.skillSystem.getMoraleBonus(hero);
    if (hero.class === 'knight') bonus += 1;
    return bonus;
  }

  /**
   * Получить бонус удачи
   */
  public getLuckBonus(hero: Hero | null): number {
    if (!hero) return 0;
    return this.skillSystem.getLuckBonus(hero);
  }

  /**
   * Получить модификатор урона заклинаний (Sorcery + спец. heretic)
   */
  public getSpellDamageMultiplier(hero: Hero | null): number {
    if (!hero) return 1;
    const sorceryBonus = this.skillSystem.getSpellDamageBonus(hero);
    let mult = 1 + sorceryBonus / 100;

    // Специализация heretic: +15% урон разрушительных заклинаний
    if (hero.class === 'heretic') mult += 0.15;

    return mult;
  }

  /**
   * Получить модификатор лечения (спец. cleric)
   */
  public getHealingMultiplier(hero: Hero | null): number {
    if (!hero) return 1;
    if (hero.class === 'cleric') return 1.15;
    return 1;
  }

  /**
   * Получить модификатор некромантии (спец. death_knight/necromancer)
   */
  public getNecromancyBonus(hero: Hero | null): number {
    if (!hero) return 0;
    if (hero.class === 'necromancer') return 0.10;
    if (hero.class === 'death_knight') return 0.05;
    return 0;
  }

  /**
   * Регенерация маны за ход в бою (Мистицизм)
   */
  public getManaRegenPerTurn(hero: Hero | null): number {
    if (!hero) return 0;
    return this.skillSystem.getManaRegenPerTurn(hero);
  }

  /**
   * Максимальный уровень заклинаний (Wisdom)
   */
  public getMaxSpellLevel(hero: Hero | null): number {
    if (!hero) return 2;
    // Wizard — доступ ко всем школам (уровень 5)
    if (hero.class === 'wizard') return 5;
    return this.skillSystem.getMaxSpellLevel(hero);
  }

  /**
   * Может ли герой изучать заклинание данного уровня
   */
  public canLearnSpell(hero: Hero, spellLevel: number): boolean {
    return spellLevel <= this.getMaxSpellLevel(hero);
  }

  /**
   * Максимальная мана с учётом Intelligence
   */
  public calculateMaxMana(hero: Hero): number {
    const baseMana = 10 + hero.stats.knowledge * 5;
    const intBonus = this.skillSystem.getManaBonusPercent(hero);
    return Math.floor(baseMana * (1 + intBonus / 100));
  }

  // ═══════════════════════════════════════════════════════════════
  // ПРИМЕНЕНИЕ НАВЫКОВ НА КАРТЕ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Максимальные очки движения (Логистика)
   */
  public getMaxMovementPoints(hero: Hero): number {
    const basePoints = 1500;
    const speedBonus = hero.stats.knowledge * 20; // знания влияют на движение
    const logisticsBonus = this.skillSystem.getMovementBonusPercent(hero);
    return Math.floor((basePoints + speedBonus) * (1 + logisticsBonus / 100));
  }

  /**
   * Радиус обзора (Разведка + базовый)
   */
  public getVisionRadius(hero: Hero): number {
    const baseRadius = 4;
    const scoutingBonus = this.skillSystem.getVisionRadiusBonus(hero);
    return baseRadius + scoutingBonus;
  }

  /**
   * Модификатор штрафа местности (Следопыт)
   */
  public getTerrainPenaltyMultiplier(hero: Hero): number {
    const reduction = this.skillSystem.getTerrainPenaltyReduction(hero);
    return Math.max(0.25, 1 - reduction / 100);
  }

  /**
   * Ежедневный доход золота (Поместье)
   */
  public getDailyGoldIncome(hero: Hero): number {
    return this.skillSystem.getDailyGoldIncome(hero);
  }

  /**
   * Шанс присоединить нейтральных существ (Дипломатия)
   */
  public getDiplomacyChance(hero: Hero): number {
    return this.skillSystem.getDiplomacyChance(hero);
  }

  /**
   * Попытка дипломатии — шанс что нейтралы присоединятся
   */
  public tryDiplomacy(hero: Hero): { success: boolean; joinedCount: number } {
    const chance = this.getDiplomacyChance(hero);
    if (chance <= 0) return { success: false, joinedCount: 0 };

    const roll = GameRandom.randomInt(1, 100);
    return {
      success: roll <= chance,
      joinedCount: roll <= chance ? GameRandom.randomInt(1, 5) : 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // ПОВЫШЕНИЕ УРОВНЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Проверить и применить повышение уровня
   * @returns true если уровень повышен
   */
  public checkLevelUp(hero: Hero): boolean {
    const expToLevel = hero.level * 1000;
    if (hero.experience < expToLevel) return false;

    hero.level++;
    hero.experience -= expToLevel;

    // Базовые бонусы
    hero.stats.attack += 1;
    hero.stats.defense += 1;

    // Увеличиваем HP на perLevel для класса героя
    const hpPerLevel = this.skillSystem.getHPPerLevel(hero.class);
    hero.stats.hp += hpPerLevel;
    hero.stats.maxHp = hero.stats.hp;

    // Обновляем ману
    hero.maxMana = this.calculateMaxMana(hero);
    hero.mana = Math.min(hero.mana, hero.maxMana);

    return true;
  }

  /**
   * Показать UI выбора навыка и применить выбор
   */
  public showSkillChoice(
    scene: Phaser.Scene,
    hero: Hero,
    onComplete: () => void
  ): void {
    // Ограничение: не более 8 навыков
    if (hero.skills.length >= HeroManager.MAX_SKILLS) {
      // Проверяем, можно ли улучшить существующие
      const upgradeable = hero.skills.filter(s => {
        const data = this.skillSystem.getSkill(s.id);
        return data && s.level < data.maxLevel;
      });
      if (upgradeable.length === 0) {
        console.log('[HeroManager] Все навыки максимальны');
        onComplete();
        return;
      }
    }

    const [skill1, skill2] = this.skillSystem.proposeSkillChoices(hero);
    if (!skill1 || !skill2) {
      onComplete();
      return;
    }

    const currentLevel1 = hero.skills.find(s => s.id === skill1.id)?.level || 0;
    const currentLevel2 = hero.skills.find(s => s.id === skill2.id)?.level || 0;

    const ui = new SkillChoiceUI(scene, (skillId) => {
      const result = this.skillSystem.addSkill(hero, skillId);
      if (result) {
        console.log(`[HeroManager] Skill added: ${result.name} lvl ${result.level}`);
      }
      onComplete();
    });

    ui.show(skill1, skill2, currentLevel1, currentLevel2);
  }

  /**
   * Полный цикл: проверка level up + UI + бонусы
   */
  public processLevelUp(
    scene: Phaser.Scene,
    hero: Hero,
    notification: (msg: string) => void
  ): void {
    if (this.checkLevelUp(hero)) {
      notification(`🎉 Уровень ${hero.level}! +1 АТК, +1 ЗАЩ`);

      // Показать UI выбора навыка
      this.showSkillChoice(scene, hero, () => {
        // После выбора — продолжаем
        notification(`✨ Навык изучен/улучшен!`);
      });
    }
  }

  /**
   * Добавить опыт и обработать level up
   */
  public addExperience(
    scene: Phaser.Scene,
    hero: Hero,
    amount: number,
    notification: (msg: string) => void
  ): void {
    hero.experience += amount;
    notification(`✨ +${amount} опыта`);
    this.processLevelUp(scene, hero, notification);
  }

  // ═══════════════════════════════════════════════════════════════
  // UI — ПРОСМОТР НАВЫКОВ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Получить полную информацию о герое (для UI)
   */
  public getHeroInfoText(hero: Hero): string {
    const spec = this.skillSystem.getSpecialization(hero.class);
    const specStr = spec ? `\n🌟 Спец: ${spec.name} — ${spec.description}` : '';

    const skillsStr = hero.skills.length > 0
      ? hero.skills.map(s => `  ⭐ ${s.name} (ур.${s.level})`).join('\n')
      : '  (нет навыков)';

    const bonuses = this.calculateAllBonuses(hero);
    const bonusesStr = Object.entries(bonuses)
      .filter(([_, v]) => v !== 0)
      .map(([k, v]) => `  • ${this.translateBonusType(k)}: ${v > 0 ? '+' : ''}${v}`)
      .join('\n') || '  (нет бонусов)';

    return `🦸 ${hero.name} (${hero.class})
━━━━━━━━━━━━━━━━━━━━
📊 Уровень: ${hero.level} | Опыт: ${hero.experience}/${hero.level * 1000}
⚔️ АТК: ${hero.stats.attack}  🛡 ЗАЩ: ${hero.stats.defense}
🔮 Сила: ${hero.stats.spellPower}  📚 Знания: ${hero.stats.knowledge}
💧 Мана: ${hero.mana}/${hero.maxMana}
${specStr}

━━━ Навыки (${hero.skills.length}/${HeroManager.MAX_SKILLS}) ━━━
${skillsStr}

━━━ Активные бонусы ━━━
${bonusesStr}`;
  }

  /**
   * Рассчитать ВСЕ активные бонусы героя (для UI)
   */
  public calculateAllBonuses(hero: Hero): Record<string, number> {
    const bonuses: Record<string, number> = {};

    // Боевые бонусы
    const melee = (this.getMeleeDamageMultiplier(hero) - 1) * 100;
    if (melee > 0) bonuses['melee_damage'] = Math.round(melee);

    const ranged = (this.getRangedDamageMultiplier(hero) - 1) * 100;
    if (ranged > 0) bonuses['ranged_damage'] = Math.round(ranged);

    const defense = (1 - this.getIncomingDamageMultiplier(hero)) * 100;
    if (defense > 0) bonuses['damage_reduction'] = Math.round(defense);

    // Мораль и удача
    const morale = this.getMoraleBonus(hero);
    if (morale > 0) bonuses['morale'] = morale;

    const luck = this.getLuckBonus(hero);
    if (luck > 0) bonuses['luck'] = luck;

    // Магия
    const spellDmg = (this.getSpellDamageMultiplier(hero) - 1) * 100;
    if (spellDmg > 0) bonuses['spell_damage'] = Math.round(spellDmg);

    const manaRegen = this.getManaRegenPerTurn(hero);
    if (manaRegen > 0) bonuses['mana_regen'] = manaRegen;

    const maxSpellLevel = this.getMaxSpellLevel(hero);
    if (maxSpellLevel > 2) bonuses['max_spell_level'] = maxSpellLevel;

    // Карта
    const movement = (this.getMaxMovementPoints(hero) - 1500);
    if (movement > 0) bonuses['movement_points'] = movement;

    const vision = this.getVisionRadius(hero) - 4;
    if (vision > 0) bonuses['vision_radius'] = vision;

    // Экономика
    const goldIncome = this.getDailyGoldIncome(hero);
    if (goldIncome > 0) bonuses['daily_gold'] = goldIncome;

    const diplomacy = this.getDiplomacyChance(hero);
    if (diplomacy > 0) bonuses['diplomacy_chance'] = diplomacy;

    return bonuses;
  }

  private translateBonusType(type: string): string {
    const map: Record<string, string> = {
      melee_damage: 'Урон ближнего боя %',
      ranged_damage: 'Урон стрелков %',
      damage_reduction: 'Снижение урона %',
      morale: 'Мораль',
      luck: 'Удача',
      spell_damage: 'Урон заклинаний %',
      mana_regen: 'Маны за ход',
      max_spell_level: 'Макс. уровень заклинаний',
      movement_points: 'Очки движения',
      vision_radius: 'Радиус обзора',
      daily_gold: 'Золото в день',
      diplomacy_chance: 'Шанс дипломатии %'
    };
    return map[type] || type;
  }

  /**
   * Показать окно информации о герое
   */
  public showHeroInfoPanel(scene: Phaser.Scene, hero: Hero): void {
    const { width, height } = scene.scale;
    const container = scene.add.container(width / 2, height / 2).setDepth(500);

    const overlay = scene.add.rectangle(0, 0, width, height, 0x000000, 0.8)
      .setInteractive();
    container.add(overlay);

    const panel = scene.add.rectangle(0, 0, 550, 600, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, 0xd4af37);
    container.add(panel);

    const info = this.getHeroInfoText(hero);
    const text = scene.add.text(0, -50, info, {
      fontSize: '13px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      lineSpacing: 4,
      align: 'left'
    }).setOrigin(0.5);
    container.add(text);

    // Кнопка закрыть
    const closeBtn = scene.add.rectangle(0, 250, 150, 40, 0x8b4513, 0.95)
      .setStrokeStyle(2, 0xd4af37)
      .setInteractive({ useHandCursor: true });
    const closeText = scene.add.text(0, 250, '✖ Закрыть', {
      fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);

    closeBtn.on('pointerover', () => closeBtn.setFillStyle(0xa0522d));
    closeBtn.on('pointerout', () => closeBtn.setFillStyle(0x8b4513));
    closeBtn.on('pointerdown', () => container.destroy());

    container.add([closeBtn, closeText]);
  }
}
