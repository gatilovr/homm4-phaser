/**
 * AI System - Искусственный интеллект противников на карте
 * 
 * ИИ противник:
 * - Строит здания в городе
 * - Нанимает существ
 * - Исследует карту
 * - Атакует слабых врагов
 * - Захватывает шахты
 * - Передаёт армию из гарнизона
 */

import { CONFIG } from '../config';
import type { Hero, MapObject, Resources, Tile } from '../types';
import { Pathfinder } from '../utils/Pathfinder';
import { EventBus } from '../utils/EventBus';

export interface AIPlayer {
  id: string;
  name: string;
  color: number;
  hero: Hero;
  town: Town;
  resources: Resources;
  isActive: boolean;
  turnsPlayed: number;
}

export interface AIDecision {
  type: 'move' | 'attack' | 'build' | 'hire' | 'capture' | 'explore';
  target?: { x: number; y: number };
  priority: number;
  description: string;
}

export class AISystem {
  private aiPlayers: AIPlayer[] = [];
  private map: Tile[][];
  private objects: MapObject[];
  private pathfinder: Pathfinder;
  
  // Приоритеты действий
  private readonly PRIORITIES = {
    ATTACK_WEAK_ENEMY: 100,
    CAPTURE_MINE: 80,
    COLLECT_ARTIFACT: 70,
    BUILD_BUILDING: 60,
    HIRE_CREATURES: 55,
    EXPLORE: 40,
    DEFEND_TOWN: 30
  };

  constructor(map: MapTile[][], objects: MapObject[]) {
    this.map = map;
    this.objects = objects;
    this.pathfinder = new Pathfinder(map);
  }

  /**
   * Инициализация ИИ противников
   */
  public initAIPlayers(towns: any[], startHeroes: Hero[]): void {
    // Создаём 1-2 ИИ противника с фиктивными данными
    const aiColors = [0xff0000, 0x00ff00]; // Красный, Зелёный
    const names = ['Красный Маг', 'Зелёный Рыцарь'];
    
    for (let i = 0; i < Math.min(2, towns.length || 2); i++) {
      const hero = startHeroes[i] || this.createDefaultAIHero(i, names[i]);
      
      const aiPlayer: AIPlayer = {
        id: `ai_${i}`,
        name: names[i],
        color: aiColors[i],
        hero: hero,
        town: {} as any, // Упрощённо
        resources: {
          gold: 10000,
          wood: 50,
          ore: 50,
          crystal: 20,
          gems: 20,
          sulfur: 10,
          mercury: 10
        },
        isActive: true,
        turnsPlayed: 0
      };

      this.aiPlayers.push(aiPlayer);
    }

    console.log(`[AI] Инициализировано ${this.aiPlayers.length} противников`);
  }

  /**
   * Создать ИИ героя по умолчанию
   */
  private createDefaultAIHero(index: number, name: string): Hero {
    return {
      id: `ai_hero_${index}`,
      name: name,
      class: 'Маг',
      faction: 'necropolis',
      level: 1,
      experience: 0,
      stats: { attack: 2, defense: 2, spellPower: 2, knowledge: 2, morale: 0, luck: 0 },
      skills: [],
      mana: 20,
      maxMana: 20,
      army: [
        { creatureId: 'skeleton', count: 30 },
        { creatureId: 'zombie', count: 20 }
      ],
      equipment: {},
      spells: [],
      x: 5 + index * 10,
      y: 5 + index * 10,
      movementPoints: 100
    };
  }

  /**
   * Ход всех ИИ противников
   */
  public executeTurn(): void {
    for (const ai of this.aiPlayers) {
      if (!ai.isActive) continue;

      console.log(`[AI] Ход ${ai.name}`);
      
      // 1. Экономическая фаза (стройка + найм)
      this.economicPhase(ai);
      
      // 2. Фаза действий на карте
      this.actionPhase(ai);
      
      ai.turnsPlayed++;
    }

    EventBus.emit('ai:turn-complete');
  }

  /**
   * Экономическая фаза: строительство и найм
   */
  private economicPhase(ai: AIPlayer): void {
    // Пока упрощённо — просто логируем
    console.log(`[AI] ${ai.name}: экономическая фаза (заглушка)`);
    
    // В будущем здесь будет:
    // - Постройка зданий в городе
    // - Найм существ
    // - Передача армии из гарнизона герою
  }

