/**
 * ContentManager — единая система управления контентом игры
 * Загружает и кэширует все данные из JSON файлов
 */

import type { Creature, Building, Artifact, Spell, Faction, CreatureStats, Hero } from '../types';

interface CreaturesData {
  creatures: Creature[];
}

interface BuildingsData {
  buildings: Building[];
}

interface ArtifactsData {
  artifacts: Artifact[];
}

interface SpellsData {
  spells: Spell[];
}

interface FactionsData {
  factions: Faction[];
}

export class ContentManager {
  private static instance: ContentManager | null = null;

  private creatures: Map<string, Creature> = new Map();
  private buildings: Map<string, Building> = new Map();
  private artifacts: Map<string, Artifact> = new Map();
  private spells: Map<string, Spell> = new Map();
  private factions: Map<string, Faction> = new Map();

  private creaturesByFaction: Map<string, Creature[]> = new Map();
  private buildingsByFaction: Map<string, Building[]> = new Map();

  private loaded = false;

  private constructor() {}

  public static getInstance(): ContentManager {
    if (!ContentManager.instance) {
      ContentManager.instance = new ContentManager();
    }
    return ContentManager.instance;
  }

  /**
   * Загрузить все JSON данные
   */
  public async loadAll(): Promise<void> {
    if (this.loaded) return;

    try {
      await Promise.all([
        this.loadCreatures(),
        this.loadBuildings(),
        this.loadArtifacts(),
        this.loadSpells(),
        this.loadFactions()
      ]);

      this.indexData();
      this.loaded = true;
      console.log('✅ ContentManager: все данные загружены');
      console.log(`   - Существ: ${this.creatures.size}`);
      console.log(`   - Зданий: ${this.buildings.size}`);
      console.log(`   - Артефактов: ${this.artifacts.size}`);
      console.log(`   - Заклинаний: ${this.spells.size}`);
      console.log(`   - Фракций: ${this.factions.size}`);
    } catch (error) {
      console.error('❌ Ошибка загрузки контента:', error);
      throw error;
    }
  }

  private async loadCreatures(): Promise<void> {
    try {
      const response = await fetch('./assets/data/creatures.json');
      const data: CreaturesData = await response.json();
      data.creatures.forEach(c => this.creatures.set(c.id, c));
    } catch (error) {
      console.warn('⚠️ creatures.json не загружен, использую встроенные данные');
      this.loadFallbackCreatures();
    }
  }

  private async loadBuildings(): Promise<void> {
    try {
      const response = await fetch('./assets/data/buildings.json');
      const data: BuildingsData = await response.json();
      data.buildings.forEach(b => this.buildings.set(b.id, b));
    } catch (error) {
      console.warn('⚠️ buildings.json не загружен, использую встроенные данные');
      this.loadFallbackBuildings();
    }
  }

  private async loadArtifacts(): Promise<void> {
    try {
      const response = await fetch('./assets/data/artifacts.json');
      const data: ArtifactsData = await response.json();
      data.artifacts.forEach(a => this.artifacts.set(a.id, a));
    } catch (error) {
      console.warn('⚠️ artifacts.json не загружен, использую встроенные данные');
      this.loadFallbackArtifacts();
    }
  }

  private async loadSpells(): Promise<void> {
    try {
      const response = await fetch('./assets/data/spells.json');
      const data: SpellsData = await response.json();
      data.spells.forEach(s => this.spells.set(s.id, s));
    } catch (error) {
      console.warn('⚠️ spells.json не загружен, использую встроенные данные');
      this.loadFallbackSpells();
    }
  }

  private async loadFactions(): Promise<void> {
    try {
      const response = await fetch('./assets/data/factions.json');
      const data: FactionsData = await response.json();
      data.factions.forEach(f => this.factions.set(f.id, f));
    } catch (error) {
      console.warn('⚠️ factions.json не загружен, использую встроенные данные');
      this.loadFallbackFactions();
    }
  }

  /**
   * Индексировать данные для быстрого доступа
   */
  private indexData(): void {
    // Группируем существ по фракциям
    this.creatures.forEach(creature => {
      if (!this.creaturesByFaction.has(creature.faction)) {
        this.creaturesByFaction.set(creature.faction, []);
      }
      this.creaturesByFaction.get(creature.faction)!.push(creature);
    });

    // Группируем здания по фракциям
    this.buildings.forEach(building => {
      const faction = building.faction || 'common';
      if (!this.buildingsByFaction.has(faction)) {
        this.buildingsByFaction.set(faction, []);
      }
      this.buildingsByFaction.get(faction)!.push(building);
    });
  }

  // ===== GET методы =====

  public getCreature(id: string): Creature | undefined {
    return this.creatures.get(id);
  }

