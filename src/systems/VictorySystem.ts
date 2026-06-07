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
}

export interface HeroState {
  id: string;
  hero: Hero;
  owner: OwnerType;
  alive: boolean;
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
  private victoryCondition: VictoryCondition;
  private defeatCondition: DefeatCondition;
  private day: number = 1;

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

  setDay(day: number): void {
    this.day = day;
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
    let playerGold = 0;

    for (const town of this.towns.values()) {
      if (town.owner === 'player') playerTowns++;
      else if (town.owner === 'ai') aiTowns++;
    }

    for (const hero of this.heroes.values()) {
      if (!hero.alive) continue;
      if (hero.owner === 'player') {
        playerHeroes++;
        // Gold is tracked externally, this is approximate
      }
      else if (hero.owner === 'ai') aiHeroes++;
    }

    return {
      playerTowns,
      playerHeroes,
      aiTowns,
      aiHeroes,
      playerGold,
      day: this.day
    };
  }

  getPlayerTowns(): TownOwnership[] {
    return [...this.towns.values()].filter(t => t.owner === 'player');
  }

  getAllTowns(): TownOwnership[] {
    return [...this.towns.values()];
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
}
