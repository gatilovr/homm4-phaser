import Phaser from 'phaser';
import { CONFIG } from '../config';
import { contentManager } from '../systems/ContentManager';

/**
 * PreloadScene — загрузка всех JSON-данных игры.
 * Данные хранятся в public/assets/data/ и загружаются через load.json().
 * В случае ошибки загрузки используются fallback-данные.
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: CONFIG.SCENES.PRELOAD });
  }

  preload(): void {
    console.log('[PreloadScene] === PRELOAD STARTED ===');

    const { width, height } = this.scale;

    // Фон загрузки
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0f, 1);
    
    const titleText = this.add.text(width / 2, height / 2 - 80, 'ГЕРОИ МЕЧА И МАГИИ IV', {
      fontSize: '36px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const loadingText = this.add.text(width / 2, height / 2 - 20, 'Загрузка...', {
      fontSize: '20px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI'
    }).setOrigin(0.5);

    // Прогресс бар
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 + 10, 320, 30);

    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0xd4af37, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 + 20, 300 * value, 10);
      loadingText.setText(`Загрузка... ${Math.floor(value * 100)}%`);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.setText('Готово!');
    });

    // === ЗАГРУЗКА JSON ДАННЫХ ===
    // Все файлы лежат в public/assets/data/
    this.load.json('factions', 'assets/data/factions.json');
    this.load.json('spells', 'assets/data/spells.json');
    this.load.json('artifacts', 'assets/data/artifacts.json');
    this.load.json('buildings', 'assets/data/buildings.json');
    this.load.json('creatures', 'assets/data/creatures.json');
    this.load.json('skills', 'assets/data/skills.json');

    console.log('[PreloadScene] JSON files queued for loading');

    // Обработка ошибок загрузки
    this.load.on('loaderror', (file: any) => {
      console.warn(`[PreloadScene] ⚠️ Не удалось загрузить ${file.key}:`, file.url);
    });
  }

  create(): void {
    console.log('[PreloadScene] === CREATE STARTED ===');

    const { width, height } = this.scale;

    // Загружаем данные из кэша Phaser
    let factions = this.cache.json.get('factions');
    let spells = this.cache.json.get('spells');
    let artifacts = this.cache.json.get('artifacts');
    let buildings = this.cache.json.get('buildings');
    let creatures = this.cache.json.get('creatures');
    let skills = this.cache.json.get('skills');

    // Fallback если что-то не загрузилось
    if (!factions) {
      console.warn('[PreloadScene] factions.json не загрузился, используем fallback');
      factions = this.getFallbackFactions();
    }
    if (!spells) {
      console.warn('[PreloadScene] spells.json не загрузился, используем fallback');
      spells = this.getFallbackSpells();
    }
    if (!artifacts) {
      console.warn('[PreloadScene] artifacts.json не загрузился, используем fallback');
      artifacts = this.getFallbackArtifacts();
    }
    if (!buildings) {
      console.warn('[PreloadScene] buildings.json не загрузился, используем fallback');
      buildings = this.getFallbackBuildings();
    }
    if (!creatures) {
      console.warn('[PreloadScene] creatures.json не загрузился, используем fallback');
      creatures = this.getFallbackCreatures();
    }
    if (!skills) {
      console.warn('[PreloadScene] skills.json не загрузился, используем fallback');
      skills = this.getFallbackSkills();
    }

    // Сохраняем в registry для доступа из других сцен
    this.registry.set('factions', factions);
    this.registry.set('spells', spells);
    this.registry.set('artifacts', artifacts);
    this.registry.set('buildings', buildings);
    this.registry.set('creatures', creatures);
    this.registry.set('skills', skills);

    console.log('[PreloadScene] ✓ Данные загружены в registry:');
    console.log('[PreloadScene]   factions:', factions ? `${factions.factions?.length || 0} фракций` : 'MISSING');
    console.log('[PreloadScene]   spells:', spells?.spells ? `${spells.spells.length} заклинаний` : 'MISSING');
    console.log('[PreloadScene]   artifacts:', artifacts?.artifacts ? `${artifacts.artifacts.length} артефактов` : 'MISSING');
    console.log('[PreloadScene]   buildings:', buildings?.buildings ? `${buildings.buildings.length} зданий` : 'MISSING');
    console.log('[PreloadScene]   creatures:', creatures?.creatures ? `${creatures.creatures.length} существ` : 'MISSING');
    console.log('[PreloadScene]   skills:', skills?.skills ? `${skills.skills.length} навыков` : 'MISSING');

    // === ИНИЦИАЛИЗАЦИЯ CONTENT MANAGER ===
    // ContentManager будет использовать данные из fetch, а fallback возьмёт из registry
    console.log('[PreloadScene] → Инициализация ContentManager...');

    // Переход в меню через 800мс (ContentManager загрузится параллельно)
    this.time.delayedCall(800, async () => {
      try {
        await contentManager.loadAll();
        console.log('[PreloadScene] ✅ ContentManager готов!');
        console.log('[PreloadScene] Статистика:', contentManager.getStats());
      } catch (err) {
        console.warn('[PreloadScene] ⚠️ ContentManager fallback:', err);
      }
      
      console.log('[PreloadScene] → Переход в MenuScene');
      this.scene.start(CONFIG.SCENES.MENU);
    });
  }

  // ==================== FALLBACK ДАННЫЕ ====================

  private getFallbackFactions(): any {
    return {
      haven: {
        id: 'haven',
        name: 'Убежище',
        description: 'Защитники света и порядка',
        creatures: ['pikeman', 'archer', 'griffin', 'knight', 'angel']
      },
      necropolis: {
        id: 'necropolis',
        name: 'Некрополис',
        description: 'Властелины нежити',
        creatures: ['skeleton', 'zombie', 'vampire', 'lich', 'bone_dragon']
      },
      preserve: {
        id: 'preserve',
        name: 'Заповедник',
        description: 'Хранители природы',
        creatures: ['wolf', 'elf', 'unicorn', 'druid', 'phoenix']
      },
      asylum: {
        id: 'asylum',
        name: 'Азилум',
        description: 'Варвары и монстры',
        creatures: ['goblin', 'orc', 'ogre', 'cyclops', 'behemoth']
      },
      academy: {
        id: 'academy',
        name: 'Академия',
        description: 'Мастера магии',
        creatures: ['golem', 'mage', 'genie', 'naga', 'titan']
      },
      stronghold: {
        id: 'stronghold',
        name: 'Крепость',
        description: 'Воины севера',
        creatures: ['wolf_rider', 'troll', 'yeti', 'thunder_bird', 'cyclops_king']
      }
    };
  }

  private getFallbackSpells(): any {
    // Школы магии HoMM4 (канон): Life, Death, Order, Chaos, Natural
    return [
      // === LIFE (Жизнь) ===
      { id: 'bless', name: 'Благословение', school: 'life', level: 1, manaCost: 5, description: '+20% урона' },
      { id: 'heal', name: 'Исцеление', school: 'life', level: 2, manaCost: 8, description: 'Восстанавливает HP' },
      { id: 'resurrect', name: 'Воскрешение', school: 'life', level: 4, manaCost: 25, description: 'Возрождает павших' },
      // === ORDER (Порядок) ===
      { id: 'haste', name: 'Ускорение', school: 'order', level: 1, manaCost: 6, description: '+50% скорости' },
      { id: 'shield', name: 'Щит', school: 'order', level: 1, manaCost: 5, description: '+30% защиты' },
      { id: 'teleport', name: 'Телепорт', school: 'order', level: 3, manaCost: 12, description: 'Переместить юнита' },
      { id: 'blind', name: 'Ослепление', school: 'order', level: 2, manaCost: 8, description: 'Пропуск хода' },
      { id: 'forget', name: 'Забывчивость', school: 'order', level: 2, manaCost: 8, description: 'Стрелок не стреляет' },
      { id: 'clone', name: 'Клон', school: 'order', level: 4, manaCost: 20, description: 'Создать копию' },
      { id: 'slow', name: 'Замедление', school: 'order', level: 1, manaCost: 6, description: '-50% скорости' },
      // === CHAOS (Хаос) ===
      { id: 'lightning', name: 'Молния', school: 'chaos', level: 2, manaCost: 10, description: 'Удар молнией' },
      { id: 'chain_lightning', name: 'Цепная молния', school: 'chaos', level: 3, manaCost: 15, description: 'По нескольким целям' },
      { id: 'fireball', name: 'Огненный шар', school: 'chaos', level: 3, manaCost: 12, description: 'Область 3×3' },
      { id: 'meteor', name: 'Метеор', school: 'chaos', level: 4, manaCost: 20, description: 'Область 3×3' },
      { id: 'armageddon', name: 'Армагеддон', school: 'chaos', level: 5, manaCost: 30, description: 'По всему полю' },
      { id: 'berserk', name: 'Берсерк', school: 'chaos', level: 3, manaCost: 15, description: 'Атакует кого угодно' },
      { id: 'bloodlust', name: 'Жажда крови', school: 'chaos', level: 1, manaCost: 6, description: '+атака ближний бой' },
      // === NATURAL (Природа) ===
      { id: 'stone_skin', name: 'Каменная кожа', school: 'natural', level: 1, manaCost: 7, description: '+5 защиты' },
      { id: 'dispel', name: 'Развеять', school: 'natural', level: 1, manaCost: 5, description: 'Снять эффекты' },
      { id: 'fly', name: 'Полёт', school: 'natural', level: 3, manaCost: 12, description: 'Летать 3 хода' },
      { id: 'town_portal', name: 'Портал города', school: 'order', level: 5, manaCost: 20, description: 'На карту' }
    ];
  }

  private getFallbackArtifacts(): any {
    return [
      { id: 'sword_of_might', name: 'Меч силы', slot: 'weapon', rarity: 'minor', attack: 2, description: '+2 АТК' },
      { id: 'shield_of_protection', name: 'Щит защиты', slot: 'shield', rarity: 'minor', defense: 2, description: '+2 ЗАЩ' },
      { id: 'ring_of_wisdom', name: 'Кольцо мудрости', slot: 'ring', rarity: 'major', spellPower: 3, description: '+3 Сила магии' },
      { id: 'helm_of_heavenly', name: 'Небесный шлем', slot: 'head', rarity: 'major', morale: 1, luck: 1, description: '+1 мораль, +1 удача' },
      { id: 'boots_of_speed', name: 'Сапоги скорости', slot: 'feet', rarity: 'minor', movement: 5, description: '+5 движения' },
      { id: 'cloak_of_undead', name: 'Плащ нежити', slot: 'cloak', rarity: 'relic', necromancy: 20, description: '+20% некромантии' },
      { id: 'amulet_of_mana', name: 'Амулет маны', slot: 'neck', rarity: 'minor', mana: 5, description: '+5 маны/день' },
      { id: 'breastplate_of_brimestone', name: 'Серная кираса', slot: 'body', rarity: 'major', defense: 5, description: '+5 ЗАЩ' },
      { id: 'bow_of_elven', name: 'Эльфийский лук', slot: 'weapon', rarity: 'major', attack: 3, archery: 10, description: '+3 АТК, +10% лучники' },
      { id: 'tome_of_fire', name: 'Книга огня', slot: 'misc', rarity: 'relic', fire_spells: true, description: 'Все заклинания огня' }
    ];
  }

  private getFallbackBuildings(): any {
    return {
      haven: [
        { id: 'citadel', name: 'Цитадель', cost: {}, requirements: [], description: 'Центр города' },
        { id: 'barracks', name: 'Казармы', cost: { gold: 1000, wood: 5 }, requirements: ['citadel'], creature: 'pikeman' },
        { id: 'archery_range', name: 'Стрельбище', cost: { gold: 2000, wood: 10 }, requirements: ['barracks'], creature: 'archer' },
        { id: 'griffin_tower', name: 'Башня грифонов', cost: { gold: 3000, wood: 5, ore: 5 }, requirements: ['archery_range'], creature: 'griffin' },
        { id: 'jousting_arena', name: 'Ристалище', cost: { gold: 5000, wood: 10, ore: 10 }, requirements: ['griffin_tower'], creature: 'knight' },
        { id: 'portal_of_glory', name: 'Портал славы', cost: { gold: 10000, crystal: 5, gems: 5 }, requirements: ['jousting_arena'], creature: 'angel' },
        { id: 'marketplace', name: 'Рынок', cost: { gold: 500, wood: 5 }, requirements: ['citadel'] },
        { id: 'blacksmith', name: 'Кузница', cost: { gold: 1000, ore: 5 }, requirements: ['citadel'] },
        { id: 'mage_guild_1', name: 'Гильдия магов 1', cost: { gold: 2000, wood: 5 }, requirements: ['citadel'] },
        { id: 'tavern', name: 'Таверна', cost: { gold: 500, wood: 5 }, requirements: ['citadel'] }
      ],
      necropolis: [
        { id: 'citadel', name: 'Цитадель', cost: {}, requirements: [] },
        { id: 'cursed_temple', name: 'Проклятый храм', cost: { gold: 1000, wood: 5 }, requirements: ['citadel'], creature: 'skeleton' },
        { id: 'graveyard', name: 'Кладбище', cost: { gold: 1500, wood: 5 }, requirements: ['cursed_temple'], creature: 'zombie' },
        { id: 'mausoleum', name: 'Мавзолей', cost: { gold: 3000, ore: 10 }, requirements: ['graveyard'], creature: 'vampire' },
        { id: 'tomb_of_souls', name: 'Гробница душ', cost: { gold: 5000, crystal: 5 }, requirements: ['mausoleum'], creature: 'lich' },
        { id: 'dragon_vault', name: 'Склеп дракона', cost: { gold: 15000, sulfur: 10, mercury: 10 }, requirements: ['tomb_of_souls'], creature: 'bone_dragon' },
        { id: 'marketplace', name: 'Рынок', cost: { gold: 500, wood: 5 }, requirements: ['citadel'] },
        { id: 'blacksmith', name: 'Кузница', cost: { gold: 1000, ore: 5 }, requirements: ['citadel'] },
        { id: 'tavern', name: 'Таверна', cost: { gold: 500, wood: 5 }, requirements: ['citadel'] }
      ]
    };
  }

  private getFallbackSkills(): any {
    return {
      skills: [
        { id: 'offense', name: 'Наступление', category: 'combat', icon: '⚔️', maxLevel: 3, description: '+урон ближнего боя', effects: [
          { level: 1, type: 'melee_damage_bonus', value: 10, description: '+10% урон ближнего боя' },
          { level: 2, type: 'melee_damage_bonus', value: 20, description: '+20% урон ближнего боя' },
          { level: 3, type: 'melee_damage_bonus', value: 30, description: '+30% урон ближнего боя' }
        ]},
        { id: 'defense_skill', name: 'Оборона', category: 'combat', icon: '🛡️', maxLevel: 3, description: '-получаемый урон', effects: [
          { level: 1, type: 'damage_reduction', value: 10, description: '-10% урона' },
          { level: 2, type: 'damage_reduction', value: 20, description: '-20% урона' },
          { level: 3, type: 'damage_reduction', value: 30, description: '-30% урона' }
        ]},
        { id: 'archery', name: 'Стрельба', category: 'combat', icon: '🏹', maxLevel: 3, description: '+урон стрелков', effects: [
          { level: 1, type: 'ranged_damage_bonus', value: 10, description: '+10% урон стрелков' },
          { level: 2, type: 'ranged_damage_bonus', value: 25, description: '+25% урон стрелков' },
          { level: 3, type: 'ranged_damage_bonus', value: 50, description: '+50% урон стрелков' }
        ]},
        { id: 'leadership', name: 'Лидерство', category: 'combat', icon: '👑', maxLevel: 3, description: '+мораль', effects: [
          { level: 1, type: 'morale_bonus', value: 1, description: '+1 мораль' },
          { level: 2, type: 'morale_bonus', value: 2, description: '+2 мораль' },
          { level: 3, type: 'morale_bonus', value: 3, description: '+3 мораль' }
        ]},
        { id: 'luck', name: 'Удача', category: 'combat', icon: '🍀', maxLevel: 3, description: '+удача', effects: [
          { level: 1, type: 'luck_bonus', value: 1, description: '+1 удача' },
          { level: 2, type: 'luck_bonus', value: 2, description: '+2 удача' },
          { level: 3, type: 'luck_bonus', value: 3, description: '+3 удача' }
        ]},
        { id: 'wisdom', name: 'Мудрость', category: 'magic', icon: '📖', maxLevel: 3, description: 'доступ к заклинаниям', effects: [
          { level: 1, type: 'spell_level_access', value: 3, description: 'Заклинания 3 уровня' },
          { level: 2, type: 'spell_level_access', value: 4, description: 'Заклинания 4 уровня' },
          { level: 3, type: 'spell_level_access', value: 5, description: 'Заклинания 5 уровня' }
        ]},
        { id: 'intelligence', name: 'Интеллект', category: 'magic', icon: '🧠', maxLevel: 3, description: '+мана', effects: [
          { level: 1, type: 'mana_bonus_percent', value: 25, description: '+25% маны' },
          { level: 2, type: 'mana_bonus_percent', value: 50, description: '+50% маны' },
          { level: 3, type: 'mana_bonus_percent', value: 100, description: '+100% маны' }
        ]},
        { id: 'sorcery', name: 'Колдовство', category: 'magic', icon: '✨', maxLevel: 3, description: '+урон заклинаний', effects: [
          { level: 1, type: 'spell_damage_bonus', value: 10, description: '+10% урон' },
          { level: 2, type: 'spell_damage_bonus', value: 20, description: '+20% урон' },
          { level: 3, type: 'spell_damage_bonus', value: 30, description: '+30% урон' }
        ]},
        { id: 'mysticism', name: 'Мистицизм', category: 'magic', icon: '🔮', maxLevel: 3, description: '+реген маны', effects: [
          { level: 1, type: 'mana_regen_per_turn', value: 2, description: '+2 маны/ход' },
          { level: 2, type: 'mana_regen_per_turn', value: 3, description: '+3 маны/ход' },
          { level: 3, type: 'mana_regen_per_turn', value: 4, description: '+4 маны/ход' }
        ]},
        { id: 'magic_school', name: 'Школа магии', category: 'magic', icon: '🎓', maxLevel: 3, description: 'эффективность заклинаний', effects: [
          { level: 1, type: 'spell_effectiveness', value: 1, description: 'Базовый' },
          { level: 2, type: 'spell_effectiveness', value: 2, description: 'Продвинутый' },
          { level: 3, type: 'spell_effectiveness', value: 3, description: 'Эксперт' }
        ]},
        { id: 'logistics', name: 'Логистика', category: 'adventure', icon: '🏃', maxLevel: 3, description: '+очки движения', effects: [
          { level: 1, type: 'movement_bonus_percent', value: 10, description: '+10% движения' },
          { level: 2, type: 'movement_bonus_percent', value: 20, description: '+20% движения' },
          { level: 3, type: 'movement_bonus_percent', value: 30, description: '+30% движения' }
        ]},
        { id: 'pathfinding', name: 'Следопыт', category: 'adventure', icon: '🗺️', maxLevel: 3, description: '-штраф местности', effects: [
          { level: 1, type: 'terrain_penalty_reduction', value: 25, description: '-25% штраф' },
          { level: 2, type: 'terrain_penalty_reduction', value: 50, description: '-50% штраф' },
          { level: 3, type: 'terrain_penalty_reduction', value: 75, description: '-75% штраф' }
        ]},
        { id: 'scouting', name: 'Разведка', category: 'adventure', icon: '👁️', maxLevel: 3, description: '+радиус обзора', effects: [
          { level: 1, type: 'vision_radius_bonus', value: 1, description: '+1 обзор' },
          { level: 2, type: 'vision_radius_bonus', value: 2, description: '+2 обзор' },
          { level: 3, type: 'vision_radius_bonus', value: 3, description: '+3 обзор' }
        ]},
        { id: 'navigation', name: 'Навигация', category: 'adventure', icon: '⚓', maxLevel: 3, description: '+скорость по воде', effects: [
          { level: 1, type: 'water_movement_bonus', value: 25, description: '+25%' },
          { level: 2, type: 'water_movement_bonus', value: 50, description: '+50%' },
          { level: 3, type: 'water_movement_bonus', value: 100, description: '+100%' }
        ]},
        { id: 'estates', name: 'Поместье', category: 'economy', icon: '🏠', maxLevel: 3, description: '+золото/день', effects: [
          { level: 1, type: 'daily_gold_income', value: 100, description: '+100 золота' },
          { level: 2, type: 'daily_gold_income', value: 250, description: '+250 золота' },
          { level: 3, type: 'daily_gold_income', value: 500, description: '+500 золота' }
        ]},
        { id: 'diplomacy', name: 'Дипломатия', category: 'economy', icon: '🤝', maxLevel: 3, description: 'шанс присоединить', effects: [
          { level: 1, type: 'join_chance_percent', value: 10, description: '10% шанс' },
          { level: 2, type: 'join_chance_percent', value: 20, description: '20% шанс' },
          { level: 3, type: 'join_chance_percent', value: 30, description: '30% шанс' }
        ]}
      ]
    };
  }

  private getFallbackCreatures(): any {
    // Базовые существа всех 6 фракций (78 существ в creatures.json)
    return {
      // === HAVEN ===
      pikeman: { id: 'pikeman', name: 'Ополченец', faction: 'haven', tier: 1, attack: 4, defense: 5, damage: { min: 1, max: 3 }, health: 10, speed: 5, growth: 14, cost: { gold: 60 }, abilities: [] },
      halberdier: { id: 'halberdier', name: 'Алебардщик', faction: 'haven', tier: 1, attack: 6, defense: 7, damage: { min: 2, max: 5 }, health: 15, speed: 5, growth: 14, cost: { gold: 100 }, abilities: ['first_strike'] },
      archer: { id: 'archer', name: 'Лучник', faction: 'haven', tier: 2, attack: 6, defense: 3, damage: { min: 2, max: 4 }, health: 10, speed: 4, growth: 9, cost: { gold: 100 }, abilities: ['shooter'] },
      crossbowman: { id: 'crossbowman', name: 'Арбалетчик', faction: 'haven', tier: 2, attack: 8, defense: 5, damage: { min: 3, max: 6 }, health: 15, speed: 4, growth: 9, cost: { gold: 150 }, abilities: ['shooter', 'double_shot'] },
      griffin: { id: 'griffin', name: 'Грифон', faction: 'haven', tier: 3, attack: 8, defense: 8, damage: { min: 5, max: 9 }, health: 25, speed: 6, growth: 6, cost: { gold: 200 }, abilities: ['flying'] },
      royal_griffin: { id: 'royal_griffin', name: 'Королевский грифон', faction: 'haven', tier: 3, attack: 10, defense: 9, damage: { min: 7, max: 11 }, health: 30, speed: 7, growth: 6, cost: { gold: 300 }, abilities: ['flying', 'unlimited_retaliation'] },
      swordsman: { id: 'swordsman', name: 'Мечник', faction: 'haven', tier: 4, attack: 10, defense: 12, damage: { min: 6, max: 9 }, health: 35, speed: 5, growth: 4, cost: { gold: 300 }, abilities: [] },
      crusader: { id: 'crusader', name: 'Крестоносец', faction: 'haven', tier: 4, attack: 12, defense: 12, damage: { min: 7, max: 10 }, health: 35, speed: 6, growth: 4, cost: { gold: 400 }, abilities: ['double_attack'] },
      monk: { id: 'monk', name: 'Монах', faction: 'haven', tier: 5, attack: 12, defense: 7, damage: { min: 10, max: 12 }, health: 30, speed: 5, growth: 3, cost: { gold: 400 }, abilities: ['shooter'] },
      zealot: { id: 'zealot', name: 'Фанатик', faction: 'haven', tier: 5, attack: 15, defense: 10, damage: { min: 13, max: 16 }, health: 30, speed: 7, growth: 3, cost: { gold: 550 }, abilities: [] },
      cavalier: { id: 'cavalier', name: 'Кавалерист', faction: 'haven', tier: 6, attack: 15, defense: 15, damage: { min: 15, max: 25 }, health: 100, speed: 7, growth: 2, cost: { gold: 1000 }, abilities: ['charge'] },
      champion: { id: 'champion', name: 'Чемпион', faction: 'haven', tier: 6, attack: 18, defense: 18, damage: { min: 20, max: 30 }, health: 110, speed: 9, growth: 2, cost: { gold: 1200 }, abilities: ['charge'] },
      angel: { id: 'angel', name: 'Ангел', faction: 'haven', tier: 7, attack: 20, defense: 20, damage: { min: 50, max: 50 }, health: 200, speed: 12, growth: 1, cost: { gold: 3000 }, abilities: ['flying'] },
      archangel: { id: 'archangel', name: 'Архангел', faction: 'haven', tier: 7, attack: 30, defense: 30, damage: { min: 50, max: 50 }, health: 250, speed: 18, growth: 1, cost: { gold: 5000 }, abilities: ['flying', 'resurrect'] },
      // === NECROPOLIS ===
      skeleton: { id: 'skeleton', name: 'Скелет', faction: 'necropolis', tier: 1, attack: 5, defense: 4, damage: { min: 1, max: 3 }, health: 8, speed: 5, growth: 14, cost: { gold: 60 }, abilities: ['undead'] },
      skeleton_warrior: { id: 'skeleton_warrior', name: 'Скелет-воин', faction: 'necropolis', tier: 1, attack: 6, defense: 6, damage: { min: 2, max: 4 }, health: 8, speed: 5, growth: 18, cost: { gold: 100 }, abilities: ['undead'] },
      zombie: { id: 'zombie', name: 'Зомби', faction: 'necropolis', tier: 2, attack: 5, defense: 5, damage: { min: 2, max: 3 }, health: 20, speed: 3, growth: 8, cost: { gold: 100 }, abilities: ['undead'] },
      plague_zombie: { id: 'plague_zombie', name: 'Чумной зомби', faction: 'necropolis', tier: 2, attack: 6, defense: 6, damage: { min: 3, max: 5 }, health: 25, speed: 4, growth: 10, cost: { gold: 150 }, abilities: ['undead', 'disease'] },
      wight: { id: 'wight', name: 'Вайт', faction: 'necropolis', tier: 3, attack: 7, defense: 6, damage: { min: 3, max: 5 }, health: 18, speed: 5, growth: 8, cost: { gold: 180 }, abilities: ['undead', 'life_drain'] },
      wraith: { id: 'wraith', name: 'Вейт', faction: 'necropolis', tier: 3, attack: 9, defense: 7, damage: { min: 4, max: 6 }, health: 22, speed: 6, growth: 8, cost: { gold: 250 }, abilities: ['undead', 'flying'] },
      vampire: { id: 'vampire', name: 'Вампир', faction: 'necropolis', tier: 4, attack: 10, defense: 9, damage: { min: 5, max: 8 }, health: 30, speed: 6, growth: 5, cost: { gold: 360 }, abilities: ['flying', 'undead', 'life_drain'] },
      vampire_lord: { id: 'vampire_lord', name: 'Вампир-лорд', faction: 'necropolis', tier: 4, attack: 12, defense: 10, damage: { min: 7, max: 10 }, health: 40, speed: 8, growth: 4, cost: { gold: 480 }, abilities: ['flying', 'undead'] },
      lich: { id: 'lich', name: 'Лич', faction: 'necropolis', tier: 5, attack: 13, defense: 10, damage: { min: 11, max: 13 }, health: 40, speed: 7, growth: 4, cost: { gold: 550 }, abilities: ['undead', 'shooter'] },
      power_lich: { id: 'power_lich', name: 'Могущественный лич', faction: 'necropolis', tier: 5, attack: 15, defense: 13, damage: { min: 13, max: 16 }, health: 40, speed: 8, growth: 3, cost: { gold: 750 }, abilities: ['undead', 'shooter'] },
      black_knight: { id: 'black_knight', name: 'Чёрный рыцарь', faction: 'necropolis', tier: 6, attack: 16, defense: 16, damage: { min: 15, max: 30 }, health: 120, speed: 7, growth: 2, cost: { gold: 1200 }, abilities: ['undead'] },
      dread_knight: { id: 'dread_knight', name: 'Рыцарь ужаса', faction: 'necropolis', tier: 6, attack: 18, defense: 18, damage: { min: 18, max: 32 }, health: 130, speed: 9, growth: 2, cost: { gold: 1500 }, abilities: ['undead'] },
      bone_dragon: { id: 'bone_dragon', name: 'Костяной дракон', faction: 'necropolis', tier: 7, attack: 18, defense: 18, damage: { min: 15, max: 25 }, health: 150, speed: 9, growth: 2, cost: { gold: 1800 }, abilities: ['flying', 'undead'] },
      ghost_dragon: { id: 'ghost_dragon', name: 'Призрачный дракон', faction: 'necropolis', tier: 7, attack: 19, defense: 17, damage: { min: 28, max: 55 }, health: 200, speed: 12, growth: 1, cost: { gold: 2200 }, abilities: ['flying', 'undead'] }
    };
  }
}
