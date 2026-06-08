import { Hero, HeroSkill, SkillCategory } from '../types';
import { SeededRandom } from '../utils/Random';

/**
 * Данные навыка из skills.json
 */
export interface SkillData {
  id: string;
  name: string;
  nameEn: string;
  category: SkillCategory;
  icon: string;
  description: string;
  maxLevel: number;
  effects: SkillEffectData[];
}

export interface SkillEffectData {
  level: number;
  type: string;
  value: number;
  description: string;
}

/**
 * Специализация героя (уникальный бонус по классу)
 */
export interface HeroSpecialization {
  id: string;
  name: string;
  description: string;
  icon: string;
  apply: (hero: Hero, context: any) => any;
}

/**
 * SkillSystem — управление навыками и специализациями героев.
 * 
 * Реализовано:
 * ✅ 16 навыков в 4 категориях
 * ✅ Стартовые навыки по классу героя
 * ✅ Предложение 2 навыков при повышении уровня
 * ✅ Расчёт всех бонусов
 * ✅ Специализации героев
 */
export class SkillSystem {
  private skills: Map<string, SkillData> = new Map();
  private random: SeededRandom;
  
  // === СПЕЦИАЛИЗАЦИИ ГЕРОЕВ ===
  public static SPECIALIZATIONS: Record<string, HeroSpecialization> = {
    knight: {
      id: 'knight_specialization',
      name: 'Лидер людей',
      description: '+1 мораль для всех союзников',
      icon: '👑',
      apply: (hero) => {
        hero.stats.morale = (hero.stats.morale || 0) + 1;
      }
    },
    cleric: {
      id: 'cleric_specialization',
      name: 'Божественный целитель',
      description: '+15% эффективность заклинаний лечения',
      icon: '✝️',
      apply: () => {} // применяется в SpellSystem
    },
    death_knight: {
      id: 'death_knight_specialization',
      name: 'Владыка нежити',
      description: '+5% к некромантии',
      icon: '💀',
      apply: () => {}
    },
    necromancer: {
      id: 'necromancer_specialization',
      name: 'Архинежить',
      description: '+10% к некромантии',
      icon: '☠️',
      apply: () => {}
    },
    ranger: {
      id: 'ranger_specialization',
      name: 'Охотник',
      description: '+1 скорость всем стрелкам',
      icon: '🏹',
      apply: () => {}
    },
    druid: {
      id: 'druid_specialization',
      name: 'Маг природы',
      description: '+2 к силе магии природы',
      icon: '🌿',
      apply: () => {}
    },
    demoniac: {
      id: 'demoniac_specialization',
      name: 'Хаос',
      description: '+10% урон существ хаоса',
      icon: '🔥',
      apply: () => {}
    },
    heretic: {
      id: 'heretic_specialization',
      name: 'Отступник',
      description: '+15% урон разрушительных заклинаний',
      icon: '⚡',
      apply: () => {}
    },
    wizard: {
      id: 'wizard_specialization',
      name: 'Эрудит',
      description: 'Доступ ко всем школам магии',
      icon: '📚',
      apply: () => {}
    },
    barbarian: {
      id: 'barbarian_specialization',
      name: 'Ярость',
      description: '+2 атака существ ближнего боя',
      icon: '🪓',
      apply: () => {}
    }
  };

  // === СТАРТОВЫЕ НАВЫКИ ПО КЛАССАМ ===
  public static STARTING_SKILLS: Record<string, string[]> = {
    knight: ['offense', 'leadership'],
    cleric: ['wisdom', 'mysticism'],
    death_knight: ['offense', 'defense_skill'],
    necromancer: ['wisdom', 'intelligence'],
    ranger: ['archery', 'scouting'],
    druid: ['wisdom', 'magic_school'],
    demoniac: ['offense', 'sorcery'],
    heretic: ['sorcery', 'intelligence'],
    wizard: ['wisdom', 'intelligence', 'mysticism'],
    barbarian: ['offense', 'leadership', 'logistics']
  };

