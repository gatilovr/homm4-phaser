import { Position, Tile } from '../types';

interface PathNode {
  x: number;
  y: number;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class Pathfinder {
  private map: Tile[][];
  private width: number;
  private height: number;

  constructor(map: Tile[][]) {
    this.map = map;
    this.height = map.length;
    this.width = map[0]?.length || 0;
  }

  findPath(start: Position, end: Position): Position[] {
    if (!this.isValidPosition(end) || !this.isPassable(end)) {
      return [];
    }

    const openSet: PathNode[] = [];
    const closedSet = new Set<string>();

    const startNode: PathNode = {
      x: start.x,
      y: start.y,
      g: 0,
      h: this.heuristic(start, end),
      f: 0,
      parent: null
    };
    startNode.f = startNode.g + startNode.h;
    openSet.push(startNode);

    const directions = [
      { x: 0, y: -1 },
      { x: 1, y: -1 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: -1, y: 1 },
      { x: -1, y: 0 },
      { x: -1, y: -1 }
    ];

    while (openSet.length > 0) {
      let currentIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openSet[currentIndex];

      if (current.x === end.x && current.y === end.y) {
        return this.reconstructPath(current);
      }

      openSet.splice(currentIndex, 1);
      closedSet.add(`${current.x},${current.y}`);

      for (const dir of directions) {
        const neighborX = current.x + dir.x;
        const neighborY = current.y + dir.y;

        if (!this.isValidPosition({ x: neighborX, y: neighborY })) continue;
        if (closedSet.has(`${neighborX},${neighborY}`)) continue;
        if (!this.isPassable({ x: neighborX, y: neighborY })) continue;

        if (dir.x !== 0 && dir.y !== 0) {
          if (!this.isPassable({ x: current.x + dir.x, y: current.y }) ||
              !this.isPassable({ x: current.x, y: current.y + dir.y })) {
            continue;
          }
        }

        const moveCost = this.getMoveCost({ x: neighborX, y: neighborY });
        const gScore = current.g + moveCost;

        const existingNode = openSet.find(n => n.x === neighborX && n.y === neighborY);
        
        if (!existingNode || gScore < existingNode.g) {
          const neighborNode: PathNode = {
            x: neighborX,
            y: neighborY,
            g: gScore,
            h: this.heuristic({ x: neighborX, y: neighborY }, end),
            f: gScore + this.heuristic({ x: neighborX, y: neighborY }, end),
            parent: current
          };

          if (!existingNode) {
            openSet.push(neighborNode);
          } else {
            existingNode.g = gScore;
            existingNode.f = gScore + existingNode.h;
            existingNode.parent = current;
          }
        }
      }
    }

    return [];
  }

  private heuristic(a: Position, b: Position): number {
    return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  }

  private isValidPosition(pos: Position): boolean {
    return pos.x >= 0 && pos.x < this.width && pos.y >= 0 && pos.y < this.height;
  }

  private isPassable(pos: Position): boolean {
    return this.map[pos.y]?.[pos.x]?.passable || false;
  }

  private getMoveCost(pos: Position): number {
    return this.map[pos.y]?.[pos.x]?.moveCost || 1;
  }

  private reconstructPath(node: PathNode): Position[] {
    const path: Position[] = [];
    let current: PathNode | null = node;
    while (current !== null) {
      path.unshift({ x: current.x, y: current.y });
      current = current.parent;
    }
    return path;
  }
}
