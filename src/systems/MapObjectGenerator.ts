/**
 * Процедурный генератор объектов карты
 * Создаёт 60+ объектов с правильным зонированием
 * 
 * Канон HoMM4: нейтральные существа спавнятся по тирам,
 * чем дальше от стартового города — сильнее стражи.
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
    this.addObject('town_1', 'town', playerStartX + 3, playerStartY, { faction: 'haven' });

    config.enemyTownPositions.forEach((pos, i) => {
      this.addObject(`enemy_town_${i + 1}`, 'enemy_town', pos.x, pos.y, {
        faction: this.getRandomFaction(rand)
      });
    });

    // === 2. ШАХТЫ (12 штук) ===
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

    // === 3. НЕЙТРАЛЬНЫЕ СУЩЕСТВА (35 штук, по тирам из канона HoMM4) ===
    // Тир 1: слабые (поблизости от стартового города)
    const tier1Neutrals = ['peasant', 'halfling_neutral', 'boar', 'goblin', 'wolf_neutral', 'zombie', 'skeleton_neutral'];
    // Тир 2: средние
    const tier2Neutrals = ['bandit_neutral', 'nomad_neutral', 'nymph', 'satyr', 'blind_monk', 'ice_elemental', 'fire_elemental', 'earth_elemental', 'air_elemental'];
    // Тир 3: сильные
    const tier3Neutrals = ['troll', 'mummy', 'ogre_neutral', 'sea_serpent', 'griffin_neutral', 'wizard_neutral'];
    // Тир 4: элитные
    const tier4Neutrals = ['behemoth_neutral', 'dragon_neutral', 'hydra_neutral', 'angel_neutral', 'devil_neutral', 'phoenix_neutral'];
    // Тир 5: легендарные (края карты)
    const tier5Neutrals = ['azure_dragon', 'rust_dragon', 'crystal_dragon', 'faerie_dragon_neutral'];

    const maxDist = Math.sqrt(Math.pow(mapWidth, 2) + Math.pow(mapHeight, 2));

    for (let i = 0; i < 35; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        const distFromStart = Math.sqrt(
          Math.pow(pos.x - playerStartX, 2) + Math.pow(pos.y - playerStartY, 2)
        );
        const distanceRatio = distFromStart / maxDist;

        let creaturePool: string[];
        let countMin: number;
        let countMax: number;

        if (distanceRatio < 0.15) {
          creaturePool = tier1Neutrals;
          countMin = 8; countMax = 20;
        } else if (distanceRatio < 0.35) {
          creaturePool = rand() < 0.5 ? tier1Neutrals : tier2Neutrals;
          countMin = 5; countMax = 15;
        } else if (distanceRatio < 0.55) {
          creaturePool = rand() < 0.6 ? tier2Neutrals : tier3Neutrals;
          countMin = 3; countMax = 12;
        } else if (distanceRatio < 0.75) {
          creaturePool = rand() < 0.5 ? tier3Neutrals : tier4Neutrals;
          countMin = 2; countMax = 8;
        } else {
          creaturePool = rand() < 0.7 ? tier4Neutrals : tier5Neutrals;
          countMin = 1; countMax = 5;
        }

        const creature = creaturePool[Math.floor(rand() * creaturePool.length)];
        const count = countMin + Math.floor(rand() * (countMax - countMin));

        this.addObject(`creature_${i + 1}`, 'creature', pos.x, pos.y, {
          creatureId: creature,
          count: count
        });
      }
    }

    // === 3b. Стражи шахт (охраняют ресурсы) ===
    const mineGuardPools: Record<string, string[]> = {
      'gold': ['bandit_neutral', 'ogre_neutral', 'cyclops_h4'],
      'wood': ['troll', 'mummy'],
      'ore': ['earth_elemental', 'stone_golem'],
      'crystal': ['ice_elemental', 'fire_elemental'],
      'gems': ['air_elemental', 'fire_elemental'],
      'sulfur': ['dragon_neutral', 'behemoth_neutral'],
      'mercury': ['wizard_neutral', 'angel_neutral']
    };

    // Стражи ставятся рядом с шахтами (offset 1-2 клетки)
    for (let i = 0; i < 12; i++) {
      const mineObj = this.objects.find(o => o.id === `mine_${i + 1}`);
      if (mineObj) {
        const mineType = mineTypes[i];
        const pool = mineGuardPools[mineType] || tier2Neutrals;
        const guardCreature = pool[Math.floor(rand() * pool.length)];
        const guardCount = 3 + Math.floor(rand() * 8);

        // Ищем свободную клетку рядом с шахтой
        const offsets = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]];
        for (const [dx, dy] of offsets) {
          const gx = mineObj.x + dx;
          const gy = mineObj.y + dy;
          const gkey = `${gx},${gy}`;
          if (!this.occupiedCells.has(gkey) && gx >= 0 && gx < mapWidth && gy >= 0 && gy < mapHeight) {
            this.addObject(`mine_guard_${i + 1}`, 'creature', gx, gy, {
              creatureId: guardCreature,
              count: guardCount
            });
            break;
          }
        }
      }
    }

    // === 4. АРТЕФАКТЫ (8 штук) ===
    const artifactTiers = ['minor', 'minor', 'minor', 'major', 'major', 'major', 'relic', 'relic'];
    for (let i = 0; i < 8; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`artifact_${i + 1}`, 'artifact', pos.x, pos.y, {
          tier: artifactTiers[i]
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

    // === 7. ШКОЛЫ МАГИИ (3 штуки) ===
    const schools = ['life', 'death', 'order', 'chaos', 'natural'];
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

    // === 11. ТАВЕРНЫ (2 штуки) ===
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
        const allNeutrals = [...tier1Neutrals, ...tier2Neutrals];
        this.addObject(`refugee_${i + 1}`, 'refugee_camp', pos.x, pos.y, {
          creature: allNeutrals[Math.floor(rand() * allNeutrals.length)],
          count: Math.floor(rand() * 10) + 5
        });
      }
    }

    // === 15. ГАРНИЗОНЫ (3 штуки) ===
    for (let i = 0; i < 3; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        const pool = [...tier2Neutrals, ...tier3Neutrals];
        this.addObject(`garrison_${i + 1}`, 'garrison', pos.x, pos.y, {
          creatures: [
            { id: pool[Math.floor(rand() * pool.length)], count: Math.floor(rand() * 15) + 10 },
            { id: pool[Math.floor(rand() * pool.length)], count: Math.floor(rand() * 10) + 5 }
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

    // === 21. ВНЕШНИЕ ЖИЛИЩА (10 штук, канон HoMM4 — еженедельный прирост) ===
    const dwellingDefs = [
      { definitionId: 'hill_fort', name: 'Холмная крепость' },
      { definitionId: 'dwarven_cottage', name: 'Домик гномов' },
      { definitionId: 'gnoll_hollow', name: 'Логово гноллов' },
      { definitionId: 'cyclops_cave', name: 'Пещера циклопов' },
      { definitionId: 'dragon_cave', name: 'Логово драконов' },
      { definitionId: 'elemental_altar', name: 'Алтарь элементалей' },
      { definitionId: 'haven_outpost', name: 'Дозорный пост' },
      { definitionId: 'necro_grave', name: 'Старое кладбище' },
      { definitionId: 'preserve_wolf_den', name: 'Волчье логово' },
      { definitionId: 'academy_workshop', name: 'Мастерская' },
    ];
    for (let i = 0; i < dwellingDefs.length; i++) {
      const dwelling = dwellingDefs[i];
      const pos = this.findPosition(rand, mapWidth, mapHeight, i < 4 ? 'medium' : 'far');
      if (pos) {
        this.addObject(`dwelling_${dwelling.definitionId}`, 'dwelling', pos.x, pos.y, {
          definitionId: dwelling.definitionId,
          dwellingName: dwelling.name,
          owner: 'neutral',
          bankedCreatures: Math.floor(rand() * 8) + 3,
          isUpgraded: false,
          lastGrowthDay: 0
        });
      }
    }

    // === 22. ЗЕЛЬЯ НА КАРТЕ (3-5 штук, канон HoMM4) ===
    const potionPool = [
      { id: 'healing_potion', name: 'Зелье лечения', effect: 'heal', value: 50 },
      { id: 'mana_potion', name: 'Зелье маны', effect: 'restore_mana', value: 30 },
      { id: 'minor_healing', name: 'Малое зелье лечения', effect: 'heal', value: 100 },
      { id: 'attack_potion', name: 'Зелье ярости', effect: 'boost_attack', value: 5, duration: 3 },
      { id: 'defense_potion', name: 'Зелье защиты', effect: 'boost_defense', value: 5, duration: 3 },
    ];
    const potionCount = 3 + Math.floor(rand() * 3); // 3-5 зелий
    for (let i = 0; i < potionCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        const potion = potionPool[Math.floor(rand() * potionPool.length)];
        this.addObject(`potion_${i + 1}`, 'resource', pos.x, pos.y, {
          type: 'potion',
          potionId: potion.id,
          potionName: potion.name,
          effect: potion.effect,
          value: potion.value,
          duration: potion.duration
        });
      }
    }

    // === 23. КОСТРЫ (Campfires) — золото/ресурсы (канон HoMM4) ===
    const campfireCount = 5 + Math.floor(rand() * 4); // 5-8 костров
    for (let i = 0; i < campfireCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        const goldAmount = 200 + Math.floor(rand() * 800); // 200-1000 золота
        this.addObject(`campfire_${i + 1}`, 'resource', pos.x, pos.y, {
          type: 'campfire',
          gold: goldAmount,
          name: 'Костёр'
        });
      }
    }

    // === 24. ОБСЕРВАТОРИИ (Observation Towers) — раскрывают область (канон HoMM4) ===
    const towerCount = 3 + Math.floor(rand() * 2); // 3-4 обсерватории
    for (let i = 0; i < towerCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`observation_tower_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'observation_tower',
          revealRadius: 5,
          name: 'Обсерватория'
        });
      }
    }

    // === 25. КАМЕННЫЕ ГРАНИТЫ (Stone Rocks) — бонус к характеристикам (канон HoMM4) ===
    const rockBonusTypes = ['attack', 'defense', 'spell_power', 'knowledge'];
    for (let i = 0; i < 4; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`rock_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'stat_rock',
          bonus: rockBonusTypes[i],
          value: 1,
          name: `Камень ${rockBonusTypes[i] === 'attack' ? 'силы' : rockBonusTypes[i] === 'defense' ? 'защиты' : rockBonusTypes[i] === 'spell_power' ? 'магии' : 'знания'}`
        });
      }
    }

    // === 26. БОГАТЫЕ ШАХТЫ (Rich Mines) — дополнительный доход (канон HoMM4) ===
    for (let i = 0; i < 2; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`rich_mine_${i + 1}`, 'mine', pos.x, pos.y, {
          type: 'gold',
          dailyIncome: 1500, // Богатая шахта: +500 к обычной
          name: 'Богатая золотая шахта'
        });
      }
    }

    // === 27. ИЗБЫ СЕРА (Seer Huts) — случайные квесты (канон HoMM4) ===
    const questTypes = [
      { type: 'kill_creatures', target: 'bandit_neutral', count: 10, reward: { gold: 2000, exp: 500 } },
      { type: 'collect_artifacts', count: 2, reward: { gold: 1500, exp: 300 } },
      { type: 'visit_town', reward: { gold: 1000, exp: 200 } },
      { type: 'level_up', targetLevel: 5, reward: { gold: 3000, exp: 1000 } },
    ];
    const seerCount = 3 + Math.floor(rand() * 2); // 3-4 избы
    for (let i = 0; i < seerCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        const quest = questTypes[Math.floor(rand() * questTypes.length)];
        this.addObject(`seer_hut_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'seer_hut',
          quest: quest.type,
          questTarget: quest.target,
          questCount: quest.count,
          questTargetLevel: quest.targetLevel,
          reward: quest.reward,
          completed: false,
          name: 'Изба Старца'
        });
      }
    }

    // === 28. ОБЕЛИСКИ ЗНАНИЯ (Learning Stones) — +опыт (канон HoMM4) ===
    const learningStoneCount = 4 + Math.floor(rand() * 3); // 4-6 камней
    for (let i = 0; i < learningStoneCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`learning_stone_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'learning_stone',
          expBonus: 500 + Math.floor(rand() * 1000),
          name: 'Камень знаний'
        });
      }
    }

    // === 29. КОПИ (Blacksmith) — +артефакт (канон HoMM4) ===
    const blacksmithCount = 2;
    for (let i = 0; i < blacksmithCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`blacksmith_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'blacksmith',
          artifactTier: 'minor',
          name: 'Кузнец'
        });
      }
    }

    // === 30. РЫБАЦКИЕ ХИЖИНЫ (Fishing Villages) — +золото (канон HoMM4) ===
    const fishingCount = 2;
    for (let i = 0; i < fishingCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`fishing_village_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'fishing_village',
          goldBonus: 500 + Math.floor(rand() * 500),
          name: 'Рыбацкая деревня'
        });
      }
    }

    // === 31. КОНЮШНИ (Stables) — +очки движения (канон HoMM4) ===
    const stableCount = 2;
    for (let i = 0; i < stableCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`stables_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'stables',
          movementBonus: 400,
          name: 'Конюшни'
        });
      }
    }

    // === 32. АРЕНЫ (Arena) — +статы на выбор (канон HoMM4) ===
    const arenaCount = 2;
    for (let i = 0; i < arenaCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`arena_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'arena',
          statBonus: 'random', // +2 к случайному стату
          name: 'Арена'
        });
      }
    }

    // === 33. ХОЛМОВЫЕ ФОРТЫ (Hill Fort) — апгрейд существ (канон HoMM4) ===
    const hillFortCount = 1;
    for (let i = 0; i < hillFortCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`hill_fort_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'hill_fort',
          upgradeDiscount: 0.5, // -50% стоимость улучшения
          name: 'Холмовой форт'
        });
      }
    }

    // === 34. ПИРАМИДЫ (Pyramids) — бой + заклинание (канон HoMM4) ===
    const pyramidCount = 1;
    for (let i = 0; i < pyramidCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`pyramid_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'pyramid',
          spellReward: 'random',
          guardStrength: 'strong',
          name: 'Пирамида'
        });
      }
    }

    // === 35. ДРАКОНЬЯ УТОПИЯ (Dragon's Utopia) — сильный бой + награда (канон HoMM4) ===
    const utopiaCount = 1;
    for (let i = 0; i < utopiaCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'far');
      if (pos) {
        this.addObject(`dragon_utopia_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'dragons_utopia',
          guardStrength: 'legendary',
          reward: { gold: 5000, artifacts: 2 },
          name: 'Драконья Утопия'
        });
      }
    }

    // === 36. УЧЁНЫЕ (Scholars) — +навык или +заклинание (канон HoMM4) ===
    const scholarCount = 2;
    for (let i = 0; i < scholarCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'medium');
      if (pos) {
        this.addObject(`scholar_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'scholar',
          rewardType: Math.random() > 0.5 ? 'skill' : 'spell',
          name: 'Учёный'
        });
      }
    }

    // === 37. ИСТОЧНИКИ (Wells) — +мана/лечение (канон HoMM4) ===
    const wellCount = 3;
    for (let i = 0; i < wellCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`magic_well_${i + 1}`, 'shrine', pos.x, pos.y, {
          type: 'magic_well',
          manaRestore: 20 + Math.floor(rand() * 20),
          name: 'Волшебный колодец'
        });
      }
    }

    // === 38. БОГАТЫЕ СУНДУКИ (Treasure Chests) — золото или артефакт (канон HoMM4) ===
    const richChestCount = 4;
    for (let i = 0; i < richChestCount; i++) {
      const pos = this.findPosition(rand, mapWidth, mapHeight, 'any');
      if (pos) {
        this.addObject(`rich_chest_${i + 1}`, 'treasure_chest', pos.x, pos.y, {
          type: 'treasure_chest',
          gold: 1000 + Math.floor(rand() * 2000),
          exp: 500 + Math.floor(rand() * 1000),
          name: 'Сундук с сокровищами'
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
