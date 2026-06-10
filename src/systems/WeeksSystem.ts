/**
 * WeeksSystem — система специальных недель (HoMM4 mechanics)
 * 
 * Реализует:
 * ✅ Генерацию случайных специальных недель
 * ✅ 15 типов эффектов недель
 * ✅ Применение эффектов к игре
 * ✅ Отслеживание истории недель
 */

import { SpecialWeek, SpecialWeekType, WeeksState } from '../types';
import { GameRandom } from '../utils/Random';

export class WeeksSystem {
  private state: WeeksState = {
    currentWeek: 1,
    currentDay: 1,
    specialWeek: this.generateNormalWeek(),
    weekHistory: []
  };

  // === КОНФИГУРАЦИЯ НЕДЕЛЬ ===
  private static readonly WEEK_TYPES: { type: SpecialWeekType; weight: number }[] = [
    { type: 'normal', weight: 40 },           // 40% обычная неделя
    { type: 'creature_growth', weight: 15 },  // 15% рост существ
    { type: 'mana_regen', weight: 8 },
    { type: 'movement_boost', weight: 8 },
    { type: 'gold_abundance', weight: 8 },
    { type: 'lucky_week', weight: 6 },
    { type: 'morale_boost', weight: 6 },
    { type: 'spell_power', weight: 5 },
    { type: 'defense_week', weight: 4 },
    { type: 'attack_week', weight: 4 },
    { type: 'creature_tier_up', weight: 3 },
    { type: 'necromancy_boost', weight: 2 },
    { type: 'dimension_door', weight: 2 },
    { type: 'free_hire', weight: 2 },
    { type: 'experience_boost', weight: 2 }
  ];

  private static readonly WEEK_NAMES: Record<SpecialWeekType, string> = {
    normal: 'Обычная неделя',
    creature_growth: 'Неделя роста',
    mana_regen: 'Неделя маны',
    movement_boost: 'Неделя странствий',
    gold_abundance: 'Неделя изобилия',
    lucky_week: 'Неделя удачи',
    morale_boost: 'Неделя вдохновения',
    spell_power: 'Неделя магов',
    defense_week: 'Неделя защиты',
    attack_week: 'Неделя воинов',
    creature_tier_up: 'Неделя существ',
    necromancy_boost: 'Неделя мёртвых',
    dimension_door: 'Неделя порталов',
    free_hire: 'Неделя найма',
    experience_boost: 'Неделя знаний'
  };

  private static readonly WEEK_DESCRIPTIONS: Record<SpecialWeekType, string> = {
    normal: 'Никаких особых эффектов',
    creature_growth: 'Прирост существ увеличен на {value}%',
    mana_regen: 'Восстановление маны +{value} за ход',
    movement_boost: 'Очки движения +{value}%',
    gold_abundance: 'Доход золота +{value}%',
    lucky_week: 'Удача всех существ +{value}',
    morale_boost: 'Мораль всех существ +{value}',
    spell_power: 'Сила заклинаний +{value}',
    defense_week: 'Защита героев +{value}',
    attack_week: 'Атака героев +{value}',
    creature_tier_up: 'Прирост {creature} увеличен',
    necromancy_boost: 'Некромантия эффективнее на {value}%',
    dimension_door: 'Dimension Door бесплатно',
    free_hire: 'Найм существ со скидкой {value}%',
    experience_boost: 'Получено опыта +{value}%'
  };

  constructor(seed: number = Date.now()) {
    GameRandom.setSeed(seed);
  }

  // ═══════════════════════════════════════════════════════════════
  // ГЕНЕРАЦИЯ НЕДЕЛИ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Сгенерировать новую случайную неделю
   */
  public generateNextWeek(): SpecialWeek {
    const weekType = this.selectRandomWeekType();
    return this.createWeek(weekType);
  }