  // === СТАРТОВЫЕ ХАРАКТЕРИСТИКИ ПО КЛАССАМ ===
  public static CLASS_STATS: Record<string, { attack: number; defense: number; spellPower: number; knowledge: number }> = {
    knight:      { attack: 3, defense: 3, spellPower: 0, knowledge: 1 },
    cleric:      { attack: 1, defense: 2, spellPower: 2, knowledge: 2 },
    death_knight:{ attack: 3, defense: 2, spellPower: 1, knowledge: 1 },
    necromancer: { attack: 1, defense: 1, spellPower: 3, knowledge: 2 },
    ranger:      { attack: 2, defense: 2, spellPower: 1, knowledge: 2 },
    druid:       { attack: 1, defense: 1, spellPower: 2, knowledge: 3 },
    demoniac:    { attack: 4, defense: 2, spellPower: 1, knowledge: 0 },
    heretic:     { attack: 2, defense: 1, spellPower: 3, knowledge: 1 },
    wizard:      { attack: 0, defense: 0, spellPower: 3, knowledge: 4 },
    barbarian:   { attack: 4, defense: 3, spellPower: 0, knowledge: 0 }
  };

  constructor(seed: number = Date.now()) {
    this.random = new SeededRandom(seed);
  }

  /**
   * Загрузить навыки из JSON
   */
  public loadSkills(skillsData: any): void {
    if (skillsData?.skills) {
      for (const skill of skillsData.skills) {
        this.skills.set(skill.id, skill);
      }
    }
    console.log(`[SkillSystem] Loaded ${this.skills.size} skills`);
  }

  /**
   * Получить данные о навыке
   */
  public getSkill(id: string): SkillData | undefined {
    return this.skills.get(id);
  }

  /**
   * Получить все навыки
   */
  public getAllSkills(): SkillData[] {
    return Array.from(this.skills.values());
  }

  /**
   * Получить стартовые навыки для класса
   */
  public getStartingSkills(heroClass: string): HeroSkill[] {
    const skillIds = SkillSystem.STARTING_SKILLS[heroClass] || [];
    const result: HeroSkill[] = [];
    
    for (const id of skillIds) {
      const data = this.skills.get(id);
      if (data) {
        result.push({
          id: data.id,
          name: data.name,
          level: 1,
          category: data.category,
          effects: [{ type: data.effects[0].type, value: data.effects[0].value }]
        });
      }
    }
    
    return result;
  }

  /**
   * Получить стартовые характеристики для класса
   */
  public getStartingStats(heroClass: string): { attack: number; defense: number; spellPower: number; knowledge: number } {
    return SkillSystem.CLASS_STATS[heroClass] || { attack: 1, defense: 1, spellPower: 1, knowledge: 1 };
  }

  /**
   * Получить специализацию героя
   */
  public getSpecialization(heroClass: string): HeroSpecialization | undefined {
    return SkillSystem.SPECIALIZATIONS[heroClass];
  }

  /**
   * Предложить 2 навыка для выбора при повышении уровня
   */
  public proposeSkillChoices(hero: Hero): [SkillData, SkillData] {
    const allSkills = Array.from(this.skills.values());
    const heroSkillIds = hero.skills.map(s => s.id);
    
    // Фильтруем навыки, которые уже на максимальном уровне
    const available: SkillData[] = [];
    for (const skill of allSkills) {
      const heroSkill = hero.skills.find(s => s.id === skill.id);
      if (!heroSkill) {
        available.push(skill); // новый навык
      } else if (heroSkill.level < skill.maxLevel) {
        available.push(skill); // можно улучшить
      }
    }

    // Выбираем 2 случайных навыка
    const choices: SkillData[] = [];
    const pool = [...available];
    
    for (let i = 0; i < 2 && pool.length > 0; i++) {
      const idx = this.random.randomInt(0, pool.length - 1);
      choices.push(pool[idx]);
      pool.splice(idx, 1);
    }

    // Если мало навыков — дублируем
    while (choices.length < 2 && allSkills.length > 0) {
      const skill = allSkills[this.random.randomInt(0, allSkills.length - 1)];
      if (!choices.includes(skill)) {
        choices.push(skill);
      }
    }

    return [choices[0], choices[1]];
  }

