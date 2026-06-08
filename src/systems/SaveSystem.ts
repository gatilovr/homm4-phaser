/**
 * SaveSystem — полная система сохранения игры в localStorage
 * 
 * Сохраняет:
 * - Версию (для миграций)
 * - Сид карты (для восстановления)
 * - День и неделю
 * - Ресурсы игрока
 * - Героев (позиции, статы, навыки, армия, заклинания, экипировка)
 * - Города (постройки, гарнизон, владельцы)
 * - Шахты (тип, владелец)
 * - Объекты карты (посещённые/подобранные)
 * - ИИ-игроков (города, герои, шахты)
 * - Туман войны
 */

import type { Hero, Resources, Tile } from '../types';
import { CONFIG } from '../config';

// ===== Версия сохранения =====
export const SAVE_VERSION = '2.3.0';

// ===== Ключ в localStorage =====
const SAVE_KEY = 'hommm4_save_slot_';
const MAX_SLOTS = 3;
const AUTO_SAVE_KEY = 'hommm4_autosave';

// ===== Интерфейс сохранения =====
export interface SaveData {
  version: string;
  timestamp: number;
  seed: number;
  day: number;
  week: number;
  resources: Resources;
  heroes: SaveHero[];
  towns: SaveTown[];
  mines: SaveMine[];
  objects: SaveObject[];
  aiPlayers: SaveAIPlayer[];
  fogOfWar: SaveFog;
  mapModifiers?: SaveMapModifier[]; // изменения карты (например, вырытые ямы)
  caravanState?: any; // состояние караванов
  currentHeroIndex?: number;
}

export interface SaveHero {
  id: string;
  name: string;
  class: string;
  faction: string;
  level: number;
  experience: number;
  x: number;
  y: number;
  movementPoints: number;
  maxMovementPoints: number;
  stats: {
    attack: number;
    defense: number;
    spellPower: number;
    knowledge: number;
  };
  skills: Array<{
    id: string;
    name: string;
    level: number;
    category: string;
    effects: Array<{ type: string; value: number }>;
  }>;
  equipment: Record<string, any>;
  army: Array<{ creatureId: string; count: number }>;
  mana: number;
  maxMana: number;
  spells: string[];
  morale: number;
  luck: number;
  owner: 'player' | 'enemy';
  specialization?: string;
}

export interface SaveTown {
  id: string;
  x: number;
  y: number;
  name: string;
  faction: string;
  owner: string;
  buildings: string[];
  garrison: Array<{ creatureId: string; count: number }>;
  resources?: Resources;
  mageGuildLevel?: number;
  mageGuildOffers?: string[];
  tavernHeroes?: any[];
  availableForHire?: Record<string, number>;
}

export interface SaveMine {
  id: string;
  x: number;
  y: number;
  type: string;
  owner: string;
}

export interface SaveObject {
  id: string;
  x: number;
  y: number;
  type: string;
  collected?: boolean;
  visited?: boolean;
  data?: any;
}

export interface SaveAIPlayer {
  id: string;
  name: string;
  faction: string;
  towns: string[]; // ID городов
  heroes: SaveHero[];
  mines: string[]; // ID шахт
  resources?: Resources;
}

export interface SaveFog {
  visible: number[][]; // 2D массив boolean как number
  visited: number[][];
}

export interface SaveMapModifier {
  x: number;
  y: number;
  change: string; // тип изменения
}

// ===== Метаданные слота сохранения =====
export interface SaveSlotInfo {
  slot: number;
  exists: boolean;
  version?: string;
  timestamp?: number;
  day?: number;
  week?: number;
  heroName?: string;
  heroLevel?: number;
  faction?: string;
}

/**
 * SaveSystem — singleton для управления сохранениями
 */
export class SaveSystem {
  private static instance: SaveSystem | null = null;

  private constructor() {}

  public static getInstance(): SaveSystem {
    if (!SaveSystem.instance) {
      SaveSystem.instance = new SaveSystem();
    }
    return SaveSystem.instance;
  }

