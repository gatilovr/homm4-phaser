import { Resources, Hero, ArmySlot } from '../types';

// ============================================================================
// СИСТЕМА ВЛАДЕНИЯ ГОРОДАМИ И УСЛОВИЙ ПОБЕДЫ/ПОРАЖЕНИЯ
// ============================================================================

export type OwnerType = 'player' | 'ai' | 'neutral';

export interface TownOwnership {
  id: string;
  name: string;
  faction: string;
  x: number;
  y: number;
  owner: OwnerType;
  /** Текущие построенные здания */
  builtBuildings: string[];
  /** Гарнизон города */
  garrison: ArmySlot[];
  /** Существ, доступные для найма (прирост за неделю) */
  availableForHire: ArmySlot[];
  /** Последний день, когда был получен прирост */
  lastGrowthDay: number;
}

export interface MineOwnership {
  id: string;
  x: number;
  y: number;
  owner: OwnerType;
  resourceType: keyof Resources;
  dailyIncome: number;
  /** Название шахты (Лесопилка, Рудник и т.д.) */
  mineName?: string;
  /** Иконка шахты */
  icon?: string;
}

export interface HeroState {
  id: string;
  hero: Hero;
  owner: OwnerType;
  alive: boolean;
  captured: boolean;
  x: number;
  y: number;
}

export type VictoryCondition = 
  | { type: 'defeat_all_enemies' }
  | { type: 'capture_all_towns' }
  | { type: 'accumulate_gold'; amount: number };

export type DefeatCondition = 
  | { type: 'lose_all_heroes_and_towns' }
  | { type: 'lose_all_towns' }
  | { type: 'day_limit'; days: number };

export interface VictoryCheckResult {
  gameOver: boolean;
  result: 'victory' | 'defeat' | 'continue';
  reason: string;
  stats: {
    playerTowns: number;
    playerHeroes: number;
    aiTowns: number;
    aiHeroes: number;
    playerGold: number;
    day: number;
  };
}

export class VictorySystem {
  private towns: Map<string, TownOwnership> = new Map();
  private mines: Map<string, MineOwnership> = new Map();
  private heroes: Map<string, HeroState> = new Map();
  private day: number = 1;
  private victoryCondition: VictoryCondition;
  private defeatCondition: DefeatCondition;
  private currentGold: number = 0;

  constructor(
    victory: VictoryCondition = { type: 'defeat_all_enemies' },
    defeat: DefeatCondition = { type: 'lose_all_heroes_and_towns' }
  ) {
    this.victoryCondition = victory;
    this.defeatCondition = defeat;
  }

  // === РЕГИСТРАЦИЯ ===

  registerTown(town: TownOwnership): void {
    this.towns.set(town.id, town);
  }

  registerMine(mine: MineOwnership): void {
    this.mines.set(mine.id, mine);
  }

  registerHero(heroState: HeroState): void {
    this.heroes.set(heroState.id, heroState);
  }

  // === ИЗМЕНЕНИЕ ВЛАДЕНИЯ ===

  captureTown(townId: string, newOwner: OwnerType): { captured: boolean; reason: string } {
    const town = this.towns.get(townId);
    if (!town) return { captured: false, reason: 'Город не найден' };
    if (town.owner === newOwner) return { captured: false, reason: 'Уже ваш город' };
    
    const oldOwner = town.owner;
    town.owner = newOwner;
    
    return { 
      captured: true, 
      reason: `${town.name} захвачен! (${oldOwner} → ${newOwner})` 
    };
  }

  captureMine(mineId: string, newOwner: OwnerType): boolean {
    const mine = this.mines.get(mineId);
    if (!mine) return false;
    mine.owner = newOwner;
    return true;
  }

  killHero(heroId: string): void {
    const hero = this.heroes.get(heroId);
    if (hero) hero.alive = false;
  }

  captureHeroById(heroId: string): void {
    const hero = this.heroes.get(heroId);
    if (hero) {
      hero.captured = true;
      hero.alive = false;
    }
  }

  releaseHero(heroId: string): void {
    const hero = this.heroes.get(heroId);
    if (hero) {
      hero.captured = false;
      hero.alive = true;
    }
  }

  setDay(day: number): void {
    this.day = day;
  }

  /**
   * Установить текущее количество золота игрока (для проверки условий победы)
   */
  setGold(gold: number): void {
    this.currentGold = gold;
  }

  // === ПРОВЕРКА УСЛОВИЙ ===

  checkVictory(): VictoryCheckResult {
    const stats = this.getStats();
    
    // Проверяем поражение
    const defeatResult = this.checkDefeat(stats);
    if (defeatResult) return defeatResult;
    
    // Проверяем победу
    const victoryResult = this.checkVictoryCondition(stats);
    if (victoryResult) return victoryResult;
    
    return {
      gameOver: false,
      result: 'continue',
      reason: '',
      stats
    };
  }