  /**
   * Добавить или улучшить навык героя
   */
  public addSkill(hero: Hero, skillId: string): HeroSkill | null {
    const data = this.skills.get(skillId);
    if (!data) return null;

    const existing = hero.skills.find(s => s.id === skillId);
    
    if (existing) {
      // Улучшаем существующий
      if (existing.level >= data.maxLevel) return existing;
      existing.level++;
      const effectData = data.effects[existing.level - 1];
      if (effectData) {
        existing.effects = [{ type: effectData.type, value: effectData.value }];
      }
      return existing;
    } else {
      // Добавляем новый
      const effectData = data.effects[0];
      const newSkill: HeroSkill = {
        id: data.id,
        name: data.name,
        level: 1,
        category: data.category,
        effects: [{ type: effectData.type, value: effectData.value }]
      };
      hero.skills.push(newSkill);
      return newSkill;
    }
  }

  /**
   * Получить значение бонуса конкретного типа у героя
   */
  public getBonusValue(hero: Hero, effectType: string): number {
    for (const skill of hero.skills) {
      const effect = skill.effects.find(e => e.type === effectType);
      if (effect) return effect.value;
    }
    return 0;
  }

  /**
   * Расчитать все бонусы героя
   */
  public calculateAllBonuses(hero: Hero): Record<string, number> {
    const bonuses: Record<string, number> = {};
    
    for (const skill of hero.skills) {
      for (const effect of skill.effects) {
        bonuses[effect.type] = (bonuses[effect.type] || 0) + effect.value;
      }
    }

    return bonuses;
  }

  /**
   * Получить бонус урона ближнего боя (Наступление)
   */
  public getMeleeDamageBonus(hero: Hero): number {
    return this.getBonusValue(hero, 'melee_damage_bonus');
  }

  /**
   * Получить бонус урона стрелков (Стрельба)
   */
  public getRangedDamageBonus(hero: Hero): number {
    return this.getBonusValue(hero, 'ranged_damage_bonus');
  }

  /**
   * Получить снижение получаемого урона (Оборона)
   */
  public getDamageReduction(hero: Hero): number {
    return this.getBonusValue(hero, 'damage_reduction');
  }

  /**
   * Получить бонус морали (Лидерство)
   */
  public getMoraleBonus(hero: Hero): number {
    return this.getBonusValue(hero, 'morale_bonus');
  }

  /**
   * Получить бонус удачи
   */
  public getLuckBonus(hero: Hero): number {
    return this.getBonusValue(hero, 'luck_bonus');
  }

  /**
   * Получить бонус урона заклинаний (Колдовство)
   */
  public getSpellDamageBonus(hero: Hero): number {
    return this.getBonusValue(hero, 'spell_damage_bonus');
  }

  /**
   * Получить регенерацию маны за ход (Мистицизм)
   */
  public getManaRegenPerTurn(hero: Hero): number {
    return this.getBonusValue(hero, 'mana_regen_per_turn');
  }

  /**
   * Получить процент бонуса к максимальной мане (Интеллект)
   */
  public getManaBonusPercent(hero: Hero): number {
    return this.getBonusValue(hero, 'mana_bonus_percent');
  }

  /**
   * Получить бонус к очкам движения (Логистика)
   */
  public getMovementBonusPercent(hero: Hero): number {
    return this.getBonusValue(hero, 'movement_bonus_percent');
  }

  /**
   * Получить снижение штрафа местности (Следопыт)
   */
  public getTerrainPenaltyReduction(hero: Hero): number {
    return this.getBonusValue(hero, 'terrain_penalty_reduction');
  }

  /**
   * Получить бонус к радиусу обзора (Разведка)
   */
  public getVisionRadiusBonus(hero: Hero): number {
    return this.getBonusValue(hero, 'vision_radius_bonus');
  }

  /**
   * Получить ежедневный доход золота (Поместье)
   */
  public getDailyGoldIncome(hero: Hero): number {
    return this.getBonusValue(hero, 'daily_gold_income');
  }

  /**
   * Получить шанс присоединения нейтралов (Дипломатия)
   */
  public getDiplomacyChance(hero: Hero): number {
    return this.getBonusValue(hero, 'join_chance_percent');
  }

  /**
   * Получить максимальный доступный уровень заклинаний (Мудрость)
   */
  public getMaxSpellLevel(hero: Hero): number {
    return this.getBonusValue(hero, 'spell_level_access') || 2;
  }
}
