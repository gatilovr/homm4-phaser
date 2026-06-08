/**
 * UndergroundGenerator — генератор подземного уровня карты
 * 
 * Реализует канон HoMM4: каждая карта имеет два уровня (surface + underground).
 * Подземелье использует клеточный автомат (cellular automata) для создания
 * естественных пещер, связанных туннелями.
 * 
 * Особенности канонного подземелья HoMM4:
 * - Пещерные тайлы: cave_floor, cave_rock, underground_lake, mushroom_grove
 * - Subterranean gates (парные порталы между уровнями)
 * - Меньше объектов чем на поверхности
 * - Редкие ресурсы (руда, кристаллы)
 * - Подземные существа (тролли, медузы, минотавры)
 * - Нет городов (кроме особых сценариев)
 */

import { Tile, MapObject, MapLevel, TileType } from '../types';
import { NoiseGenerator } from '../utils/NoiseGenerator';

export interface UndergroundConfig {
  width: number;
  height: number;
  seed: number;
  /** Количество subterranean gates (порталов между уровнями) */
  gateCount: number;
  /** Позиции порталов на поверхности (для связывания) */
  surfaceGatePositions: Array<{ x: number; y: number; id: string }>;
}

export interface UndergroundResult {
  map: Tile[][];
  objects: MapObject[];
  /** Позиции порталов в подземелье (парные к surfaceGatePositions) */
  gatePositions: Array<{ x: number; y: number; id: string }>;
}