  // ===== СОХРАНЕНИЕ =====

  /**
   * Сохранить игру в указанный слот (1-3)
   */
  public saveGame(slot: number, data: SaveData): boolean {
    if (slot < 1 || slot > MAX_SLOTS) {
      console.error(`[SaveSystem] Неверный слот: ${slot}`);
      return false;
    }

    try {
      const key = SAVE_KEY + slot;
      const json = JSON.stringify(data);
      localStorage.setItem(key, json);
      console.log(`[SaveSystem] ✓ Игра сохранена в слот ${slot}`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] Ошибка сохранения:', error);
      return false;
    }
  }

  /**
   * Автосохранение (в отдельный ключ)
   */
  public autoSave(data: SaveData): boolean {
    try {
      const json = JSON.stringify(data);
      localStorage.setItem(AUTO_SAVE_KEY, json);
      console.log('[SaveSystem] ✓ Автосохранение');
      return true;
    } catch (error) {
      console.error('[SaveSystem] Ошибка автосохранения:', error);
      return false;
    }
  }

  // ===== ЗАГРУЗКА =====

  /**
   * Загрузить игру из указанного слота
   */
  public loadGame(slot: number): SaveData | null {
    if (slot < 1 || slot > MAX_SLOTS) {
      console.error(`[SaveSystem] Неверный слот: ${slot}`);
      return null;
    }

    try {
      const key = SAVE_KEY + slot;
      const json = localStorage.getItem(key);
      if (!json) {
        console.log(`[SaveSystem] Слот ${slot} пуст`);
        return null;
      }

      const data = JSON.parse(json) as SaveData;
      
      // Проверка версии и миграция при необходимости
      const migrated = this.migrateIfNeeded(data);
      
      console.log(`[SaveSystem] ✓ Игра загружена из слота ${slot}`);
      return migrated;
    } catch (error) {
      console.error('[SaveSystem] Ошибка загрузки:', error);
      return null;
    }
  }

  /**
   * Загрузить автосохранение
   */
  public loadAutoSave(): SaveData | null {
    try {
      const json = localStorage.getItem(AUTO_SAVE_KEY);
      if (!json) return null;
      
      const data = JSON.parse(json) as SaveData;
      return this.migrateIfNeeded(data);
    } catch (error) {
      console.error('[SaveSystem] Ошибка загрузки автосохранения:', error);
      return null;
    }
  }

  /**
   * Проверить существует ли сохранение в слоте
   */
  public hasSave(slot: number): boolean {
    if (slot < 1 || slot > MAX_SLOTS) return false;
    return localStorage.getItem(SAVE_KEY + slot) !== null;
  }

  /**
   * Проверить есть ли автосохранение
   */
  public hasAutoSave(): boolean {
    return localStorage.getItem(AUTO_SAVE_KEY) !== null;
  }

  /**
   * Получить информацию о слоте сохранения (для UI)
   */
  public getSlotInfo(slot: number): SaveSlotInfo {
    const data = this.loadGame(slot);
    
    if (!data) {
      return { slot, exists: false };
    }

    const mainHero = data.heroes.find(h => h.owner === 'player');
    
    return {
      slot,
      exists: true,
      version: data.version,
      timestamp: data.timestamp,
      day: data.day,
      week: data.week,
      heroName: mainHero?.name,
      heroLevel: mainHero?.level,
      faction: mainHero?.faction,
    };
  }

  /**
   * Получить информацию обо всех слотах
   */
  public getAllSlotsInfo(): SaveSlotInfo[] {
    const slots: SaveSlotInfo[] = [];
    for (let i = 1; i <= MAX_SLOTS; i++) {
      slots.push(this.getSlotInfo(i));
    }
    return slots;
  }

  // ===== УДАЛЕНИЕ =====

