export class SeededRandom {
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.seed = seed;
  }

  private next(): number {
    this.seed = (this.seed * 9301 + 49297) % 233280;
    return this.seed / 233280;
  }

  random(): number {
    return this.next();
  }

  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  randomChoice<T>(array: T[]): T {
    return array[Math.floor(this.random() * array.length)];
  }

  shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  chance(probability: number): boolean {
    return this.random() < probability;
  }

  setSeed(seed: number): void {
    this.seed = seed;
  }

  getSeed(): number {
    return this.seed;
  }
}

export const GameRandom = new SeededRandom();