  private checkDefeat(stats: VictoryCheckResult['stats']): VictoryCheckResult | null {
    switch (this.defeatCondition.type) {
      case 'lose_all_heroes_and_towns':
        if (stats.playerHeroes === 0 && stats.playerTowns === 0) {
          return {
            gameOver: true,
            result: 'defeat',
            reason: 'Вы потеряли всех героев и все города!',
            stats
          };
        }
        break;
      case 'lose_all_towns':
        if (stats.playerTowns === 0) {
          return {
            gameOver: true,
            result: 'defeat',
            reason: 'Все ваши города захвачены врагом!',
            stats
          };
        }
        break;
      case 'day_limit':
        if (stats.day >= this.defeatCondition.days) {
          return {
            gameOver: true,
            result: 'defeat',
            reason: `Время вышло! (${this.defeatCondition.days} дней)`,
            stats
          };
        }
        break;
    }
    return null;
  }

  private checkVictoryCondition(stats: VictoryCheckResult['stats']): VictoryCheckResult | null {
    switch (this.victoryCondition.type) {
      case 'defeat_all_enemies':
        if (stats.aiHeroes === 0 && stats.aiTowns === 0) {
          return {
            gameOver: true,
            result: 'victory',
            reason: 'Все враги уничтожены! Полная победа!',
            stats
          };
        }
        break;
      case 'capture_all_towns':
        if (stats.aiTowns === 0 && stats.playerTowns > 0) {
          return {
            gameOver: true,
            result: 'victory',
            reason: 'Все города под вашим контролем!',
            stats
          };
        }
        break;
      case 'accumulate_gold':
        if (stats.playerGold >= this.victoryCondition.amount) {
          return {
            gameOver: true,
            result: 'victory',
            reason: `Накоплено ${stats.playerGold} золота! Экономическая победа!`,
            stats
          };
        }
        break;
    }
    return null;
  }

  // === СТАТИСТИКА ===

  getStats(): VictoryCheckResult['stats'] {
    let playerTowns = 0, aiTowns = 0;
    let playerHeroes = 0, aiHeroes = 0;

    for (const town of this.towns.values()) {
      if (town.owner === 'player') playerTowns++;
      else if (town.owner === 'ai') aiTowns++;
    }

    for (const hero of this.heroes.values()) {
      if (!hero.alive || hero.captured) continue;
      if (hero.owner === 'player') {
        playerHeroes++;
      }
      else if (hero.owner === 'ai') aiHeroes++;
    }

    return {
      playerTowns,
      playerHeroes,
      aiTowns,
      aiHeroes,
      playerGold: this.currentGold,
      day: this.day
    };
  }

  getPlayerTowns(): TownOwnership[] {
    return [...this.towns.values()].filter(t => t.owner === 'player');
  }

  getAllTowns(): TownOwnership[] {
    return [...this.towns.values()];
  }

  getAllMinesList(): MineOwnership[] {
    return [...this.mines.values()];
  }

  getAllHeroes(): HeroState[] {
    return [...this.heroes.values()];
  }

  updateHero(id: string, patch: Partial<HeroState>): boolean {
    const hero = this.heroes.get(id);
    if (!hero) return false;
    Object.assign(hero, patch);
    return true;
  }

  getAITowns(): TownOwnership[] {
    return [...this.towns.values()].filter(t => t.owner === 'ai');
  }

  getTown(id: string): TownOwnership | undefined {
    return this.towns.get(id);
  }

  getPlayerMines(): MineOwnership[] {
    return [...this.mines.values()].filter(m => m.owner === 'player');
  }

  /**
   * Получить шахту по ID (для SaveSystem)
   */
  getMine(id: string): MineOwnership | undefined {
    return this.mines.get(id);
  }

  /**
   * Обновить состояние города из внешних данных (для SaveSystem)
   */
  updateTown(id: string, patch: Partial<TownOwnership>): boolean {
    const town = this.towns.get(id);
    if (!town) return false;
    Object.assign(town, patch);
    return true;
  }

  /**
   * Обновить состояние шахты из внешних данных (для SaveSystem)
   */
  updateMine(id: string, patch: Partial<MineOwnership>): boolean {
    const mine = this.mines.get(id);
    if (!mine) return false;
    Object.assign(mine, patch);
    return true;
  }

  // === ДОХОД ===

  getDailyIncome(): Partial<Resources> {
    const income: any = {};
    for (const mine of this.mines.values()) {
      if (mine.owner === 'player') {
        income[mine.resourceType] = (income[mine.resourceType] || 0) + mine.dailyIncome;
      }
    }
    return income;
  }

  /**
   * Получить все шахты (для ИИ)
   */
  getAllMines(): MineOwnership[] {
    return [...this.mines.values()];
  }

  /**
   * Получить все города (для ИИ)
   */
  getAllTownsList(): TownOwnership[] {
    return [...this.towns.values()];
  }

  /**
   * Получить героя по ID (для ИИ)
   */
  getHeroState(heroId: string): HeroState | undefined {
    return this.heroes.get(heroId);
  }

  /**
   * Обновить позицию героя
   */
  updateHeroPosition(heroId: string, x: number, y: number): void {
    const hero = this.heroes.get(heroId);
    if (hero) {
      hero.x = x;
      hero.y = y;
    }
  }
}