  /**
   * Удалить сохранение из слота
   */
  public deleteSave(slot: number): boolean {
    if (slot < 1 || slot > MAX_SLOTS) return false;
    try {
      localStorage.removeItem(SAVE_KEY + slot);
      console.log(`[SaveSystem] ✓ Слот ${slot} очищен`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] Ошибка удаления:', error);
      return false;
    }
  }

  /**
   * Удалить все сохранения
   */
  public deleteAllSaves(): void {
    for (let i = 1; i <= MAX_SLOTS; i++) {
      localStorage.removeItem(SAVE_KEY + i);
    }
    localStorage.removeItem(AUTO_SAVE_KEY);
    console.log('[SaveSystem] ✓ Все сохранения удалены');
  }

  // ===== СБОР ДАННЫХ ИЗ ИГРЫ =====

  /**
   * Собрать данные для сохранения из WorldScene
   * Вызывается из WorldScene.saveCurrentState()
   */
  public collectSaveData(worldScene: any): SaveData {
    return {
      version: SAVE_VERSION,
      timestamp: Date.now(),
      seed: worldScene.seed || CONFIG.MAP_SEED,
      day: worldScene.day,
      week: worldScene.week,
      resources: { ...worldScene.resources },
      heroes: this.collectHeroes(worldScene),
      towns: this.collectTowns(worldScene),
      mines: this.collectMines(worldScene),
      objects: this.collectObjects(worldScene),
      aiPlayers: this.collectAIPlayers(worldScene),
      fogOfWar: this.collectFog(worldScene),
      caravanState: worldScene.caravanSystem?.getState?.() || null,
      currentHeroIndex: worldScene.currentHeroIndex || 0,
    };
  }

  private collectHeroes(worldScene: any): SaveHero[] {
    const heroes: SaveHero[] = [];
    
    // Все герои игрока
    if (worldScene.playerHeroes && Array.isArray(worldScene.playerHeroes)) {
      for (const hero of worldScene.playerHeroes) {
        heroes.push(this.serializeHero(hero));
      }
    }
    
    // Активный герой (если не в массиве)
    if (worldScene.hero && !heroes.find(h => h.id === worldScene.hero.id)) {
      heroes.push(this.serializeHero(worldScene.hero));
    }
    
    return heroes;
  }

  private serializeHero(hero: Hero): SaveHero {
    return {
      id: hero.id,
      name: hero.name,
      class: hero.class,
      faction: hero.faction,
      level: hero.level,
      experience: hero.experience,
      x: hero.x,
      y: hero.y,
      movementPoints: hero.movementPoints,
      maxMovementPoints: hero.maxMovementPoints,
      stats: { ...hero.stats },
      skills: hero.skills.map(s => ({
        id: s.id,
        name: s.name,
        level: s.level,
        category: s.category,
        effects: s.effects.map(e => ({ ...e })),
      })),
      equipment: JSON.parse(JSON.stringify(hero.equipment || {})),
      army: hero.army.map(u => ({
        creatureId: u.creatureId,
        count: u.count,
      })),
      mana: hero.mana,
      maxMana: hero.maxMana,
      spells: [...(hero.spells || [])],
      morale: hero.morale,
      luck: hero.luck,
      owner: hero.owner,
      specialization: (hero as any).specialization,
    };
  }

  private collectTowns(worldScene: any): SaveTown[] {
    const towns: SaveTown[] = [];
    const victorySystem = worldScene.victorySystem;
    
    if (!victorySystem?.getAllTowns) return towns;
    
    // Используем публичный метод VictorySystem (towns — это приватный Map!)
    const allTowns = victorySystem.getAllTowns();
    for (const town of allTowns) {
      // Сохраняем availableForHire как массив ArmySlot[], не Record
      const hireArray = town.availableForHire || [];
      const hireRecord: Record<string, number> = {};
      for (const slot of hireArray) {
        hireRecord[slot.creatureId] = slot.count;
      }
      
      towns.push({
        id: town.id,
        x: town.x,
        y: town.y,
        name: town.name,
        faction: town.faction,
        owner: town.owner,
        buildings: [...(town.builtBuildings || [])],
        garrison: (town.garrison || []).map((u: any) => ({
          creatureId: u.creatureId,
          count: u.count,
        })),
        availableForHire: hireRecord,
        // Дополнительные поля могут отсутствовать в текущем TownOwnership
        resources: (town as any).resources ? { ...(town as any).resources } : undefined,
        mageGuildLevel: (town as any).mageGuildLevel,
        mageGuildOffers: (town as any).mageGuildOffers ? [...(town as any).mageGuildOffers] : undefined,
      });
    }
    
    return towns;
  }

