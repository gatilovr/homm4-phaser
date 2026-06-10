/**
 * Процедурный генератор объектов карты
 * Создаёт 50+ объектов с правильным зонированием
 */

import { MapObject, MapObjectType, MapLevel } from '../types';

export interface GenerationConfig {
  mapWidth: number;
  mapHeight: number;
  playerStartX: number;
  playerStartY: number;
  enemyTownPositions: { x: number; y: number }[];
  seed: number;
}

export class MapObjectGenerator {
  private objects: MapObject[] = [];
  private occupiedCells: Set<string> = new Set();
  private seed: number;

  constructor(config: GenerationConfig) {
    this.seed = config.seed;
    this.generateAll(config);
  }

  private random(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 9301 + 49297) % 233280;
      return s / 233280;
    };
  }

  private generateAll(config: GenerationConfig): void {
    const rand = this.random(this.seed);
    const { mapWidth, mapHeight, playerStartX, playerStartY } = config;

    // === 1. ГОРОДА ===
    // Стартовый город игрока (рядом с героем)
    this.addObject('town_1', 'town', playerStartX + 3, playerStartY, { faction: 'haven' });

    // Вражеские города
    config.enemyTownPositions.forEach((pos, i) => {
      this.addObject(`enemy_town_${i + 1}`, 'enemy_town', pos.x, pos.y, {
        faction: this.getRandomFaction(rand)
      });
    });

    // === 2. ШАХТЫ (12 штук, разных типов) ===
    const mineTypes = ['gold', 'gold', 'gold', 'wood', 'wood', 'ore', 'ore', 
                       'crystal', 'gems', 'sulfur', 'mercury', 'gold'];
    for (let i = 0; i < 12; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`mine_${i + 1}`, 'mine', pos.x, pos.y, { 
          type: mineTypes[i] 
        });
      }
    }

    // === 3. СУЩЕСТВА (20 штук, разных уровней) ===
    const creatureTypes = [
      'pikeman', 'archer', 'griffin', 'skeleton', 'zombie', 'wolf', 'elf',
      'goblin', 'orc', 'gremlin', 'golem', 'gnoll', 'lizardman',
      'cavalier', 'vampire', 'unicorn', 'minotaur', 'mage', 'troll'
    ];
    for (let i = 0; i < 20; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        const creature = creatureTypes[Math.floor(rand() * creatureTypes.length)];
        this.addObject(`creature_${i + 1}`, 'creature', pos.x, pos.y, {
          creatureId: creature,
          count: Math.floor(rand() * 20) + 5
        });
      }
    }

    // === 4. АРТЕФАКТЫ (8 штук) ===
    const artifactTiers = ['minor', 'minor', 'minor', 'major', 'major', 'relic'];
    for (let i = 0; i < 8; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`artifact_${i + 1}`, 'artifact', pos.x, pos.y, {
          tier: artifactTiers[Math.floor(rand() * artifactTiers.length)]
        });
      }
    }

    // === 5. РЕСУРСЫ (10 кучек) ===
    for (let i = 0; i < 10; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        const types = ['gold', 'wood', 'ore', 'crystal', 'gems', 'sulfur', 'mercury'];
        this.addObject(`resource_${i + 1}`, 'resource', pos.x, pos.y, {
          type: types[Math.floor(rand() * types.length)],
          amount: Math.floor(rand() * 1000) + 500
        });
      }
    }

    // === 6. ПОРТАЛЫ (4 пары) ===
    for (let i = 0; i < 4; i++) {
      const pos1 = this.findPosition(rand, mapWidth, mapHeight, 'far');
      const pos2 = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos1 && pos2) {
        this.addObject(`portal_${i * 2 + 1}`, 'portal', pos1.x, pos1.y, {
          pairId: `portal_${i * 2 + 2}`
        });
        this.addObject(`portal_${i * 2 + 2}`, 'portal', pos2.x, pos2.y, {
          pairId: `portal_${i * 2 + 1}`
        });
      }
    }

    // === 7. ШКОЛЫ МАГИИ (3 штуки, HoMM4 канон) ===
    const schools = ['life', 'death', 'order', 'chaos', 'natural', 'tactics'];
    for (let i = 0; i < 3; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`school_${i + 1}`, 'school', pos.x, pos.y, {
          school: schools[Math.floor(rand() * schools.length)]
        });
      }
    }

    // === 8. СВЕТИЛИЩА (4 штуки) ===
    for (let i = 0; i < 4; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        const blessings = ['attack', 'defense', 'spell_power', 'knowledge'];
        this.addObject(`shrine_${i + 1}`, 'shrine', pos.x, pos.y, {
          blessing: blessings[Math.floor(rand() * blessings.length)],
          value: Math.floor(rand() * 3) + 1
        });
      }
    }

    // === 9. АЛТАРИ (3 штуки) ===
    for (let i = 0; i < 3; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`altar_${i + 1}`, 'altar', pos.x, pos.y, {
          bonus: rand() > 0.5 ? 'morale' : 'luck',
          value: 1
        });
      }
    }

    // === 10. ОБЕЛИСКИ (5 штук) ===
    for (let i = 0; i < 5; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`obelisk_${i + 1}`, 'obelisk', pos.x, pos.y, {
          expReward: Math.floor(rand() * 1000) + 500
        });
      }
    }

    // === 11. ТАВЕРНЫ (2 штуки, слухи) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`tavern_${i + 1}`, 'tavern', pos.x, pos.y, {
          rumor: this.getRandomRumor(rand)
        });
      }
    }

    // === 12. ХИЖИНЫ ВЕДЬМ (2 штуки) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`witch_hut_${i + 1}`, 'witch_hut', pos.x, pos.y, {
          skill: this.getRandomSkill(rand)
        });
      }
    }

    // === 13. СУНДУКИ С СОКРОВИЩАМИ (6 штук) ===
    for (let i = 0; i < 6; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`chest_${i + 1}`, 'treasure_chest', pos.x, pos.y, {
          gold: Math.floor(rand() * 2000) + 1000,
          exp: Math.floor(rand() * 500) + 250
        });
      }
    }

    // === 14. ЛАГЕРЯ БЕЖЕНЦЕВ (2 штуки) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`refugee_${i + 1}`, 'refugee_camp', pos.x, pos.y, {
          creature: creatureTypes[Math.floor(rand() * creatureTypes.length)],
          count: Math.floor(rand() * 10) + 5
        });
      }
    }

    // === 15. ГАРНИЗОНЫ (3 штуки) ===
    for (let i = 0; i < 3; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`garrison_${i + 1}`, 'garrison', pos.x, pos.y, {
          creatures: [
            { id: creatureTypes[Math.floor(rand() * creatureTypes.length)], count: Math.floor(rand() * 15) + 10 },
            { id: creatureTypes[Math.floor(rand() * creatureTypes.length)], count: Math.floor(rand() * 10) + 5 }
          ]
        });
      }
    }

    // === 16. БИБЛИОТЕКИ (2 штуки) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`library_${i + 1}`, 'library', pos.x, pos.y, {
          spell: this.getRandomSpell(rand)
        });
      }
    }

    // === 17. ВОЛШЕБНЫЕ КОЛОДЦЫ (3 штуки) ===
    for (let i = 0; i < 3; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`well_${i + 1}`, 'magic_well', pos.x, pos.y, {
          manaRestore: Math.floor(rand() * 20) + 10
        });
      }
    }

    // === 18. ОАЗИСЫ (2 штуки) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`oasis_${i + 1}`, 'oasis', pos.x, pos.y, {
          movementBonus: 500
        });
      }
    }

    // === 19. ВЕТРЯНЫЕ МЕЛЬНИЦЫ (3 штуки) ===
    for (let i = 0; i < 3; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`windmill_${i + 1}`, 'windmill', pos.x, pos.y, {
          goldPerWeek: 500
        });
      }
    }

    // === 20. ВОДЯНЫЕ КОЛЁСА (2 штуки) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`waterwheel_${i + 1}`, 'water_wheel', pos.x, pos.y, {
          goldPerWeek: 750
        });
      }
    }

    console.log(`[MapObjectGenerator] Создано ${this.objects.length} объектов`);
  }

  private addObject(id: string, type: MapObjectType, x: number, y: number, data?: any): void {
    const key = `${x},${y}`;
    if (this.occupiedCells.has(key)) return;
    
    this.occupiedCells.add(key);
    this.objects.push({ id, type, x, y, data, level: 'surface' as MapLevel });
  }

  private findPosition(
    rand: () => number,
    mapW: number,
    mapH: number,
    distance: 'near' | 'medium' | 'far' | 'any'
  ): { x: number; y: number } | null {
    const maxAttempts = 50;
    
    for (let i = 0; i < maxAttempts; i++) {
      const x = Math.floor(rand() * mapW);
      const y = Math.floor(rand() * mapH);
      const key = `${x},${y}`;
      
      if (this.occupiedCells.has(key)) continue;
      
      // Проверяем расстояние от центра
      const centerX = mapW / 2;
      const centerY = mapH / 2;
      const dist = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      
      const maxDist = Math.min(mapW, mapH) / 2;
      
      let valid = true;
      switch (distance) {
        case 'near': valid = dist < maxDist * 0.3; break;
        case 'medium': valid = dist >= maxDist * 0.2 && dist < maxDist * 0.6; break;
        case 'far': valid = dist >= maxDist * 0.4; break;
        case 'any': valid = true; break;
      }
      
      if (valid) return { x, y };
    }
    
    return null;
  }

  private getRandomFaction(rand: () => number): string {
    const factions = ['necropolis', 'preserve', 'asylum', 'academy', 'stronghold'];
    return factions[Math.floor(rand() * factions.length)];
  }

  private getRandomRumor(rand: () => number): string {
    const rumors = [
      'Говорят, на севере есть древний артефакт...',
      'Враг слаб на востоке, атакуй там!',
      'В подземелье спрятано золото...',
      'Дракон охраняет сокровища на юге...',
      'Магическая школа появилась в лесу...',
      'Беженцы ищут убежища у озера...'
    ];
    return rumors[Math.floor(rand() * rumors.length)];
  }

  private getRandomSkill(rand: () => number): string {
    const skills = ['offense', 'defense', 'archery', 'wisdom', 'logistics', 'pathfinding'];
    return skills[Math.floor(rand() * skills.length)];
  }

  private getRandomSpell(rand: () => number): string {
    // Заклинания HoMM4 (канон) из разных школ
    const spells = ['fireball', 'lightning', 'heal', 'bless', 'resurrect', 'haste', 'slow', 'shield', 'teleport', 'blind', 'bloodlust', 'fly'];
    return spells[Math.floor(rand() * spells.length)];
  }

  public getObjects(): MapObject[] {
    return this.objects;
  }

  public getObjectById(id: string): MapObject | undefined {
    return this.objects.find(obj => obj.id === id);
  }
}