  /**
   * Получить нормализованные боевые статы существа.
   * 
   * Унифицирует различия между форматами:
   * - JSON: health, damageMin/damageMax
   * - Fallback: hp, damage: [min, max]
   * 
   * Обрабатывает специальные ID (hero, wall, tower) для осадного боя.
   * Если существо не найдено — возвращает дефолтные статы (fallback), 
   * чтобы бой не упал при отсутствии данных.
   */
  public getCreatureStats(id: string): CreatureStats {
    const creature = this.creatures.get(id);

    if (creature) {
      // Нормализация HP: в JSON это 'health', в fallback 'hp'
      const hp = creature.health ?? creature.hp ?? 10;

      // Нормализация урона: в JSON damageMin/damageMax, в fallback damage: [min, max]
      let damageMin: number;
      let damageMax: number;
      if (creature.damageMin !== undefined && creature.damageMax !== undefined) {
        damageMin = creature.damageMin;
        damageMax = creature.damageMax;
      } else if (Array.isArray(creature.damage) && creature.damage.length === 2) {
        damageMin = creature.damage[0];
        damageMax = creature.damage[1];
      } else if (typeof creature.damage === 'object' && creature.damage !== null) {
        const dmg = creature.damage as any;
        damageMin = dmg.min ?? 1;
        damageMax = dmg.max ?? 3;
      } else {
        damageMin = 1;
        damageMax = 3;
      }

      return {
        hp,
        attack: creature.attack ?? 5,
        defense: creature.defense ?? 3,
        speed: creature.speed ?? 4,
        damage: { min: damageMin, max: damageMax },
        shots: creature.shots ?? 0,
        abilities: creature.abilities ?? [],
        faction: creature.faction ?? 'neutral',
        type: creature.type ?? 'infantry',
        tier: creature.tier ?? 1
      };
    }

    // Специальные ID для осадного боя и героя
    const specialStats: Record<string, CreatureStats> = {
      hero: {
        hp: 100, attack: 10, defense: 8, speed: 6,
        damage: { min: 5, max: 10 }, shots: 0, abilities: [],
        faction: 'neutral', type: 'hero', tier: 0
      },
      wall: {
        hp: 200, attack: 0, defense: 5, speed: 0,
        damage: { min: 0, max: 0 }, shots: 0, abilities: ['structure'],
        faction: 'neutral', type: 'wall', tier: 0
      },
      tower: {
        hp: 150, attack: 15, defense: 8, speed: 0,
        damage: { min: 20, max: 40 }, shots: 24, abilities: ['shooter', 'structure'],
        faction: 'neutral', type: 'tower', tier: 0
      }
    };

    if (specialStats[id]) {
      return specialStats[id];
    }

    // Последний fallback — дефолтные статы чтобы бой не упал
    console.warn(`⚠️ ContentManager: существо '${id}' не найдено, используются дефолтные статы`);
    return {
      hp: 10, attack: 5, defense: 3, speed: 4,
      damage: { min: 1, max: 3 }, shots: 0, abilities: [],
      faction: 'neutral', type: 'infantry', tier: 1
    };
  }

  /**
   * Получить боевые статы героя на основе его реальных характеристик.
   * В HoMM4 герой — полноценный юнит на поле боя.
   */
  public getHeroBattleStats(hero: Hero): CreatureStats {
    const attack = hero.stats?.attack ?? 5;
    const defense = hero.stats?.defense ?? 3;
    const spellPower = hero.stats?.spellPower ?? 0;

    // HP героя = базовое 50 + 10 за уровень
    const hp = 50 + (hero.level || 1) * 10;

    // Скорость зависит от класса
    const isRangedClass = ['cleric', 'necromancer', 'druid', 'heretic', 'wizard', 'artificer', 'shaman'].includes(hero.class);
    const speed = isRangedClass ? 5 : 6;

    // Урон: воины — физический, маги — основанный на spellPower
    let damageMin: number;
    let damageMax: number;
    if (isRangedClass) {
      damageMin = 3 + Math.floor(spellPower * 2);
      damageMax = 6 + Math.floor(spellPower * 3);
    } else {
      damageMin = 5 + Math.floor(attack * 0.5);
      damageMax = 10 + Math.floor(attack * 0.8);
    }

    // Способности: стрелки могут стрелять
    const abilities: string[] = [];
    if (isRangedClass) {
      abilities.push('shooter');
    }

    return {
      hp,
      attack,
      defense,
      speed,
      damage: { min: damageMin, max: damageMax },
      shots: isRangedClass ? 24 : 0,
      abilities,
      faction: hero.faction || 'neutral',
      type: isRangedClass ? 'shooter' : 'infantry',
      tier: 0
    };
  }

  public getCreaturesByFaction(faction: string): Creature[] {
    return this.creaturesByFaction.get(faction) || [];
  }

  public getAllCreatures(): Creature[] {
    return Array.from(this.creatures.values());
  }

  public getCreaturesByTier(tier: number): Creature[] {
    return this.getAllCreatures().filter(c => c.tier === tier);
  }

  public getBuilding(id: string): Building | undefined {
    return this.buildings.get(id);
  }