  private collectMines(worldScene: any): SaveMine[] {
    const mines: SaveMine[] = [];
    const victorySystem = worldScene.victorySystem;
    
    if (!victorySystem?.getAllMinesList) return mines;
    
    // Используем публичный метод VictorySystem (mines — это приватный Map!)
    const allMines = victorySystem.getAllMinesList();
    for (const mine of allMines) {
      mines.push({
        id: mine.id,
        x: mine.x,
        y: mine.y,
        type: mine.resourceType || 'gold',
        owner: mine.owner,
      });
    }
    
    return mines;
  }

  private collectObjects(worldScene: any): SaveObject[] {
    const objects: SaveObject[] = [];
    const map: Tile[][] = worldScene.map;
    
    if (!map) return objects;
    
    for (let y = 0; y < map.length; y++) {
      for (let x = 0; x < map[y].length; x++) {
        const tile = map[y][x];
        if (tile.object) {
          objects.push({
            id: tile.object.id,
            x: tile.x,
            y: tile.y,
            type: tile.object.type,
            collected: (tile.object as any).collected || false,
            visited: (tile.object as any).visited || false,
            data: tile.object.data ? JSON.parse(JSON.stringify(tile.object.data)) : undefined,
          });
        }
      }
    }
    
    return objects;
  }

  private collectAIPlayers(worldScene: any): SaveAIPlayer[] {
    const aiPlayers: SaveAIPlayer[] = [];
    const aiSystem = worldScene.aiSystem;
    
    if (!aiSystem?.getAIPlayers) return aiPlayers;
    
    // Используем публичный метод AISystem
    const players = aiSystem.getAIPlayers();
    if (!Array.isArray(players)) return aiPlayers;
    
    for (const player of players) {
      aiPlayers.push({
        id: (player as any).id || '',
        name: (player.hero as any)?.name || 'AI',
        faction: (player.hero as any)?.faction || 'necropolis',
        towns: [...((player as any).towns || [])],
        heroes: player.hero ? [this.serializeHero(player.hero)] : [],
        mines: [...((player as any).mines || [])],
        resources: (player as any).resources ? { ...(player as any).resources } : undefined,
      });
    }
    
    return aiPlayers;
  }

  private collectFog(worldScene: any): SaveFog {
    const map: Tile[][] = worldScene.map;
    const visible: number[][] = [];
    const visited: number[][] = [];
    
    if (map) {
      for (let y = 0; y < map.length; y++) {
        visible[y] = [];
        visited[y] = [];
        for (let x = 0; x < map[y].length; x++) {
          visible[y][x] = map[y][x].visible ? 1 : 0;
          visited[y][x] = map[y][x].visited ? 1 : 0;
        }
      }
    }
    
    return { visible, visited };
  }

  // ===== ВОССТАНОВЛЕНИЕ ДАННЫХ =====