  /**
   * Решение о строительстве (заглушка)
   */
  private decideBuilding(ai: AIPlayer): string | null {
    // TODO: Реализовать полноценную систему строительства
    return null;
  }

  /**
   * Построить здание (заглушка)
   */
  private executeBuild(ai: AIPlayer, buildingId: string): void {
    // TODO: Реализовать
    console.log(`[AI] ${ai.name} строит ${buildingId}`);
  }

  /**
   * Решение о найме существ (заглушка)
   */
  private decideHiring(ai: AIPlayer): { creatureId: string; count: number } | null {
    // TODO: Реализовать полноценную систему найма
    return null;
  }

  /**
   * Нанять существ (заглушка)
   */
  private executeHire(ai: AIPlayer, decision: { creatureId: string; count: number }): void {
    // TODO: Реализовать
    console.log(`[AI] ${ai.name} нанимает ${decision.count} ${decision.creatureId}`);
  }

  /**
   * Передать армию из гарнизона герою (заглушка)
   */
  private transferGarrisonToHero(ai: AIPlayer): void {
    // TODO: Реализовать
  }

  /**
   * Фаза действий на карте
   */
  private actionPhase(ai: AIPlayer): void {
    const hero = ai.hero;
    const decisions = this.generateDecisions(ai);

    if (decisions.length === 0) {
      console.log(`[AI] ${ai.name} не нашёл действий`);
      return;
    }

    // Сортируем по приоритету
    decisions.sort((a, b) => b.priority - a.priority);

    // Выполняем лучшее действие
    const bestDecision = decisions[0];
    console.log(`[AI] ${ai.name}: ${bestDecision.description}`);

    this.executeDecision(ai, bestDecision);
  }

  /**
   * Генерация возможных действий
   */
  private generateDecisions(ai: AIPlayer): AIDecision[] {
    const decisions: AIDecision[] = [];
    const hero = ai.hero;

    // 1. Поиск врагов для атаки
    const enemyHeroes = this.findEnemyHeroes(hero);
    for (const enemy of enemyHeroes) {
      const distance = Math.abs(enemy.x - hero.x) + Math.abs(enemy.y - hero.y);
      if (distance <= 10) {
        // Оцениваем силу врага
        const enemyPower = this.calculateArmyPower(enemy.army);
        const myPower = this.calculateArmyPower(hero.army);
        
        if (myPower > enemyPower * 1.2) {
          decisions.push({
            type: 'attack',
            target: { x: enemy.x, y: enemy.y },
            priority: this.PRIORITIES.ATTACK_WEAK_ENEMY,
            description: `Атаковать слабого врага на (${enemy.x}, ${enemy.y})`
          });
        }
      }
    }

    // 2. Поиск шахт для захвата
    const mines = this.objects.filter(obj => 
      obj.type === 'mine' && obj.owner !== ai.id
    );
    
    for (const mine of mines) {
      const distance = Math.abs(mine.x - hero.x) + Math.abs(mine.y - hero.y);
      if (distance <= 15) {
        decisions.push({
          type: 'capture',
          target: { x: mine.x, y: mine.y },
          priority: this.PRIORITIES.CAPTURE_MINE - distance,
          description: `Захватить шахту на (${mine.x}, ${mine.y})`
        });
      }
    }

    // 3. Поиск артефактов
    const artifacts = this.objects.filter(obj => obj.type === 'artifact');
    
    for (const artifact of artifacts) {
      const distance = Math.abs(artifact.x - hero.x) + Math.abs(artifact.y - hero.y);
      if (distance <= 12) {
        decisions.push({
          type: 'move',
          target: { x: artifact.x, y: artifact.y },
          priority: this.PRIORITIES.COLLECT_ARTIFACT - distance,
          description: `Подобрать артефакт на (${artifact.x}, ${artifact.y})`
        });
      }
    }

    // 4. Исследование (если нет других целей)
    if (decisions.length === 0) {
      const exploreTarget = this.findExploreTarget(hero);
      if (exploreTarget) {
        decisions.push({
          type: 'explore',
          target: exploreTarget,
          priority: this.PRIORITIES.EXPLORE,
          description: `Исследовать территорию на (${exploreTarget.x}, ${exploreTarget.y})`
        });
      }
    }

    return decisions;
  }