  /**
   * Выбрать тип недели с учётом весов
   */
  private selectRandomWeekType(): SpecialWeekType {
    const totalWeight = WeeksSystem.WEEK_TYPES.reduce((sum, w) => sum + w.weight, 0);
    let roll = GameRandom.randomInt(1, totalWeight);
    
    for (const weekType of WeeksSystem.WEEK_TYPES) {
      roll -= weekType.weight;
      if (roll <= 0) {
        return weekType.type;
      }
    }
    
    return 'normal';
  }

  /**
   * Создать неделю с заданным типом
   */
  private createWeek(type: SpecialWeekType): SpecialWeek {
    const value = this.generateWeekValue(type);
    
    return {
      type,
      name: WeeksSystem.WEEK_NAMES[type],
      description: this.formatDescription(type, value),
      value,
      ...(type === 'creature_tier_up' ? this.generateCreatureTierWeek() : {})
    };
  }

  /**
   * Сгенерировать значение эффекта для типа недели
   */
  private generateWeekValue(type: SpecialWeekType): number {
    switch (type) {
      case 'creature_growth':
        return GameRandom.randomInt(10, 30); // 10-30%
      case 'mana_regen':
        return GameRandom.randomInt(1, 3); // 1-3 маны
      case 'movement_boost':
        return GameRandom.randomInt(10, 25); // 10-25%
      case 'gold_abundance':
        return GameRandom.randomInt(10, 25); // 10-25%
      case 'lucky_week':
        return GameRandom.randomInt(1, 3); // +1-3 к удаче
      case 'morale_boost':
        return GameRandom.randomInt(1, 3); // +1-3 к морали
      case 'spell_power':
        return GameRandom.randomInt(1, 2); // +1-2
      case 'defense_week':
      case 'attack_week':
        return GameRandom.randomInt(1, 2); // +1-2
      case 'creature_tier_up':
        return 100; // 100% прирост (double growth)
      case 'necromancy_boost':
        return GameRandom.randomInt(10, 20); // 10-20%
      case 'dimension_door':
        return 0; // бесплатно
      case 'free_hire':
        return GameRandom.randomInt(20, 50); // 20-50% скидка
      case 'experience_boost':
        return GameRandom.randomInt(25, 50); // 25-50%
      default:
        return 0;
    }
  }

  /**
   * Сформировать описание эффекта
   */
  private formatDescription(type: SpecialWeekType, value: number): string {
    let desc = WeeksSystem.WEEK_DESCRIPTIONS[type];
    
    if (value > 0) {
      desc = desc.replace('{value}', value.toString());
    }
    
    if (type === 'creature_tier_up' && (desc as any).includes('{creature}')) {
      // Будет заполнено в generateCreatureTierWeek
    }
    
    return desc;
  }

  /**
   * Сгенерировать параметры для недели существ
   */
  private generateCreatureTierWeek(): { creatureId: string; faction: string; value: number } {
    const tiers = [1, 2, 3, 4, 5, 6, 7];
    const tier = tiers[GameRandom.randomInt(0, tiers.length - 1)];
    
    const factions = ['castle', 'rampart', 'tower', 'inferno', 'necropolis', 'dungeon', 'stronghold', 'fortress', 'conflux'];
    const faction = factions[GameRandom.randomInt(0, factions.length - 1)];
    
    // Генерируем ID существа (пример)
    const creatureId = `${faction}_tier${tier}`;
    
    return {
      creatureId,
      faction,
      value: 100 // Double growth
    };
  }

