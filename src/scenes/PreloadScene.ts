import Phaser from 'phaser';
import { CONFIG } from '../config';

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

    console.log('[PreloadScene] JSON files queued for loading');
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

    // Сохраняем в registry для доступа из других сцен
    this.registry.set('factions', factions);
    this.registry.set('spells', spells);
    this.registry.set('artifacts', artifacts);
    this.registry.set('buildings', buildings);
    this.registry.set('creatures', creatures);

    console.log('[PreloadScene] ✓ Данные загружены в registry:');
    console.log('[PreloadScene]   factions:', factions ? 'OK' : 'MISSING');
    console.log('[PreloadScene]   spells:', Array.isArray(spells) ? `${spells.length} заклинаний` : 'MISSING');
    console.log('[PreloadScene]   artifacts:', Array.isArray(artifacts) ? `${artifacts.length} артефактов` : 'MISSING');
    console.log('[PreloadScene]   buildings:', buildings ? 'OK' : 'MISSING');
    console.log('[PreloadScene]   creatures:', creatures ? `${Object.keys(creatures).length} существ` : 'MISSING');

    // Переход в меню через 800мс
    this.time.delayedCall(800, () => {
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
    return [
      { id: 'bless', name: 'Благословение', school: 'water', level: 1, manaCost: 5, description: '+20% урона' },
      { id: 'cure', name: 'Лечение', school: 'water', level: 1, manaCost: 6, description: 'Восстанавливает HP' },
      { id: 'slow', name: 'Замедление', school: 'water', level: 2, manaCost: 8, description: '-25% скорости' },
      { id: 'haste', name: 'Ускорение', school: 'air', level: 1, manaCost: 6, description: '+25% скорости' },
      { id: 'lightning', name: 'Молния', school: 'air', level: 2, manaCost: 10, description: 'Удар молнией' },
      { id: 'chain_lightning', name: 'Цепная молния', school: 'air', level: 3, manaCost: 15, description: 'По нескольким целям' },
      { id: 'shield', name: 'Щит', school: 'earth', level: 1, manaCost: 5, description: '+20% защиты' },
      { id: 'stone_skin', name: 'Каменная кожа', school: 'earth', level: 2, manaCost: 8, description: '+30% защиты' },
      { id: 'meteor', name: 'Метеор', school: 'earth', level: 4, manaCost: 20, description: 'Область 3×3' },
      { id: 'fireball', name: 'Огненный шар', school: 'fire', level: 3, manaCost: 15, description: 'Область 3×3' },
      { id: 'armageddon', name: 'Армагеддон', school: 'fire', level: 5, manaCost: 30, description: 'По всему полю' },
      { id: 'blind', name: 'Ослепление', school: 'mind', level: 2, manaCost: 10, description: 'Пропуск хода' },
      { id: 'forget', name: 'Забывчивость', school: 'mind', level: 2, manaCost: 8, description: 'Стрелок не стреляет' },
      { id: 'teleport', name: 'Телепорт', school: 'water', level: 3, manaCost: 12, description: 'Переместить юнита' },
      { id: 'clone', name: 'Клон', school: 'mind', level: 4, manaCost: 20, description: 'Создать копию' },
      { id: 'resurrect', name: 'Воскрешение', school: 'water', level: 4, manaCost: 20, description: 'Вернуть павших' },
      { id: 'berserk', name: 'Берсерк', school: 'fire', level: 3, manaCost: 12, description: 'Атакует кого угодно' },
      { id: 'dispel', name: 'Развеять', school: 'water', level: 1, manaCost: 5, description: 'Снять эффекты' },
      { id: 'town_portal', name: 'Портал города', school: 'air', level: 5, manaCost: 25, description: 'На карту' }
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

  private getFallbackCreatures(): any {
    return {
      pikeman: { id: 'pikeman', name: 'Ополченец', faction: 'haven', tier: 1, attack: 4, defense: 5, damage: { min: 1, max: 3 }, health: 10, speed: 5, growth: 14, cost: { gold: 60 }, abilities: [] },
      archer: { id: 'archer', name: 'Лучник', faction: 'haven', tier: 2, attack: 6, defense: 3, damage: { min: 2, max: 4 }, health: 10, speed: 4, growth: 9, cost: { gold: 100 }, abilities: ['shooter'] },
      griffin: { id: 'griffin', name: 'Грифон', faction: 'haven', tier: 3, attack: 8, defense: 8, damage: { min: 3, max: 6 }, health: 25, speed: 6, growth: 6, cost: { gold: 200 }, abilities: ['flying'] },
      knight: { id: 'knight', name: 'Рыцарь', faction: 'haven', tier: 4, attack: 15, defense: 15, damage: { min: 7, max: 10 }, health: 50, speed: 7, growth: 4, cost: { gold: 500 }, abilities: ['charge'] },
      angel: { id: 'angel', name: 'Ангел', faction: 'haven', tier: 5, attack: 20, defense: 20, damage: { min: 15, max: 25 }, health: 100, speed: 12, growth: 2, cost: { gold: 3000 }, abilities: ['flying'] },
      skeleton: { id: 'skeleton', name: 'Скелет', faction: 'necropolis', tier: 1, attack: 5, defense: 4, damage: { min: 1, max: 3 }, health: 8, speed: 5, growth: 14, cost: { gold: 60 }, abilities: ['undead'] },
      zombie: { id: 'zombie', name: 'Зомби', faction: 'necropolis', tier: 2, attack: 5, defense: 5, damage: { min: 2, max: 3 }, health: 20, speed: 3, growth: 8, cost: { gold: 100 }, abilities: ['undead'] },
      vampire: { id: 'vampire', name: 'Вампир', faction: 'necropolis', tier: 3, attack: 10, defense: 9, damage: { min: 4, max: 6 }, health: 30, speed: 6, growth: 5, cost: { gold: 360 }, abilities: ['flying', 'undead', 'life_drain'] },
      lich: { id: 'lich', name: 'Лич', faction: 'necropolis', tier: 4, attack: 13, defense: 10, damage: { min: 7, max: 10 }, health: 40, speed: 7, growth: 4, cost: { gold: 550 }, abilities: ['undead', 'shooter'] },
      bone_dragon: { id: 'bone_dragon', name: 'Костяной дракон', faction: 'necropolis', tier: 5, attack: 18, defense: 18, damage: { min: 15, max: 25 }, health: 150, speed: 9, growth: 2, cost: { gold: 1800 }, abilities: ['flying', 'undead'] }
    };
  }
}