  /**
   * Выполнение решения
   */
  private executeDecision(ai: AIPlayer, decision: AIDecision): void {
    if (!decision.target) return;

    const hero = ai.hero;
    const path = this.pathfinder.findPath(
      { x: hero.x, y: hero.y }, 
      { x: decision.target.x, y: decision.target.y }
    );

    if (path.length === 0) {
      console.log(`[AI] Путь не найден к (${decision.target.x}, ${decision.target.y})`);
      return;
    }

    // Двигаемся по пути (максимум 5 клеток за ход)
    const maxSteps = Math.min(5, path.length);
    const stepsTaken = Math.min(maxSteps, Math.floor(hero.movementPoints / 10));

    if (stepsTaken > 0) {
      const destination = path[stepsTaken - 1];
      hero.x = destination.x;
      hero.y = destination.y;
      hero.movementPoints -= stepsTaken * 10;

      console.log(`[AI] ${ai.name} переместился на (${hero.x}, ${hero.y})`);
      EventBus.emit('ai:hero-moved', { 
        aiId: ai.id, 
        x: hero.x, 
        y: hero.y 
      });
    }
  }

  /**
   * Поиск вражеских героев
   */
  private findEnemyHeroes(myHero: Hero): Hero[] {
    // В реальном проекте здесь должен быть доступ к списку всех героев
    // Пока возвращаем пустой массив
    return [];
  }

  /**
   * Расчёт силы армии
   */
  private calculateArmyPower(army: Array<{ creatureId: string; count: number }>): number {
    let power = 0;
    
    for (const unit of army) {
      const creature = this.getCreatureData(unit.creatureId);
      if (creature) {
        power += (creature.attack + creature.defense) * unit.count;
      }
    }

    return power;
  }

  /**
   * Поиск цели для исследования
   */
  private findExploreTarget(hero: Hero): { x: number; y: number } | null {
    // Ищем неисследованную территорию
    const radius = 10;
    
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const x = hero.x + dx;
        const y = hero.y + dy;

        if (x < 0 || x >= this.map[0].length) continue;
        if (y < 0 || y >= this.map.length) continue;

        const tile = this.map[y][x];
        if (!tile.revealed && tile.type !== 'water') {
          return { x, y };
        }
      }
    }

    return null;
  }

  /**
   * Получить данные о здании (заглушка)
   */
  private getBuildingData(buildingId: string): any {
    // TODO: Загружать из buildings.json
    return null;
  }

  /**
   * Получить данные о существе (заглушка)
   */
  private getCreatureData(creatureId: string): any {
    // TODO: Загружать из creatures.json
    const creatures: Record<string, any> = {
      pikeman: { name: 'Ополченец', cost: 60, attack: 4, defense: 5 },
      archer: { name: 'Лучник', cost: 100, attack: 6, defense: 3 },
      griffin: { name: 'Грифон', cost: 200, attack: 8, defense: 8 },
      skeleton: { name: 'Скелет', cost: 50, attack: 4, defense: 3 },
      zombie: { name: 'Зомби', cost: 70, attack: 5, defense: 4 }
    };
    return creatures[creatureId];
  }

  /**
   * Проверка возможности покупки
   */
  private canAfford(resources: Resources, cost: Partial<Resources>): boolean {
    if (cost.gold && resources.gold < cost.gold) return false;
    if (cost.wood && resources.wood < cost.wood) return false;
    if (cost.ore && resources.ore < cost.ore) return false;
    if (cost.crystal && resources.crystal < cost.crystal) return false;
    if (cost.gems && resources.gems < cost.gems) return false;
    if (cost.sulfur && resources.sulfur < cost.sulfur) return false;
    if (cost.mercury && resources.mercury < cost.mercury) return false;
    return true;
  }

  /**
   * Потратить ресурсы
   */
  private spendResources(resources: Resources, cost: Partial<Resources>): void {
    if (cost.gold) resources.gold -= cost.gold;
    if (cost.wood) resources.wood -= cost.wood;
    if (cost.ore) resources.ore -= cost.ore;
    if (cost.crystal) resources.crystal -= cost.crystal;
    if (cost.gems) resources.gems -= cost.gems;
    if (cost.sulfur) resources.sulfur -= cost.sulfur;
    if (cost.mercury) resources.mercury -= cost.mercury;
  }

  /**
   * Получить всех ИИ игроков
   */
  public getAIPlayers(): AIPlayer[] {
    return this.aiPlayers;
  }

  /**
   * Получить ИИ по ID
   */
  public getAIPlayer(id: string): AIPlayer | undefined {
    return this.aiPlayers.find(ai => ai.id === id);
  }
}