  /**
   * Создать обычную неделю (без эффектов)
   */
  private generateNormalWeek(): SpecialWeek {
    return {
      type: 'normal',
      name: WeeksSystem.WEEK_NAMES['normal'],
      description: WeeksSystem.WEEK_DESCRIPTIONS['normal'],
      value: 0
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // УПРАВЛЕНИЕ СОСТОЯНИЕМ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Получить текущее состояние недель
   */
  public getState(): WeeksState {
    return { ...this.state };
  }

  /**
   * Установить состояние недель
   */
  public setState(state: WeeksState): void {
    this.state = { ...state };
  }

  /**
   * Перейти к следующему дню
   * @returns true если неделя сменилась
   */
  public nextDay(): boolean {
    this.state.currentDay++;
    
    if (this.state.currentDay > 7) {
      // Неделя закончилась
      this.state.currentDay = 1;
      this.state.currentWeek++;
      
      // Сохраняем старую неделю в историю
      this.state.weekHistory.push(this.state.specialWeek);
      if (this.state.weekHistory.length > 7) {
        this.state.weekHistory.shift();
      }
      
      // Генерируем новую неделю
      this.state.specialWeek = this.generateNextWeek();
      
      return true; // Неделя сменилась
    }
    
    return false; // Неделя не сменилась
  }

  /**
   * Пропустить неделю (быстрый переход)
   */
  public skipWeek(): void {
    this.nextDay(); // Перейти к следующему дню (сменит неделю)
    for (let i = 0; i < 6; i++) {
      this.nextDay(); // Пропустить остальные 6 дней
    }
  }

  /**
   * Получить информацию о текущей неделе
   */
  public getCurrentWeekInfo(): string {
    const { currentWeek, currentDay, specialWeek } = this.state;
    return `Неделя ${currentWeek}, День ${currentDay}\n${specialWeek.name}\n${specialWeek.description}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // ПРИМЕНЕНИЕ ЭФФЕКТОВ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Получить модификатор прироста существ
   */
  public getCreatureGrowthMultiplier(creatureId: string): number {
    const { specialWeek } = this.state;
    
    // Общая неделя роста
    if (specialWeek.type === 'creature_growth') {
      return 1 + specialWeek.value / 100;
    }
    
    // Конкретное существо
    if (specialWeek.type === 'creature_tier_up' && specialWeek.creatureId === creatureId) {
      return 1 + specialWeek.value / 100; // 2.0 = double growth
    }
    
    return 1;
  }

  /**
   * Получить модификатор восстановления маны
   */
  public getManaRegenBonus(): number {
    if (this.state.specialWeek.type === 'mana_regen') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить модификатор очков движения
   */
  public getMovementBonusPercent(): number {
    if (this.state.specialWeek.type === 'movement_boost') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить модификатор дохода золота
   */
  public getGoldIncomeBonusPercent(): number {
    if (this.state.specialWeek.type === 'gold_abundance') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к удаче
   */
  public getLuckBonus(): number {
    if (this.state.specialWeek.type === 'lucky_week') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к морали
   */
  public getMoraleBonus(): number {
    if (this.state.specialWeek.type === 'morale_boost') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к силе заклинаний
   */
  public getSpellPowerBonus(): number {
    if (this.state.specialWeek.type === 'spell_power') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к защите
   */
  public getDefenseBonus(): number {
    if (this.state.specialWeek.type === 'defense_week') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к атаке
   */
  public getAttackBonus(): number {
    if (this.state.specialWeek.type === 'attack_week') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к некромантии
   */
  public getNecromancyBonusPercent(): number {
    if (this.state.specialWeek.type === 'necromancy_boost') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Проверить бесплатен ли Dimension Door
   */
  public isDimensionDoorFree(): boolean {
    return this.state.specialWeek.type === 'dimension_door';
  }

  /**
   * Получить процент скидки на найм
   */
  public getHireDiscountPercent(): number {
    if (this.state.specialWeek.type === 'free_hire') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  /**
   * Получить бонус к опыту
   */
  public getExperienceBonusPercent(): number {
    if (this.state.specialWeek.type === 'experience_boost') {
      return this.state.specialWeek.value;
    }
    return 0;
  }

  // ═══════════════════════════════════════════════════════════════
  // ИНИЦИАЛИЗАЦИЯ
  // ═══════════════════════════════════════════════════════════════

  /**
   * Инициализировать систему с первой неделей
   */
  public initialize(seed: number = Date.now()): void {
    GameRandom.setSeed(seed);
    this.state = {
      currentWeek: 1,
      currentDay: 1,
      specialWeek: this.generateNextWeek(),
      weekHistory: []
    };
  }
}