  /**
   * Восстановить состояние игры в WorldScene
   */
  public restoreGameState(worldScene: any, data: SaveData): void {
    // Базовые параметры
    worldScene.day = data.day;
    worldScene.week = data.week;
    worldScene.resources = { ...data.resources };
    worldScene.currentHeroIndex = data.currentHeroIndex || 0;
    
    // Восстановить карту (туман войны)
    this.restoreFog(worldScene, data.fogOfWar);
    
    // Восстановить героев
    this.restoreHeroes(worldScene, data.heroes);
    
    // Восстановить города
    this.restoreTowns(worldScene, data.towns);
    
    // Восстановить шахты
    this.restoreMines(worldScene, data.mines);
    
    // Восстановить объекты
    this.restoreObjects(worldScene, data.objects);
    
    // Восстановить ИИ
    this.restoreAIPlayers(worldScene, data.aiPlayers);
    
    // Восстановить караваны
    if (data.caravanState && worldScene.caravanSystem?.restoreState) {
      worldScene.caravanSystem.restoreState(data.caravanState);
    }
    
    console.log('[SaveSystem] ✓ Состояние игры восстановлено');
  }

  private restoreFog(worldScene: any, fog: SaveFog): void {
    const map: Tile[][] = worldScene.map;
    if (!map) return;
    
    for (let y = 0; y < map.length && y < fog.visible.length; y++) {
      for (let x = 0; x < map[y].length && x < fog.visible[y].length; x++) {
        map[y][x].visible = fog.visible[y][x] === 1;
        map[y][x].visited = fog.visited[y][x] === 1;
      }
    }
  }

  private restoreHeroes(worldScene: any, heroes: SaveHero[]): void {
    worldScene.playerHeroes = [];
    
    for (const heroData of heroes) {
      if (heroData.owner === 'player') {
        const hero: Hero = {
          id: heroData.id,
          name: heroData.name,
          class: heroData.class,
          faction: heroData.faction,
          level: heroData.level,
          experience: heroData.experience,
          x: heroData.x,
          y: heroData.y,
          movementPoints: heroData.movementPoints,
          maxMovementPoints: heroData.maxMovementPoints,
          stats: { ...heroData.stats },
          skills: heroData.skills.map(s => ({
            ...s,
            category: s.category as any,
          })),
          equipment: heroData.equipment,
          army: heroData.army,
          mana: heroData.mana,
          maxMana: heroData.maxMana,
          spells: heroData.spells,
          morale: heroData.morale,
          luck: heroData.luck,
          owner: 'player',
          mapLevel: 'surface'
        };
        
        (hero as any).specialization = heroData.specialization;
        worldScene.playerHeroes.push(hero);
      }
    }
    
    // Установить активного героя
    if (worldScene.playerHeroes.length > 0) {
      const idx = Math.min(worldScene.currentHeroIndex || 0, worldScene.playerHeroes.length - 1);
      worldScene.hero = worldScene.playerHeroes[idx];
    }
  }

  private restoreTowns(worldScene: any, towns: SaveTown[]): void {
    const vs = worldScene.victorySystem;
    if (!vs) return;
    
    for (const townData of towns) {
      // Используем публичный метод getTown (а не обращение к приватному Map)
      const existing = vs.getTown?.(townData.id);
      if (!existing) continue;
      
      // Восстанавливаем основные поля
      existing.owner = townData.owner;
      existing.builtBuildings = [...(townData.buildings || [])];
      existing.garrison = (townData.garrison || []).map(u => ({
        creatureId: u.creatureId,
        count: u.count,
      }));
      
      // Восстанавливаем availableForHire (преобразуем Record → ArmySlot[])
      if (townData.availableForHire) {
        existing.availableForHire = Object.entries(townData.availableForHire).map(
          ([creatureId, count]) => ({ creatureId, count: count as number })
        );
      }
      
      // Дополнительные поля (могут отсутствовать в типе TownOwnership)
      if (townData.resources) (existing as any).resources = { ...townData.resources };
      if (townData.mageGuildLevel !== undefined) (existing as any).mageGuildLevel = townData.mageGuildLevel;
      if (townData.mageGuildOffers) (existing as any).mageGuildOffers = [...townData.mageGuildOffers];
    }
  }

  private restoreMines(worldScene: any, mines: SaveMine[]): void {
    const vs = worldScene.victorySystem;
    if (!vs?.getMine) return;
    
    for (const mineData of mines) {
      // Используем публичный метод getMine (а не обращение к приватному Map)
      const existing = vs.getMine(mineData.id);
      if (existing) {
        existing.owner = mineData.owner;
      }
    }
  }