export class UndergroundGenerator {
  private noise: NoiseGenerator;
  private width: number;
  private height: number;
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
    this.noise = new NoiseGenerator(seed + 12345); // смещённый seed для разнообразия
    this.width = 60;
    this.height = 60;
  }

  /**
   * Генерирует подземный уровень карты
   * Использует клеточный автомат для создания пещер
   */
  generate(config: UndergroundConfig): UndergroundResult {
    this.width = config.width;
    this.height = config.height;

    // Шаг 1: Создать начальную карту (шум + случайные стены)
    const initialCave = this.initializeCave();

    // Шаг 2: Применить клеточный автомат (4-5 итераций)
    let caveBool: boolean[][] = initialCave;
    for (let i = 0; i < 5; i++) {
      caveBool = this.applyCellularAutomaton(caveBool);
    }

    // Шаг 3: Соединить пещеры туннелями
    caveBool = this.connectCaves(caveBool);

    // Шаг 4: Добавить подземные особенности (озёра, грибы)
    // addUndergroundFeatures конвертирует boolean[][] в number[][] (featureMap)
    const featureMap = this.addUndergroundFeatures(caveBool);

    // Шаг 5: Конвертировать в Tile[][]
    const map = this.convertToTiles(featureMap);

    // Шаг 6: Разместить объекты
    const objects = this.placeObjects(map, config);

    // Шаг 7: Вернуть позиции порталов
    const gatePositions = config.surfaceGatePositions.map((sg, idx) => ({
      x: sg.x,
      y: sg.y,
      id: `underground_gate_${idx}`
    }));

    return { map, objects, gatePositions };
  }

  /**
   * Инициализация карты: шум + случайные стены
   * ~45% стен для создания интересных пещер
   */
  private initializeCave(): boolean[][] {
    const map: boolean[][] = [];

    for (let y = 0; y < this.height; y++) {
      map[y] = [];
      for (let x = 0; x < this.width; x++) {
        // Границы всегда стены
        if (x === 0 || y === 0 || x === this.width - 1 || y === this.height - 1) {
          map[y][x] = true; // wall
        } else {
          // Шум + случайность
          const noise = this.noise.normalizedNoise(x / 10, y / 10);
          const random = this.pseudoRandom(x, y);
          // ~45% стен
          map[y][x] = noise < 0.5 || random < 0.45;
        }
      }
    }

    return map;
  }

  /**
   * Клеточный автомат для пещер (правило 4-5)
   * Клетка становится стеной, если:
   * - Она стена И имеет >= 4 соседей-стен
   * - Она пустая И имеет >= 5 соседей-стен
   */
  private applyCellularAutomaton(map: boolean[][]): boolean[][] {
    const newMap: boolean[][] = [];

    for (let y = 0; y < this.height; y++) {
      newMap[y] = [];
      for (let x = 0; x < this.width; x++) {
        const wallNeighbors = this.countWallNeighbors(map, x, y);

        if (map[y][x]) {
          // Стена остаётся стеной, если >= 4 соседа
          newMap[y][x] = wallNeighbors >= 4;
        } else {
          // Пустая клетка становится стеной, если >= 5 соседей
          newMap[y][x] = wallNeighbors >= 5;
        }
      }
    }

    return newMap;
  }

  /**
   * Подсчёт соседей-стен (в радиусе 1)
   */
  private countWallNeighbors(map: boolean[][], x: number, y: number): number {
    let count = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) {
          count++; // За границей считаем стеной
        } else if (map[ny][nx]) {
          count++;
        }
      }
    }
    return count;
  }

  /**
   * Соединение разрозненных пещер туннелями
   * Находит все отдельные пещеры и соединяет их
   */
  private connectCaves(map: boolean[][]): boolean[][] {
    // Найти все пещеры через flood fill
    const regions = this.findRegions(map);

    if (regions.length <= 1) {
      return map; // Все уже соединено
    }

    // Соединить все пещеры с самой большой
    const mainRegion = regions.reduce((a, b) => a.length > b.length ? a : b);
    const newMap = map.map(row => [...row]);

    for (const region of regions) {
      if (region === mainRegion) continue;

      // Найти ближайшие клетки между регионами
      const { start, end } = this.findClosestPoints(mainRegion, region);

      // Прорыть туннель
      this.carveTunnel(newMap, start, end);
    }

    return newMap;
  }

  /**
   * Поиск всех отдельных регионов (пещер) через flood fill
   */
  private findRegions(map: boolean[][]): Array<Array<{ x: number; y: number }>> {
    const visited = new Set<string>();
    const regions: Array<Array<{ x: number; y: number }>> = [];

    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const key = `${x},${y}`;
        if (map[y][x] || visited.has(key)) continue;

        // Flood fill от этой клетки
        const region: Array<{ x: number; y: number }> = [];
        const queue = [{ x, y }];

        while (queue.length > 0) {
          const pos = queue.shift()!;
          const posKey = `${pos.x},${pos.y}`;

          if (visited.has(posKey)) continue;
          if (pos.x < 0 || pos.y < 0 || pos.x >= this.width || pos.y >= this.height) continue;
          if (map[pos.y][pos.x]) continue;

          visited.add(posKey);
          region.push(pos);

          queue.push({ x: pos.x + 1, y: pos.y });
          queue.push({ x: pos.x - 1, y: pos.y });
          queue.push({ x: pos.x, y: pos.y + 1 });
          queue.push({ x: pos.x, y: pos.y - 1 });
        }

        if (region.length > 10) {
          // Только значимые пещеры (>10 клеток)
          regions.push(region);
        }
      }
    }

    return regions;
  }

  /**
   * Найти ближайшие точки между двумя регионами
   */
  private findClosestPoints(
    region1: Array<{ x: number; y: number }>,
    region2: Array<{ x: number; y: number }>
  ): { start: { x: number; y: number }; end: { x: number; y: number } } {
    let minDist = Infinity;
    let start = region1[0];
    let end = region2[0];

    // Сэмплирование (не проверяем все пары для производительности)
    const sample1 = region1.filter((_, i) => i % 10 === 0);
    const sample2 = region2.filter((_, i) => i % 10 === 0);

    for (const p1 of sample1) {
      for (const p2 of sample2) {
        const dist = Math.abs(p1.x - p2.x) + Math.abs(p1.y - p2.y);
        if (dist < minDist) {
          minDist = dist;
          start = p1;
          end = p2;
        }
      }
    }

    return { start, end };
  }

  /**
   * Прорыть туннель между двумя точками (по диагонали)
   */
  private carveTunnel(
    map: boolean[][],
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): void {
    let x = start.x;
    let y = start.y;

    while (x !== end.x || y !== end.y) {
      map[y][x] = false; // Прорыть

      // Движение к цели
      if (Math.abs(end.x - x) > Math.abs(end.y - y)) {
        x += end.x > x ? 1 : -1;
      } else {
        y += end.y > y ? 1 : -1;
      }
    }

    map[end.y][end.x] = false;
  }

  /**
   * Добавить подземные особенности:
   * - Подземные озёра (в низинах)
   * - Грибные рощи (в центре больших пещер)
   * - Подземные реки
   */
  private addUndergroundFeatures(map: boolean[][]): number[][] {
    // 0 = cave_floor, 1 = cave_rock, 2 = underground_lake, 3 = mushroom_grove
    const featureMap: number[][] = [];

    for (let y = 0; y < this.height; y++) {
      featureMap[y] = [];
      for (let x = 0; x < this.width; x++) {
        if (map[y][x]) {
          featureMap[y][x] = 1; // cave_rock
        } else {
          featureMap[y][x] = 0; // cave_floor
        }
      }
    }

    // Добавить подземные озёра (шум для воды)
    for (let y = 2; y < this.height - 2; y++) {
      for (let x = 2; x < this.width - 2; x++) {
        if (featureMap[y][x] !== 0) continue;

        const waterNoise = this.noise.normalizedNoise(x / 8, y / 8);
        if (waterNoise < 0.2) {
          featureMap[y][x] = 2; // underground_lake
        }
      }
    }

    // Добавить грибные рощи (в центрах пещер)
    const regions = this.findRegions(map);
    for (const region of regions) {
      if (region.length < 50) continue;

      // Найти центр пещеры
      const centerX = region.reduce((sum, p) => sum + p.x, 0) / region.length;
      const centerY = region.reduce((sum, p) => sum + p.y, 0) / region.length;

      // Грибы вокруг центра
      for (const pos of region) {
        const dist = Math.abs(pos.x - centerX) + Math.abs(pos.y - centerY);
        if (dist < 5 && Math.random() < 0.3) {
          featureMap[pos.y][pos.x] = 3; // mushroom_grove
        }
      }
    }

    return featureMap;
  }

  /**
   * Конвертировать карту в Tile[][]
   */
  private convertToTiles(featureMap: number[][]): Tile[][] {
    const tiles: Tile[][] = [];

    const typeMap: Record<number, TileType> = {
      0: 'cave_floor',
      1: 'cave_rock',
      2: 'underground_lake',
      3: 'mushroom_grove'
    };

    const moveCostMap: Record<number, number> = {
      0: 1,    // cave_floor
      1: 999,  // cave_rock (непроходим)
      2: 2,    // underground_lake
      3: 1.2   // mushroom_grove
    };

    for (let y = 0; y < this.height; y++) {
      tiles[y] = [];
      for (let x = 0; x < this.width; x++) {
        const type = featureMap[y][x];
        tiles[y][x] = {
          type: typeMap[type],
          moveCost: moveCostMap[type],
          revealed: false,
          visible: false,
          visited: false,
          blocked: type === 1,
          passable: type !== 1,
          flyable: type !== 1,
          x,
          y,
          level: 'underground'
        };
      }
    }

    return tiles;
  }

  /**
   * Разместить объекты в подземелье
   */
  private placeObjects(map: Tile[][], config: UndergroundConfig): MapObject[] {
    const objects: MapObject[] = [];
    const passableCells: Array<{ x: number; y: number }> = [];

    // Собрать все проходимые клетки без объектов
    for (let y = 2; y < this.height - 2; y++) {
      for (let x = 2; x < this.width - 2; x++) {
        if (map[y][x].passable && !map[y][x].object) {
          passableCells.push({ x, y });
        }
      }
    }

    // Перемешать
    this.shuffle(passableCells);

    let idx = 0;

    // 1. Subterranean gates (парные порталы)
    for (const gate of config.surfaceGatePositions) {
      if (idx >= passableCells.length) break;
      const pos = passableCells[idx++];
      const gateObj: MapObject = {
        id: `underground_gate_${gate.id}`,
        type: 'subterranean_gate',
        x: pos.x,
        y: pos.y,
        level: 'underground',
        pairedGateId: gate.id,
        data: {
          targetLevel: 'surface',
          targetX: gate.x,
          targetY: gate.y,
          targetGateId: gate.id
        }
      };
      objects.push(gateObj);
      map[pos.y][pos.x].object = gateObj;
    }

    // 2. Подземные шахты (руда, кристаллы — редкие ресурсы)
    const mineCount = 4;
    const undergroundMines = ['ore', 'crystal', 'gems', 'sulfur'];
    for (let i = 0; i < mineCount && idx < passableCells.length; i++) {
      const pos = passableCells[idx++];
      const mineType = undergroundMines[i % undergroundMines.length];
      const mine: MapObject = {
        id: `underground_mine_${i}`,
        type: 'mine',
        subtype: mineType,
        x: pos.x,
        y: pos.y,
        level: 'underground',
        owner: 'neutral',
        data: { mineType }
      };
      objects.push(mine);
      map[pos.y][pos.x].object = mine;
    }

    // 3. Подземные артефакты
    const artifactCount = 5;
    for (let i = 0; i < artifactCount && idx < passableCells.length; i++) {
      const pos = passableCells[idx++];
      const artifact: MapObject = {
        id: `underground_artifact_${i}`,
        type: 'artifact',
        x: pos.x,
        y: pos.y,
        level: 'underground',
        data: { tier: Math.random() < 0.3 ? 'major' : 'minor' }
      };
      objects.push(artifact);
      map[pos.y][pos.x].object = artifact;
    }

    // 4. Подземные нейтральные существа (сильные!)
    const creatureCount = 8;
    const undergroundCreatures = [
      { id: 'troll', count: 6 },
      { id: 'medusa', count: 8 },
      { id: 'minotaur', count: 5 },
      { id: 'manticore', count: 4 },
      { id: 'red_dragon', count: 2 },
      { id: 'ghost', count: 12 },
      { id: 'vampire', count: 5 },
      { id: 'lich', count: 3 }
    ];
    for (let i = 0; i < creatureCount && idx < passableCells.length; i++) {
      const pos = passableCells[idx++];
      const template = undergroundCreatures[i % undergroundCreatures.length];
      const creature: MapObject = {
        id: `underground_creature_${i}`,
        type: 'creature',
        x: pos.x,
        y: pos.y,
        level: 'underground',
        data: { creatureId: template.id, count: template.count }
      };
      objects.push(creature);
      map[pos.y][pos.x].object = creature;
    }

    // 5. Сокровища
    const treasureCount = 6;
    for (let i = 0; i < treasureCount && idx < passableCells.length; i++) {
      const pos = passableCells[idx++];
      const treasure: MapObject = {
        id: `underground_treasure_${i}`,
        type: 'treasure_chest',
        x: pos.x,
        y: pos.y,
        level: 'underground',
        data: { gold: 1000 + Math.floor(Math.random() * 2000) }
      };
      objects.push(treasure);
      map[pos.y][pos.x].object = treasure;
    }

    // 6. Святилища и алтари (редкие бонусы)
    const specialCount = 3;
    for (let i = 0; i < specialCount && idx < passableCells.length; i++) {
      const pos = passableCells[idx++];
      const isShrine = Math.random() < 0.5;
      const special: MapObject = {
        id: `underground_special_${i}`,
        type: isShrine ? 'shrine' : 'altar',
        x: pos.x,
        y: pos.y,
        level: 'underground',
        data: { bonus: isShrine ? '+2 attack' : '+1 morale' }
      };
      objects.push(special);
      map[pos.y][pos.x].object = special;
    }

    return objects;
  }

  /**
   * Детерминированный псевдослучайный генератор на основе позиции
   */
  private pseudoRandom(x: number, y: number): number {
    let seed = this.seed + x * 7919 + y * 104729;
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }

  /**
   * Перемешать массив (Fisher-Yates)
   */
  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.pseudoRandom(i, arr.length) * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