  public getBuildingsByFaction(faction: string): Building[] {
    const factionBuildings = this.buildingsByFaction.get(faction) || [];
    const commonBuildings = this.buildingsByFaction.get('common') || [];
    return [...commonBuildings, ...factionBuildings];
  }

  public getAllBuildings(): Building[] {
    return Array.from(this.buildings.values());
  }

  public getArtifact(id: string): Artifact | undefined {
    return this.artifacts.get(id);
  }

  public getAllArtifacts(): Artifact[] {
    return Array.from(this.artifacts.values());
  }

  public getRandomArtifacts(count: number, tier?: 'minor' | 'major' | 'relic'): Artifact[] {
    let available = this.getAllArtifacts();
    if (tier) {
      available = available.filter(a => (a as any).tier === tier);
    }
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  public getSpell(id: string): Spell | undefined {
    return this.spells.get(id);
  }

  public getAllSpells(): Spell[] {
    return Array.from(this.spells.values());
  }

  public getSpellsBySchool(school: string): Spell[] {
    return this.getAllSpells().filter(s => s.school === school);
  }

  public getFaction(id: string): Faction | undefined {
    return this.factions.get(id);
  }

  public getAllFactions(): Faction[] {
    return Array.from(this.factions.values());
  }

  /**
   * Получить случайное существо для нейтрала
   */
  public getRandomNeutral(tier?: number): Creature {
    const creatures = tier
      ? this.getCreaturesByTier(tier)
      : this.getAllCreatures();
    return creatures[Math.floor(Math.random() * creatures.length)];
  }

  /**
   * Получить случайного героя по фракции
   */
  public getRandomHeroForFaction(faction: string): { name: string; startingArmy: { creatureId: string; count: number }[] } {
    const heroes = this.getHeroNamesByFaction(faction);
    const name = heroes[Math.floor(Math.random() * heroes.length)];
    const creatures = this.getCreaturesByFaction(faction);

    const startingArmy = creatures.slice(0, 2 + Math.floor(Math.random() * 2)).map(c => ({
      creatureId: c.id,
      count: Math.floor(c.growth * (0.5 + Math.random()))
    }));

    return { name, startingArmy };
  }

  private getHeroNamesByFaction(faction: string): string[] {
    const heroNames: Record<string, string[]> = {
      haven: ['Сэр Гэвин', 'Леди Кэтрин', 'Паладин Артур', 'Кристиан', 'Сэр Ролан'],
      necropolis: ['Мортис', 'Сандро', 'Видомина', 'Исра', 'Кастор'],
      preserve: ['Элани', 'Гемма', 'Клэнси', 'Джельу', 'Мефала'],
      asylum: ['Грок', 'Тирания', 'Шива', 'Аламар', 'Фиона'],
      academy: ['Аламар', 'Иона', 'Неерос', 'Солмир', 'Астрал'],
      stronghold: ['Краг Хак', 'Шива', 'Горда', 'Корд', 'Десса']
    };
    return heroNames[faction] || heroNames.haven;
  }

  /**
   * Получить статистику загруженных данных
   */
  public getStats(): string {
    return [
      `Существ: ${this.creatures.size}`,
      `Зданий: ${this.buildings.size}`,
      `Артефактов: ${this.artifacts.size}`,
      `Заклинаний: ${this.spells.size}`,
      `Фракций: ${this.factions.size}`
    ].join(', ');
  }

  // ===== FALLBACK данные =====

  private loadFallbackCreatures(): void {
    const fallback: Creature[] = [
      { id: 'pikeman', name: 'Ополченец', faction: 'haven', tier: 1, attack: 4, defense: 5, hp: 10, damage: [1, 3], speed: 4, shots: 0, growth: 14, cost: { gold: 60 }, abilities: [], type: 'infantry' }
    ];
    fallback.forEach(c => this.creatures.set(c.id, c));
  }

  private loadFallbackBuildings(): void {
    // Пусто — используется дефолт
  }

  private loadFallbackArtifacts(): void {
    // Пусто — используется дефолт
  }

  private loadFallbackSpells(): void {
    // Пусто — используется дефолт
  }

  private loadFallbackFactions(): void {
    const fallbackFactions: Faction[] = [
      { id: 'haven', name: 'Убежище', description: 'Свет и порядок' },
      { id: 'necropolis', name: 'Некрополис', description: 'Нежить и тьма' },
      { id: 'preserve', name: 'Заповедник', description: 'Сила природы' },
      { id: 'asylum', name: 'Азилум', description: 'Хаос и магия' },
      { id: 'academy', name: 'Академия', description: 'Знание и магия' },
      { id: 'stronghold', name: 'Твердыня', description: 'Сила и ярость' }
    ];
    fallbackFactions.forEach(f => this.factions.set(f.id, f));
  }
}

// Синглтон для удобного импорта
export const contentManager = ContentManager.getInstance();