  private restoreObjects(worldScene: any, objects: SaveObject[]): void {
    const map: Tile[][] = worldScene.map;
    if (!map) return;
    
    for (const objData of objects) {
      const tile = map[objData.y]?.[objData.x];
      if (tile?.object && tile.object.id === objData.id) {
        if (objData.collected) (tile.object as any).collected = true;
        if (objData.visited) (tile.object as any).visited = true;
        if (objData.data) tile.object.data = objData.data;
      }
    }
  }

  private restoreAIPlayers(worldScene: any, aiPlayers: SaveAIPlayer[]): void {
    const aiSystem = worldScene.aiSystem;
    if (!aiSystem?.getAIPlayers) return;
    
    const currentPlayers = aiSystem.getAIPlayers();
    if (!Array.isArray(currentPlayers)) return;
    
    for (const aiData of aiPlayers) {
      // Ищем ИИ-игрока по id (или по имени героя как fallback)
      const existing = currentPlayers.find((p: any) => 
        p.id === aiData.id || (p.hero?.name === aiData.name)
      );
      if (!existing) continue;
      
      (existing as any).towns = [...aiData.towns];
      (existing as any).mines = [...aiData.mines];
      
      // Восстанавливаем героя ИИ (первый в списке)
      if (aiData.heroes.length > 0 && existing.hero) {
        const heroData = aiData.heroes[0];
        existing.hero.level = heroData.level;
        existing.hero.experience = heroData.experience;
        existing.hero.stats = { ...heroData.stats };
        existing.hero.army = heroData.army.map(u => ({ ...u }));
        existing.hero.mana = heroData.mana;
        existing.hero.maxMana = heroData.maxMana;
        existing.hero.skills = heroData.skills.map(s => ({
          ...s,
          category: s.category as any,
        }));
      }
      
      if (aiData.resources) (existing as any).resources = { ...aiData.resources };
    }
  }

  // ===== МИГРАЦИИ =====

  /**
   * Миграция старых сохранений на новую версию
   */
  private migrateIfNeeded(data: SaveData): SaveData {
    // Если версия совпадает — ничего не делать
    if (data.version === SAVE_VERSION) {
      return data;
    }
    
    console.log(`[SaveSystem] Миграция сохранения: ${data.version} → ${SAVE_VERSION}`);
    
    // Здесь можно добавить миграции для старых версий
    // Например:
    // if (!data.version || data.version < '2.0.0') {
    //   data = this.migrateV1toV2(data);
    // }
    
    // Обновить версию
    data.version = SAVE_VERSION;
    
    return data;
  }

  // ===== УТИЛИТЫ =====

  /**
   * Экспорт сохранения в файл (для бэкапа)
   */
  public exportSave(slot: number): string | null {
    const json = localStorage.getItem(SAVE_KEY + slot);
    if (!json) return null;
    
    // Base64 кодирование
    return btoa(unescape(encodeURIComponent(json)));
  }

  /**
   * Импорт сохранения из файла
   */
  public importSave(slot: number, base64: string): boolean {
    try {
      const json = decodeURIComponent(escape(atob(base64)));
      JSON.parse(json); // проверка валидности
      localStorage.setItem(SAVE_KEY + slot, json);
      console.log(`[SaveSystem] ✓ Сохранение импортировано в слот ${slot}`);
      return true;
    } catch (error) {
      console.error('[SaveSystem] Ошибка импорта:', error);
      return false;
    }
  }

  /**
   * Получить размер сохранения в байтах
   */
  public getSaveSize(slot: number): number {
    const json = localStorage.getItem(SAVE_KEY + slot);
    return json ? json.length : 0;
  }

  /**
   * Проверить поддержку localStorage
   */
  public isStorageAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (e) {
      return false;
    }
  }
}
