import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Town, Building, Resources, ArmySlot, Artifact, Hero } from '../types';
import { TownOwnership } from '../systems/VictorySystem';
import { UPGRADE_TABLE, getUpgrade, applyUpgrade, canAffordUpgrade, BASE_MARKET_RATES, generateMageGuildOffers, BASE_WEEKLY_GROWTH, UpgradeCost } from '../systems/EconomySystem';
import { SHIP_COSTS, canBuildShipyard, createShipObject } from '../systems/NavalSystem';
import { PotionSystem } from '../systems/PotionSystem';
import { RazeSystem } from '../systems/RazeSystem';

/**
 * TownScene — полноценная система города:
 * - 🏗️ Строительство зданий
 * - 👥 Найм существ с учётом прироста (неделя)
 * - 🏪 Рынок обмена ресурсов
 * - ⚒️ Кузница артефактов
 * - 🍺 Таверна (найм героев)
 * - 📦 Передача армии между героем и гарнизоном
 */
type TabId = 'buildings' | 'hire' | 'market' | 'blacksmith' | 'garrison' | 'tavern' | 'upgrade' | 'mageguild' | 'shipyard' | 'alchemy' | 'raze';

export class TownScene extends Phaser.Scene {
  private town!: TownOwnership;
  private townId: string = '';
  private worldScene: any;
  private buildings: Building[] = [];
  private creatures: Record<string, any> = {};
  private artifacts: any[] = [];
  
  // UI слои
  private mainContainer!: Phaser.GameObjects.Container;
  private resourceTexts: Map<string, Phaser.GameObjects.Text> = new Map();
  private townNameText!: Phaser.GameObjects.Text;
  private activeTab: TabId = 'buildings';
  
  // Для таверны
  private tavernHeroes: any[] = [];
  private tabButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private contentContainer!: Phaser.GameObjects.Container;
  
  // Для рынка
  private marketRates: Record<string, number> = {
    gold: 1,
    wood: 500,
    ore: 500,
    crystal: 1000,
    gems: 1000,
    sulfur: 1000,
    mercury: 1000
  };

  constructor() {
    super({ key: CONFIG.SCENES.TOWN });
  }

  init(data: { townId: string; worldScene: any; townData?: TownOwnership }): void {
    this.worldScene = data.worldScene;
    this.townId = data.townId;
    
    // Получаем данные о городе из VictorySystem
    if (data.townData) {
      this.town = data.townData;
    } else {
      // Fallback — создаём базовые данные
      this.town = {
        id: data.townId,
        name: 'Серебряный Замок',
        faction: 'haven',
        x: 0,
        y: 0,
        owner: 'player',
        builtBuildings: ['citadel', 'haven_dwelling_1'],
        garrison: [],
        availableForHire: [
          { creatureId: 'squire', count: 14 },
          { creatureId: 'ballista', count: 14 }
        ],
        lastGrowthDay: 1
      };
    }
    
    // Загружаем данные
    this.creatures = this.registry.get('creatures') || this.getFallbackCreatures();
    this.artifacts = this.registry.get('artifacts') || [];
    this.buildings = this.loadBuildings();
  }

  create(): void {
    this.createBackground();
    this.createTownVisuals();
    this.createTopPanel();
    this.createTabButtons();
    this.createContentArea();
    this.showTab('buildings');
    this.setupKeyboard();
  }

  // ==================== ВИЗУАЛ ====================

  private createBackground(): void {
    const { width, height } = this.scale;
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x4a7c2e, 0x4a7c2e, 0x2d5016, 0x2d5016, 1);
    bg.fillRect(0, 0, width, height);
    bg.fillStyle(0x8b7355, 1);
    bg.fillRect(0, height / 2 - 30, width, 60);
  }

  private createTownVisuals(): void {
    const { width, height } = this.scale;
    const castle = this.add.container(200, height / 2 - 30);
    
    const base = this.add.rectangle(0, 50, 180, 90, 0x8b4513).setStrokeStyle(2, 0x5a3a0e);
    const tower1 = this.add.rectangle(-50, -15, 35, 70, 0xa0522d).setStrokeStyle(2, 0x5a3a0e);
    const tower2 = this.add.rectangle(50, -15, 35, 70, 0xa0522d).setStrokeStyle(2, 0x5a3a0e);
    const roof1 = this.add.triangle(-50, -50, 0, 0, -18, 18, 18, 18, 0xd4af37);
    const roof2 = this.add.triangle(50, -50, 0, 0, -18, 18, 18, 18, 0xd4af37);
    const mainTower = this.add.rectangle(0, -25, 50, 85, 0x8b4513).setStrokeStyle(2, 0x5a3a0e);
    const mainRoof = this.add.triangle(0, -68, 0, 0, -25, 18, 25, 18, 0xd4af37);
    const gate = this.add.rectangle(0, 75, 35, 35, 0x3d2817);
    const flag = this.add.rectangle(0, -95, 25, 16, 0x4169e1);
    
    castle.add([base, tower1, tower2, roof1, roof2, mainTower, mainRoof, gate, flag]);
    
    this.tweens.add({
      targets: flag,
      scaleX: 0.8,
      duration: 1000,
      yoyo: true,
      repeat: -1
    });
  }

  private createTopPanel(): void {
    const { width } = this.scale;
    
    this.add.rectangle(width / 2, 30, width - 40, 50, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);

    this.townNameText = this.add.text(200, 30, `🏰 ${this.town.name} (${this.town.faction})`, {
      fontSize: '20px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5);

    const resources = this.worldScene.getResources();
    const icons: Record<string, string> = {
      gold: '💰', wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸'
    };
    
    let rx = 550;
    for (const [key, value] of Object.entries(resources)) {
      const text = this.add.text(rx, 30, `${icons[key] || ''} ${value}`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0, 0.5);
      this.resourceTexts.set(key, text);
      rx += 100;
    }
  }

  private createTabButtons(): void {
    const { width, height } = this.scale;
    const tabs = [
      { id: 'buildings', label: '🏗️ Здания', x: width / 2 - 390 },
      { id: 'hire', label: '👥 Найм', x: width / 2 - 280 },
      { id: 'upgrade', label: '⬆️ Апгрейд', x: width / 2 - 170 },
      { id: 'garrison', label: '🛡️ Гарнизон', x: width / 2 - 60 },
      { id: 'market', label: '🏪 Рынок', x: width / 2 + 50 },
      { id: 'mageguild', label: '🧙 Гильдия', x: width / 2 + 160 },
      { id: 'blacksmith', label: '⚒️ Кузница', x: width / 2 + 270 },
      { id: 'tavern', label: '🍺 Таверна', x: width / 2 + 380 },
      { id: 'alchemy', label: '🧪 Алхимик', x: width / 2 + 490 },
      { id: 'raze', label: '💥 Разрушить', x: width / 2 + 600 }
    ];

    for (const tab of tabs) {
      const container = this.add.container(tab.x, 85);
      const bg = this.add.rectangle(0, 0, 100, 36, 0x2c3e50, 0.9)
        .setStrokeStyle(2, 0x555555);
      const label = this.add.text(0, 0, tab.label, {
        fontSize: '12px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);

      container.add([bg, label]);
      container.setSize(100, 36);
      container.setInteractive({ useHandCursor: true });
      
      container.on('pointerdown', () => {
        this.showTab(tab.id as TabId);
      });
      
      container.on('pointerover', () => {
        if (this.activeTab !== (tab.id as TabId)) {
          bg.setFillStyle(0x34495e, 1);
        }
      });
      container.on('pointerout', () => {
        if (this.activeTab !== (tab.id as TabId)) {
          bg.setFillStyle(0x2c3e50, 0.9);
        }
      });

      this.tabButtons.set(tab.id, container);
    }
  }

  private createContentArea(): void {
    this.contentContainer = this.add.container(0, 0);
  }

  // ==================== ВКЛАДКИ ====================

  private showTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
    this.contentContainer.removeAll(true);
    
    // Обновляем вид кнопок
    this.tabButtons.forEach((container, id) => {
      const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
      if (id === tab) {
        bg.setFillStyle(0x8b4513, 0.95);
        bg.setStrokeStyle(2, 0xd4af37);
      } else {
        bg.setFillStyle(0x2c3e50, 0.9);
        bg.setStrokeStyle(2, 0x555555);
      }
    });

    switch (tab) {
      case 'buildings': this.renderBuildings(); break;
      case 'hire': this.renderHire(); break;
      case 'upgrade': this.renderUpgrade(); break;
      case 'garrison': this.renderGarrison(); break;
      case 'market': this.renderMarket(); break;
      case 'mageguild': this.renderMageGuild(); break;
      case 'blacksmith': this.renderBlacksmith(); break;
      case 'tavern': this.renderTavern(); break;
      case 'shipyard': this.renderShipyard(); break;
      case 'alchemy': this.renderAlchemy(); break;
      case 'raze': this.renderRaze(); break;
    }
  }

  // ==================== ЗДАНИЯ ====================

  private renderBuildings(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    let y = 170;
    for (const building of this.buildings) {
      const isBuilt = this.town.builtBuildings.includes(building.id);
      const canBuild = !isBuilt && this.canAfford(building.cost) && this.meetsRequirements(building);

      const bg = this.add.rectangle(width / 2, y, 750, 55, 
        isBuilt ? 0x2d5016 : (canBuild ? 0x2c3e50 : 0x1a1a2e), 0.95
      ).setStrokeStyle(2, isBuilt ? 0x2ecc71 : (canBuild ? 0xd4af37 : 0x444444));

      const name = this.add.text(width / 2 - 360, y - 10, building.name, {
        fontSize: '15px', fontStyle: 'bold',
        color: isBuilt ? '#2ecc71' : (canBuild ? '#f0e6d2' : '#666666'),
        fontFamily: 'Segoe UI'
      });

      const costStr = Object.entries(building.cost)
        .map(([k, v]) => `${k}: ${v}`).join(' | ') || 'Бесплатно';
      const cost = this.add.text(width / 2 - 360, y + 10, costStr, {
        fontSize: '11px',
        color: canBuild ? '#ffd700' : '#666666',
        fontFamily: 'Segoe UI'
      });

      const icon = isBuilt ? '✅' : (canBuild ? '🔨' : '🔒');
      const status = this.add.text(width / 2 + 340, y, icon, {
        fontSize: '24px'
      }).setOrigin(1, 0.5);

      if (canBuild) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => { bg.setFillStyle(0x34495e, 1); bg.setStrokeStyle(3, 0xffd700); });
        bg.on('pointerout', () => { bg.setFillStyle(0x2c3e50, 0.95); bg.setStrokeStyle(2, 0xd4af37); });
        bg.on('pointerdown', () => this.buildBuilding(building));
      }

      this.contentContainer.add([bg, name, cost, status]);
      y += 62;
    }
  }

  // ==================== АПГРЕЙДЫ ====================

  private renderUpgrade(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    const title = this.add.text(width / 2, 140, '⬆️ Апгрейды существ (улучшение армии героя)', {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    const hero = this.worldScene.getHero();
    if (!hero.army || hero.army.length === 0) {
      const noArmy = this.add.text(width / 2, 300, 'Армия героя пуста', {
        fontSize: '16px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noArmy);
      return;
    }

    let y = 180;
    let hasUpgrades = false;

    for (const slot of hero.army) {
      const upgrade = getUpgrade(slot.creatureId);
      if (!upgrade) continue;

      hasUpgrades = true;
      const creature = this.creatures[slot.creatureId];
      const upgraded = this.creatures[upgrade.to];
      const canAfford = canAffordUpgrade(this.worldScene.getResources() as any, upgrade.cost);

      const bg = this.add.rectangle(width / 2, y, 750, 65, 0x2c3e50, 0.95)
        .setStrokeStyle(2, canAfford ? 0xd4af37 : 0x444444);

      // От
      const fromText = this.add.text(width / 2 - 350, y - 15, 
        `${creature?.name || slot.creatureId} (${slot.count} шт)`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      // Стрелка
      const arrow = this.add.text(width / 2 - 100, y - 15, '→', {
        fontSize: '20px', color: '#d4af37'
      });

      // Кому
      const toText = this.add.text(width / 2 - 60, y - 15, upgrade.toName || upgrade.to, {
        fontSize: '14px', color: '#2ecc71', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      // Статы улучшения
      if (upgraded) {
        const statsUp = this.add.text(width / 2 - 60, y + 5,
          `АТК:${creature?.attack}→${upgraded.attack} ЗАЩ:${creature?.defense}→${upgraded.defense} HP:${creature?.health}→${upgraded.health}`,
          { fontSize: '10px', color: '#aaaaaa', fontFamily: 'Segoe UI' });
        this.contentContainer.add(statsUp);
      }

      // Стоимость
      const costStr = Object.entries(upgrade.cost)
        .map(([k, v]) => {
          const icons: Record<string, string> = { gold: '💰', wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸' };
          return `${icons[k] || k}${v}×${slot.count}`;
        })
        .join(' ');
      
      const costText = this.add.text(width / 2 - 350, y + 15, `Стоимость: ${costStr}`, {
        fontSize: '11px', color: canAfford ? '#ffd700' : '#e74c3c', fontFamily: 'Segoe UI'
      });

      // Кнопки
      if (canAfford) {
        const upAllBtn = this.createMiniButton(width / 2 + 320, y - 10, 'Всех', 0x2ecc71, () => {
          this.doUpgrade(slot.creatureId, slot.count);
        });
        const up1Btn = this.createMiniButton(width / 2 + 320, y + 15, 'Одного', 0x3498db, () => {
          this.doUpgrade(slot.creatureId, 1);
        });
        this.contentContainer.add([upAllBtn, up1Btn]);
      }

      this.contentContainer.add([bg, fromText, arrow, toText, costText]);
      y += 75;
    }

    if (!hasUpgrades) {
      const noUpgrades = this.add.text(width / 2, 300, 'Нет доступных апгрейдов для существ в армии', {
        fontSize: '16px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noUpgrades);
    }
  }

  private doUpgrade(creatureId: string, count: number): void {
    const upgrade = getUpgrade(creatureId);
    if (!upgrade) {
      this.showNotification('❌ Улучшение недоступно!');
      return;
    }

    const resources = this.worldScene.getResources() as any;
    const hero = this.worldScene.getHero();
    
    // Находим слот в армии и ограничиваем количество доступных существ
    const armySlot = hero.army.find(s => s.creatureId === creatureId);
    if (!armySlot || armySlot.count <= 0) {
      this.showNotification('❌ Нет существ для улучшения!');
      return;
    }
    
    // Реальное количество для апгрейда (не больше чем в армии)
    const upgradeCount = Math.min(count, armySlot.count);
    
    // МАСШТАБИРУЕМ стоимость под количество улучшаемых существ
    // applyUpgrade() списывает только за 1 единицу, поэтому умножаем
    const scaledCost: UpgradeCost = {
      gold: upgrade.cost.gold * upgradeCount,
      wood: (upgrade.cost.wood || 0) * upgradeCount,
      ore: (upgrade.cost.ore || 0) * upgradeCount,
      crystal: (upgrade.cost.crystal || 0) * upgradeCount,
      gems: (upgrade.cost.gems || 0) * upgradeCount,
      sulfur: (upgrade.cost.sulfur || 0) * upgradeCount,
      mercury: (upgrade.cost.mercury || 0) * upgradeCount,
    };
    
    // Проверяем доступность МАСШТАБИРОВАННОЙ стоимости
    if (!canAffordUpgrade(resources, scaledCost)) {
      // Рассчитываем максимум что можем улучшить
      const maxAffordable = this.calculateMaxAffordable(resources, upgrade.cost, armySlot.count);
      if (maxAffordable <= 0) {
        this.showNotification('❌ Недостаточно ресурсов!');
        return;
      }
      // Автоматически уменьшаем количество до максимально доступного
      return this.doUpgrade(creatureId, maxAffordable);
    }

    // Применяем МАСШТАБИРОВАННЫЙ апгрейд к ресурсам
    const newResources = applyUpgrade(resources, scaledCost);
    Object.assign(resources, newResources);
    
    // Убираем старых существ из армии
    armySlot.count -= upgradeCount;
    if (armySlot.count <= 0) {
      hero.army = hero.army.filter(s => s.creatureId !== creatureId);
    }
    
    // Добавляем улучшенное существо
    const existingUpgraded = hero.army.find(s => s.creatureId === upgrade.to);
    if (existingUpgraded) {
      existingUpgraded.count += upgradeCount;
    } else {
      hero.army.push({ creatureId: upgrade.to, count: upgradeCount });
    }
      
    this.showNotification(`✅ Улучшено: ${upgrade.toName || upgrade.to} × ${upgradeCount}!`);
    this.refreshUI();
  }
  
  /**
   * Рассчитать максимум существ, которых можем улучшить с текущими ресурсами
   */
  private calculateMaxAffordable(
    resources: any, 
    costPerUnit: UpgradeCost, 
    maxCount: number
  ): number {
    let max = maxCount;
    
    // Проверяем по каждому ресурсу
    const goldMax = Math.floor((resources.gold || 0) / costPerUnit.gold);
    max = Math.min(max, goldMax);
    
    if (costPerUnit.wood) {
      const woodMax = Math.floor((resources.wood || 0) / costPerUnit.wood);
      max = Math.min(max, woodMax);
    }
    if (costPerUnit.ore) {
      const oreMax = Math.floor((resources.ore || 0) / costPerUnit.ore);
      max = Math.min(max, oreMax);
    }
    if (costPerUnit.crystal) {
      const crystalMax = Math.floor((resources.crystal || 0) / costPerUnit.crystal);
      max = Math.min(max, crystalMax);
    }
    if (costPerUnit.gems) {
      const gemsMax = Math.floor((resources.gems || 0) / costPerUnit.gems);
      max = Math.min(max, gemsMax);
    }
    if (costPerUnit.sulfur) {
      const sulfurMax = Math.floor((resources.sulfur || 0) / costPerUnit.sulfur);
      max = Math.min(max, sulfurMax);
    }
    if (costPerUnit.mercury) {
      const mercuryMax = Math.floor((resources.mercury || 0) / costPerUnit.mercury);
      max = Math.min(max, mercuryMax);
    }
    
    return Math.max(0, max);
  }

  // ==================== МАГИЧЕСКАЯ ГИЛЬДИЯ ====================

  private renderMageGuild(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    // Проверяем наличие гильдии
    const guildLevel = this.getMageGuildLevel();
    if (guildLevel === 0) {
      const noGuild = this.add.text(width / 2, 300, '🧙 Постройте Гильдию магов для покупки заклинаний', {
        fontSize: '18px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noGuild);
      return;
    }

    const title = this.add.text(width / 2, 140, `🧙 Гильдия магов (уровень ${guildLevel})`, {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    // Получаем все заклинания
    const allSpells = this.registry.get('spells') || this.getFallbackSpells();
    const hero = this.worldScene.getHero();
    const existingSpells = hero.spells || [];

    // Генерируем предложения
    const offers = generateMageGuildOffers(guildLevel, Object.keys(allSpells));

    if (offers.length === 0) {
      const noOffers = this.add.text(width / 2, 250, 'Нет доступных заклинаний для покупки\n(все уже изучены)', {
        fontSize: '16px', color: '#888888', fontFamily: 'Segoe UI', align: 'center'
      }).setOrigin(0.5);
      this.contentContainer.add(noOffers);
      return;
    }

    let y = 190;
    for (const offer of offers) {
      const canBuy = this.worldScene.getResources().gold >= offer.cost && !existingSpells.includes(offer.spellId);

      const schoolColors: Record<string, number> = {
        life: 0xffd700,      // Золотой — Жизнь
        death: 0x8b008b,     // Тёмно-фиолетовый — Смерть
        order: 0x4169e1,     // Королевский синий — Порядок
        chaos: 0xff4500,     // Оранжево-красный — Хаос
        natural: 0x228b22,   // Лесной зелёный — Природа
        tactics: 0xdc143c    // Багровый — Тактика
      };

      const bg = this.add.rectangle(width / 2, y, 700, 60, schoolColors[offer.school] || 0x2c3e50, 0.6)
        .setStrokeStyle(2, canBuy ? 0xd4af37 : 0x444444);

      const schoolIcons: Record<string, string> = {
        life: '💛', death: '💀', order: '⚜️', chaos: '🔥', natural: '🌿', tactics: '⚔️'
      };

      const name = this.add.text(width / 2 - 330, y - 10, 
        `${schoolIcons[offer.school] || '📜'} ${offer.spellName} (ур. ${offer.level})`, {
        fontSize: '15px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      const desc = this.add.text(width / 2 - 330, y + 10, offer.spellName, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      });

      const price = this.add.text(width / 2 + 200, y - 10, `💰 ${offer.cost}`, {
        fontSize: '14px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      if (existingSpells.includes(offer.spellId)) {
        const owned = this.add.text(width / 2 + 200, y + 10, '✅ Изучено', {
          fontSize: '12px', color: '#2ecc71', fontFamily: 'Segoe UI'
        }).setOrigin(0, 0.5);
        this.contentContainer.add(owned);
      } else if (canBuy) {
        const buyBtn = this.createMiniButton(width / 2 + 280, y, 'Купить', 0x2ecc71, () => {
          this.buySpell(offer);
        });
        this.contentContainer.add(buyBtn);
      }

      this.contentContainer.add([bg, name, desc, price]);
      y += 70;
    }

    // Показать текущие заклинания героя
    const heroSpellsTitle = this.add.text(width / 2, y + 10, '📖 Ваши заклинания:', {
      fontSize: '14px', color: '#4169e1', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(heroSpellsTitle);

    if (existingSpells.length === 0) {
      const noSpells = this.add.text(width / 2, y + 30, 'Нет заклинаний', {
        fontSize: '12px', color: '#666666', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noSpells);
    } else {
      const spellsList = this.add.text(width / 2, y + 30, existingSpells.join(', '), {
        fontSize: '12px', color: '#f0e6d2', fontFamily: 'Segoe UI',
        wordWrap: { width: 700 }, align: 'center'
      }).setOrigin(0.5);
      this.contentContainer.add(spellsList);
    }
  }

  private getMageGuildLevel(): number {
    const builtBuildings = this.town.builtBuildings || [];
    let level = 0;
    if (builtBuildings.includes('mage_guild_3') || builtBuildings.includes('mageGuild3')) level = 3;
    else if (builtBuildings.includes('mage_guild_2') || builtBuildings.includes('mageGuild2')) level = 2;
    else if (builtBuildings.includes('mage_guild_1') || builtBuildings.includes('mageGuild1')) level = 1;

    // Библиотека академии: +1 уровень гильдии магов
    const effects = this.getTownBuildingEffects();
    if (effects.mageGuildBonus) level += effects.mageGuildBonus;

    return level;
  }

  private buySpell(offer: any): void {
    const resources = this.worldScene.getResources();
    if (resources.gold < offer.cost) {
      this.showNotification('❌ Недостаточно золота!');
      return;
    }

    resources.gold -= offer.cost;

    // Добавляем заклинание герою
    const hero = this.worldScene.getHero();
    if (!hero.spells) hero.spells = [];
    hero.spells.push(offer.spellId);

    this.showNotification(`📜 Изучено заклинание: ${offer.spellName}!`);
    this.refreshUI();
  }

  private getFallbackSpells(): any[] {
    // Школы магии HoMM4 (канон): Life, Death, Order, Chaos, Natural
    return [
      // === LIFE (Жизнь) ===
      { id: 'bless', name: 'Благословение', level: 1, school: 'life', description: '+20% урона союзнику' },
      { id: 'heal', name: 'Исцеление', level: 2, school: 'life', description: 'Восстанавливает HP и снимает негативные эффекты' },
      { id: 'resurrect', name: 'Воскрешение', level: 4, school: 'life', description: 'Воскрешает павших существ' },
      // === ORDER (Порядок) ===
      { id: 'haste', name: 'Ускорение', level: 1, school: 'order', description: '+50% скорости союзнику' },
      { id: 'slow', name: 'Замедление', level: 1, school: 'order', description: '-50% скорости врага' },
      { id: 'shield', name: 'Щит', level: 1, school: 'order', description: '-30% получаемого урона' },
      { id: 'blind', name: 'Ослепление', level: 2, school: 'order', description: 'Пропуск хода' },
      { id: 'forgetfulness', name: 'Забывчивость', level: 2, school: 'order', description: 'Стрелок не может стрелять' },
      { id: 'teleport', name: 'Телепорт', level: 3, school: 'order', description: 'Перемещение союзника' },
      { id: 'clone', name: 'Зеркальный образ', level: 4, school: 'order', description: 'Создаёт копию существа' },
      // === CHAOS (Хаос) ===
      { id: 'bloodlust', name: 'Жажда крови', level: 1, school: 'chaos', description: '+5 атаки в ближнем бою' },
      { id: 'lightning', name: 'Молния', level: 2, school: 'chaos', description: 'Урон одному врагу' },
      { id: 'fireball', name: 'Огненный шар', level: 3, school: 'chaos', description: 'Урон по области 3x3' },
      { id: 'berserk', name: 'Берсерк', level: 3, school: 'chaos', description: 'Враг атакует ближайшую цель' },
      { id: 'meteor', name: 'Метеоритный дождь', level: 4, school: 'chaos', description: 'Мощный урон одному врагу' },
      { id: 'armageddon', name: 'Армагеддон', level: 5, school: 'chaos', description: 'Урон всем на поле' },
      // === NATURAL (Природа) ===
      { id: 'stoneskin', name: 'Каменная кожа', level: 1, school: 'natural', description: '+5 защиты' },
      { id: 'fly', name: 'Полёт', level: 3, school: 'natural', description: 'Существо получает способность летать' }
    ];
  }

  // ==================== НАЙМ СУЩЕСТВ ====================

  private renderHire(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    const title = this.add.text(width / 2, 140, '👥 Найм существ (доступны в эту неделю)', {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    let y = 180;
    const available = this.town.availableForHire || [];
    
    if (available.length === 0) {
      const noCreatures = this.add.text(width / 2, 300, 'Нет существ для найма.\nПостройте жилища!', {
        fontSize: '16px', color: '#888888', fontFamily: 'Segoe UI', align: 'center'
      }).setOrigin(0.5);
      this.contentContainer.add(noCreatures);
      return;
    }

    for (const slot of available) {
      if (slot.count <= 0) continue;
      
      const creature = this.creatures[slot.creatureId];
      if (!creature) continue;

      // ЦЕНА СУЩЕСТВА (с разными ресурсами!)
      const costPerUnit = creature.cost || { gold: 60 };
      const goldPerUnit = costPerUnit.gold || 0;

      const bg = this.add.rectangle(width / 2, y, 750, 60, 0x2c3e50, 0.95)
        .setStrokeStyle(2, 0xd4af37);

      // Иконка существа (цветной квадратик)
      const tierColors: Record<number, number> = { 1: 0xaaaaaa, 2: 0x4169e1, 3: 0x9b59b6, 4: 0xff8c00, 5: 0xffd700 };
      const icon = this.add.rectangle(width / 2 - 340, y, 40, 40, tierColors[creature.tier] || 0xaaaaaa)
        .setStrokeStyle(2, 0x000000);

      const nameText = this.add.text(width / 2 - 310, y - 12, `${creature.name} (Тир ${creature.tier})`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      const statsText = this.add.text(width / 2 - 310, y + 8, 
        `АТК:${creature.attack} ЗАЩ:${creature.defense} HP:${creature.health} ⚔️${creature.damage?.min || creature.damageMin || 1}-${creature.damage?.max || creature.damageMax || 3} 🏃${creature.speed}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      });

      const availableText = this.add.text(width / 2 + 50, y - 12, `Доступно: ${slot.count}`, {
        fontSize: '14px', color: '#2ecc71', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      // Цена с ресурсами
      const costStr = Object.entries(costPerUnit)
        .map(([k, v]) => {
          const icons: Record<string, string> = { gold: '💰', wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸' };
          return `${icons[k] || k}${v}`;
        })
        .join(' ');

      const costText = this.add.text(width / 2 + 50, y + 8, `За 1 шт: ${costStr}`, {
        fontSize: '11px', color: '#ffd700', fontFamily: 'Segoe UI'
      });

      // Кнопки: нанять всё / нанять по 1 / -10
      const buyAllBtn = this.createMiniButton(width / 2 + 250, y - 10, 'Всё', 0x2ecc71, () => {
        this.hireCreature(slot.creatureId, slot.count);
      });
      const buy10Btn = this.createMiniButton(width / 2 + 310, y - 10, '×10', 0x3498db, () => {
        this.hireCreature(slot.creatureId, Math.min(10, slot.count));
      });
      const buy1Btn = this.createMiniButton(width / 2 + 310, y + 15, '×1', 0x3498db, () => {
        this.hireCreature(slot.creatureId, 1);
      });

      this.contentContainer.add([bg, icon, nameText, statsText, availableText, costText, buyAllBtn, buy10Btn, buy1Btn]);
      y += 70;
    }
  }

  private hireCreature(creatureId: string, count: number): void {
    const creature = this.creatures[creatureId];
    if (!creature) return;

    const slot = this.town.availableForHire.find(s => s.creatureId === creatureId);
    if (!slot || slot.count < count) {
      this.showNotification('❌ Недостаточно существ для найма!');
      return;
    }

    // Стоимость с разными ресурсами
    const costPerUnit = creature.cost || { gold: 60 };
    const totalCost: Partial<Resources> = {};
    for (const [key, value] of Object.entries(costPerUnit)) {
      totalCost[key as keyof Resources] = (value as number) * count;
    }

    // Проверяем наличие ресурсов
    const resources = this.worldScene.getResources() as any;
    for (const [key, value] of Object.entries(totalCost)) {
      if ((resources[key] || 0) < (value as number)) {
        this.showNotification(`❌ Недостаточно ресурсов!`);
        return;
      }
    }

    // Списываем ресурсы
    for (const [key, value] of Object.entries(totalCost)) {
      resources[key] -= value as number;
    }

    // Убираем из найма
    slot.count -= count;
    if (slot.count <= 0) {
      this.town.availableForHire = this.town.availableForHire.filter(s => s.count > 0);
    }

    // Добавляем в гарнизон
    this.addToGarrison(creatureId, count);

    this.showNotification(`✅ Нанято: ${creature.name} × ${count}`);
    this.refreshUI();
  }

  private addToGarrison(creatureId: string, count: number): void {
    const existing = this.town.garrison.find(s => s.creatureId === creatureId);
    if (existing) {
      existing.count += count;
    } else {
      this.town.garrison.push({ creatureId, count });
    }
  }

  // ==================== ГАРНИЗОН И АРМИЯ ====================

  private renderGarrison(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    // Гарнизон
    const garrisonTitle = this.add.text(width / 2 - 200, 140, '🛡️ ГАРНИЗОН', {
      fontSize: '16px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(garrisonTitle);

    let y = 180;
    for (const slot of this.town.garrison) {
      const creature = this.creatures[slot.creatureId];
      if (!creature) continue;

      const bg = this.add.rectangle(width / 2 - 200, y, 360, 45, 0x2c3e50, 0.95)
        .setStrokeStyle(1, 0x555555);
      const name = this.add.text(width / 2 - 370, y, `${creature.name}: ${slot.count}`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0, 0.5);

      const transferBtn = this.createMiniButton(width / 2 - 40, y, '→ Герой', 0x3498db, () => {
        this.transferToHero(slot.creatureId, slot.count);
      });

      this.contentContainer.add([bg, name, transferBtn]);
      y += 50;
    }

    if (this.town.garrison.length === 0) {
      const empty = this.add.text(width / 2 - 200, 250, 'Гарнизон пуст', {
        fontSize: '14px', color: '#666666', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(empty);
    }

    // Армия героя
    const hero = this.worldScene.getHero();
    const armyTitle = this.add.text(width / 2 + 200, 140, '🦸 АРМИЯ ГЕРОЯ', {
      fontSize: '16px', color: '#4169e1', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(armyTitle);

    y = 180;
    for (const slot of hero.army) {
      const creature = this.creatures[slot.creatureId];
      if (!creature) continue;

      const bg = this.add.rectangle(width / 2 + 200, y, 360, 45, 0x2c3e50, 0.95)
        .setStrokeStyle(1, 0x4169e1);
      const name = this.add.text(width / 2 + 30, y, `${creature.name}: ${slot.count}`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0, 0.5);

      const transferBtn = this.createMiniButton(width / 2 + 360, y, '← Гарнизон', 0xe67e22, () => {
        this.transferToGarrison(slot.creatureId, slot.count);
      });

      this.contentContainer.add([bg, name, transferBtn]);
      y += 50;
    }
  }

  private transferToHero(creatureId: string, count: number): void {
    const hero = this.worldScene.getHero();
    
    // Убираем из гарнизона
    const garrisonSlot = this.town.garrison.find(s => s.creatureId === creatureId);
    if (!garrisonSlot) return;
    garrisonSlot.count -= count;
    if (garrisonSlot.count <= 0) {
      this.town.garrison = this.town.garrison.filter(s => s.count > 0);
    }

    // Добавляем в армию героя
    const heroSlot = hero.army.find(s => s.creatureId === creatureId);
    if (heroSlot) {
      heroSlot.count += count;
    } else {
      hero.army.push({ creatureId, count });
    }

    const creature = this.creatures[creatureId];
    this.showNotification(`✅ ${creature.name} × ${count} переданы герою`);
    this.refreshUI();
  }

  private transferToGarrison(creatureId: string, count: number): void {
    const hero = this.worldScene.getHero();
    
    // Убираем из армии героя
    const heroSlot = hero.army.find(s => s.creatureId === creatureId);
    if (!heroSlot) return;
    heroSlot.count -= count;
    if (heroSlot.count <= 0) {
      hero.army = hero.army.filter(s => s.count > 0);
    }

    // Добавляем в гарнизон
    this.addToGarrison(creatureId, count);

    const creature = this.creatures[creatureId];
    this.showNotification(`✅ ${creature.name} × ${count} в гарнизон`);
    this.refreshUI();
  }

  // ==================== РЫНОК ====================

  private renderMarket(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    const hasMarket = this.town.builtBuildings.includes('marketplace');
    if (!hasMarket) {
      const noMarket = this.add.text(width / 2, 300, '🏪 Постройте Рынок для обмена ресурсов', {
        fontSize: '18px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noMarket);
      return;
    }

    const title = this.add.text(width / 2, 140, '🏪 Обмен ресурсов', {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    const resources = this.worldScene.getResources();
    const icons: Record<string, string> = {
      wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸'
    };

    let y = 185;
    const tradable = ['wood', 'ore', 'crystal', 'gems', 'sulfur', 'mercury'];
    
    for (const res of tradable) {
      const rate = BASE_MARKET_RATES[res];
      if (!rate) continue;
      
      const bg = this.add.rectangle(width / 2, y, 720, 50, 0x2c3e50, 0.95)
        .setStrokeStyle(1, 0x555555);
      
      const info = this.add.text(width / 2 - 340, y - 8, 
        `${icons[res]} ${(resources as any)[res]} шт`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      const ratesText = this.add.text(width / 2 - 150, y - 8,
        `Купить: ${rate.buy}💰 | Продать: ${rate.sell}💰`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      }).setOrigin(0, 0.5);

      const sellBtn = this.createMiniButton(width / 2 + 150, y - 10, 'Продать 1', 0xe67e22, () => {
        this.sellResource(res, 1);
      });
      const sell5Btn = this.createMiniButton(width / 2 + 230, y - 10, '×5', 0xe67e22, () => {
        this.sellResource(res, Math.min(5, (resources as any)[res]));
      });
      const buyBtn = this.createMiniButton(width / 2 + 150, y + 12, 'Купить 1', 0x27ae60, () => {
        this.buyResource(res, 1);
      });
      const buy5Btn = this.createMiniButton(width / 2 + 230, y + 12, '×5', 0x27ae60, () => {
        this.buyResource(res, 5);
      });

      this.contentContainer.add([bg, info, ratesText, sellBtn, sell5Btn, buyBtn, buy5Btn]);
      y += 55;
    }

    // Обмен ресурс-ресурс (секция)
    y += 10;
    const exchangeTitle = this.add.text(width / 2, y, '🔄 Обмен ресурс ↔ ресурс', {
      fontSize: '15px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(exchangeTitle);

    y += 30;
    const exchangeBtn = this.createMiniButton(width / 2, y, 'Открыть обмен', 0x8e44ad, () => {
      this.showResourceExchangeDialog();
    });
    // Делаем кнопку больше
    exchangeBtn.setSize(160, 30);
    this.contentContainer.add(exchangeBtn);

    // Показать золото
    y += 35;
    const goldInfo = this.add.text(width / 2, y, `💰 Золото: ${resources.gold}`, {
      fontSize: '16px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(goldInfo);
  }

  private sellResource(res: string, count: number): void {
    if (count <= 0) return;
    const resources = this.worldScene.getResources();
    if ((resources as any)[res] < count) {
      this.showNotification('❌ Недостаточно ресурсов!');
      return;
    }

    const rate = BASE_MARKET_RATES[res];
    if (!rate) return;
    
    const gold = rate.sell * count;
    
    (resources as any)[res] -= count;
    resources.gold += gold;

    this.showNotification(`✅ Продано ${count} ${res} за ${gold} 💰`);
    this.refreshUI();
  }

  private buyResource(res: string, count: number): void {
    const resources = this.worldScene.getResources();
    const rate = BASE_MARKET_RATES[res];
    if (!rate) return;
    
    const gold = rate.buy * count;
    
    if (resources.gold < gold) {
      this.showNotification(`❌ Недостаточно золота! Нужно: ${gold}`);
      return;
    }

    resources.gold -= gold;
    (resources as any)[res] += count;

    this.showNotification(`✅ Куплено ${count} ${res} за ${gold} 💰`);
    this.refreshUI();
  }

  private showResourceExchangeDialog(): void {
    // Простая реализация: обмениваем дерево на руду (самый частый обмен)
    const resources = this.worldScene.getResources() as any;
    
    if (resources.wood >= 5) {
      resources.wood -= 5;
      resources.ore += 4;
      this.showNotification('🔄 Обменяно 5 🪵 на 4 ⛏️');
      this.refreshUI();
    } else if (resources.ore >= 5) {
      resources.ore -= 5;
      resources.wood += 4;
      this.showNotification('🔄 Обменяно 5 ⛏️ на 4 🪵');
      this.refreshUI();
    } else {
      this.showNotification('❌ Нужно минимум 5 дерева или 5 руды для обмена');
    }
  }

  // ==================== КУЗНИЦА ====================

  private renderBlacksmith(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    const hasBlacksmith = this.town.builtBuildings.includes('blacksmith');
    if (!hasBlacksmith) {
      const noSmith = this.add.text(width / 2, 300, '⚒️ Постройте Кузницу для покупки артефактов', {
        fontSize: '18px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noSmith);
      return;
    }

    const title = this.add.text(width / 2, 140, '⚒️ Кузница артефактов', {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    // Показываем случайные 3 артефакта (обновляются каждую неделю)
    const availableArtifacts = this.getShopArtifacts();
    
    let y = 190;
    for (const artifact of availableArtifacts) {
      const cost = this.getArtifactCost(artifact);
      const canBuy = this.worldScene.getResources().gold >= cost;

      const rarityColors: Record<string, number> = {
        minor: 0x2c3e50, major: 0x8e44ad, relic: 0xe67e22
      };

      const bg = this.add.rectangle(width / 2, y, 700, 55, rarityColors[artifact.rarity] || 0x2c3e50, 0.95)
        .setStrokeStyle(2, canBuy ? 0xd4af37 : 0x444444);

      const name = this.add.text(width / 2 - 330, y - 10, artifact.name, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      const desc = this.add.text(width / 2 - 330, y + 10, artifact.description || artifact.rarity, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      });

      const price = this.add.text(width / 2 + 200, y, `💰 ${cost}`, {
        fontSize: '14px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
      }).setOrigin(0, 0.5);

      if (canBuy) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setStrokeStyle(3, 0xffd700));
        bg.on('pointerout', () => bg.setStrokeStyle(2, 0xd4af37));
        bg.on('pointerdown', () => this.buyArtifact(artifact, cost));
      }

      this.contentContainer.add([bg, name, desc, price]);
      y += 65;
    }
  }

  private getShopArtifacts(): any[] {
    if (!this.artifacts || this.artifacts.length === 0) {
      return [
        { id: 'sword_of_might', name: 'Меч силы', slot: 'weapon', rarity: 'minor', description: '+2 АТК' },
        { id: 'shield_of_protection', name: 'Щит защиты', slot: 'shield', rarity: 'minor', description: '+2 ЗАЩ' },
        { id: 'ring_of_wisdom', name: 'Кольцо мудрости', slot: 'ring', rarity: 'major', description: '+3 Сила магии' }
      ];
    }
    // Берём первые 3
    return this.artifacts.slice(0, 3);
  }

  private getArtifactCost(artifact: any): number {
    switch (artifact.rarity) {
      case 'minor': return 2000;
      case 'major': return 5000;
      case 'relic': return 15000;
      default: return 3000;
    }
  }

  private buyArtifact(artifact: any, cost: number): void {
    const resources = this.worldScene.getResources();
    if (resources.gold < cost) {
      this.showNotification('❌ Недостаточно золота!');
      return;
    }

    resources.gold -= cost;

    // Добавляем артефакт в инвентарь героя
    const hero = this.worldScene.getHero();
    if (!hero.equipment) hero.equipment = {};
    
    // Экипируем в свободный слот
    const slot = artifact.slot as string;
    (hero.equipment as any)[slot] = artifact;

    this.showNotification(`✨ Куплен: ${artifact.name}! Экипирован в слот "${slot}"`);
    this.refreshUI();
  }

  // ==================== СТРОИТЕЛЬСТВО ====================

  private buildBuilding(building: Building): void {
    if (!this.canAfford(building.cost) || !this.meetsRequirements(building)) return;

    const resources = this.worldScene.getResources();
    for (const [key, value] of Object.entries(building.cost)) {
      (resources as any)[key] -= value as number;
    }

    this.town.builtBuildings.push(building.id);

    // Если это жилище — показываем UI выбора существ (канон HoMM4)
    const creatureIds = building.creatures || [];
    if (creatureIds.length > 0) {
      const baseGrowth = (typeof building.creatureGrowth === 'number')
        ? building.creatureGrowth
        : (building.creatureGrowth?.amount || 8);
      // Применяем множитель прироста от фракционных зданий
      const growthMultiplier = this.getGrowthMultiplier();
      const growthPerUnit = Math.floor(baseGrowth * growthMultiplier);

      if (creatureIds.length >= 2) {
        // Показываем диалог выбора между двумя существами
        this.showCreatureChoiceDialog(building, creatureIds, growthPerUnit);
      } else {
        // Если только одно существо — добавляем сразу
        this.addCreaturesToHire(creatureIds, growthPerUnit);
        this.showNotification(`✅ Построено: ${building.name}!`);
        this.refreshUI();
      }
    } else {
      this.showNotification(`✅ Построено: ${building.name}!`);
      this.refreshUI();
    }
  }

  /**
   * Показать диалог выбора существа при постройке жилища (канон HoMM4)
   */
  private showCreatureChoiceDialog(building: Building, creatureIds: string[], growthPerUnit: number): void {
    const { width, height } = this.scale;
    
    // Затемнение фона
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive()
      .setDepth(600);
    this.contentContainer.add(overlay);

    // Диалоговое окно
    const dialogBg = this.add.rectangle(width / 2, height / 2, 500, 300, 0x1a1a2e, 0.98)
      .setStrokeStyle(3, 0xd4af37)
      .setDepth(601);
    this.contentContainer.add(dialogBg);

    const title = this.add.text(width / 2, height / 2 - 110, `🏗️ ${building.name}`, {
      fontSize: '20px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(602);
    this.contentContainer.add(title);

    const subtitle = this.add.text(width / 2, height / 2 - 80, 'Выберите существо для найма:', {
      fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI'
    }).setOrigin(0.5).setDepth(602);
    this.contentContainer.add(subtitle);

    // Получаем данные существ
    const creaturesData = this.registry.get('creatures') || this.getFallbackCreatures();
    const creature1 = creaturesData[creatureIds[0]];
    const creature2 = creaturesData[creatureIds[1]];

    // Кнопка выбора первого существа
    const btn1Y = height / 2 - 20;
    this.createChoiceButton(width / 2 - 130, btn1Y, creatureIds[0], creature1, growthPerUnit, () => {
      this.addCreaturesToHire([creatureIds[0]], growthPerUnit);
      this.closeChoiceDialog(overlay, dialogBg, title, subtitle);
      this.showNotification(`✅ Построено: ${building.name}! Выбраны ${creature1?.name || creatureIds[0]}`);
      this.refreshUI();
    });

    // Кнопка выбора второго существа
    const btn2Y = height / 2 + 60;
    this.createChoiceButton(width / 2 + 130, btn2Y, creatureIds[1], creature2, growthPerUnit, () => {
      this.addCreaturesToHire([creatureIds[1]], growthPerUnit);
      this.closeChoiceDialog(overlay, dialogBg, title, subtitle);
      this.showNotification(`✅ Построено: ${building.name}! Выбраны ${creature2?.name || creatureIds[1]}`);
      this.refreshUI();
    });
  }

  /**
   * Создать кнопку выбора существа в диалоге
   */
  private createChoiceButton(x: number, y: number, creatureId: string, creature: any, growth: number, onClick: () => void): void {
    const bg = this.add.rectangle(x, y, 200, 70, 0x2c3e50, 0.95)
      .setStrokeStyle(2, 0xd4af37)
      .setInteractive({ useHandCursor: true })
      .setDepth(602);
    
    const name = this.add.text(x, y - 15, creature?.name || creatureId, {
      fontSize: '15px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(603);

    const stats = this.add.text(x, y + 8,
      creature ? `АТК:${creature.attack} ЗАЩ:${creature.defense} HP:${creature.health || creature.hp}` : '',
      { fontSize: '10px', color: '#aaaaaa', fontFamily: 'Segoe UI' }
    ).setOrigin(0.5).setDepth(603);

    const growthText = this.add.text(x, y + 25, `Прирост: ${growth}/нед`, {
      fontSize: '11px', color: '#2ecc71', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(603);

    bg.on('pointerover', () => { bg.setFillStyle(0x34495e, 1); bg.setStrokeStyle(3, 0xffd700); });
    bg.on('pointerout', () => { bg.setFillStyle(0x2c3e50, 0.95); bg.setStrokeStyle(2, 0xd4af37); });
    bg.on('pointerdown', onClick);

    this.contentContainer.add([bg, name, stats, growthText]);
  }

  /**
   * Закрыть диалог выбора
   */
  private closeChoiceDialog(...elements: Phaser.GameObjects.GameObject[]): void {
    for (const el of elements) {
      el.destroy();
    }
  }

  /**
   * Добавить существ в availableForHire
   */
  private addCreaturesToHire(creatureIds: string[], growthPerUnit: number): void {
    for (const creatureId of creatureIds) {
      const existing = this.town.availableForHire.find(s => s.creatureId === creatureId);
      if (existing) {
        existing.count += growthPerUnit;
      } else {
        this.town.availableForHire.push({
          creatureId,
          count: growthPerUnit
        });
      }
    }
  }

  // ==================== ХЕЛПЕРЫ ====================

  private canAfford(cost: Partial<Resources>): boolean {
    const resources = this.worldScene.getResources();
    for (const [key, value] of Object.entries(cost)) {
      if ((resources as any)[key] < (value as number)) return false;
    }
    return true;
  }

  private meetsRequirements(building: Building): boolean {
    const reqs = building.requires || building.requirements || [];
    return reqs.every((req: string) => this.town.builtBuildings.includes(req));
  }

  /**
   * Получить суммарные эффекты от всех построенных зданий в городе.
   * Используется для расчёта прироста, морали, некромантии и т.д.
   */
  private getTownBuildingEffects(): Record<string, number> {
    const effects: Record<string, number> = {};
    const buildingsData = this.registry.get('buildings');
    if (!buildingsData) return effects;

    const allBuildings: Building[] = Array.isArray(buildingsData)
      ? buildingsData
      : (buildingsData.buildings || []);

    for (const building of allBuildings) {
      if (!this.town.builtBuildings.includes(building.id)) continue;
      if (!(building as any).effects) continue;

      const buildingEffects = (building as any).effects;
      for (const [key, value] of Object.entries(buildingEffects)) {
        if (typeof value === 'number') {
          effects[key] = (effects[key] || 0) + value;
        } else if (value === true) {
          effects[key] = 1;
        }
      }
    }

    return effects;
  }

  /**
   * Получить множитель прироста существ с учётом зданий
   */
  private getGrowthMultiplier(): number {
    const effects = this.getTownBuildingEffects();
    let mult = effects.growthMultiplier || 1;
    // Бонус к приросту от зданий
    if (effects.growthBonus) mult += effects.growthBonus * 0.01;
    return mult;
  }

  private createMiniButton(x: number, y: number, text: string, color: number, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 70, 24, color, 0.9).setStrokeStyle(1, 0xffffff);
    const label = this.add.text(0, 0, text, {
      fontSize: '11px', color: '#ffffff', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add([bg, label]);
    container.setSize(70, 24);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => bg.setAlpha(1));
    container.on('pointerout', () => bg.setAlpha(0.9));
    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container, scale: 0.9, duration: 50, yoyo: true,
        onComplete: onClick
      });
    });
    return container;
  }

  private refreshUI(): void {
    // Обновляем тексты ресурсов
    const resources = this.worldScene.getResources();
    this.resourceTexts.forEach((text, key) => {
      const icons: Record<string, string> = {
        gold: '💰', wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸'
      };
      text.setText(`${icons[key] || ''} ${(resources as any)[key]}`);
    });

    // Перерисовываем текущую вкладку
    this.showTab(this.activeTab);
  }

  private showNotification(text: string): void {
    const { width, height } = this.scale;
    const panel = this.add.rectangle(width / 2, height - 80, 400, 50, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x2ecc71);
    const msg = this.add.text(width / 2, height - 80, text, {
      fontSize: '16px', color: '#2ecc71', fontFamily: 'Segoe UI'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: [panel, msg],
      alpha: 0,
      delay: 2000,
      duration: 500,
      onComplete: () => { panel.destroy(); msg.destroy(); }
    });
  }

  private setupKeyboard(): void {
    this.input.keyboard?.on('keydown-ESC', () => this.returnToWorld());
    this.input.keyboard?.on('keydown-ONE', () => this.showTab('buildings'));
    this.input.keyboard?.on('keydown-TWO', () => this.showTab('hire'));
    this.input.keyboard?.on('keydown-THREE', () => this.showTab('upgrade'));
    this.input.keyboard?.on('keydown-FOUR', () => this.showTab('garrison'));
    this.input.keyboard?.on('keydown-FIVE', () => this.showTab('market'));
    this.input.keyboard?.on('keydown-SIX', () => this.showTab('mageguild'));
    this.input.keyboard?.on('keydown-SEVEN', () => this.showTab('blacksmith'));
    this.input.keyboard?.on('keydown-EIGHT', () => this.showTab('tavern'));
    this.input.keyboard?.on('keydown-NINE', () => this.showTab('shipyard'));
  }

  private returnToWorld(): void {
    // Обновляем UI на карте
    this.worldScene.updateResourceDisplay?.();
    this.scene.stop();
    this.scene.wake(CONFIG.SCENES.WORLD);
  }

  private loadBuildings(): Building[] {
    const buildingsData = this.registry.get('buildings');
    const faction = this.town.faction || 'haven';
    
    if (!buildingsData) {
      console.warn('[TownScene] Buildings data not loaded from registry');
      return this.getFallbackBuildings();
    }
    
    // Формат JSON: { buildings: [{ id, faction, ... }, ...] }
    const allBuildings: Building[] = Array.isArray(buildingsData) 
      ? buildingsData 
      : (buildingsData.buildings || []);
    
    // Фильтруем по фракции (common + faction)
    const factionBuildings = allBuildings.filter(b => 
      b.faction === 'common' || b.faction === faction
    );
    
    // Приводим к типу Building (JSON может использовать `requires` вместо `requirements`)
    // Для creatureGrowth используем ЦЕНТРАЛЬНЫЙ источник BASE_WEEKLY_GROWTH
    return factionBuildings.map(b => {
      const creatureId = b.creature;
      return {
        ...b,
        requires: b.requires || b.requirements || [],
        faction: b.faction || 'common',
        category: b.category || 'infrastructure',
        creatureGrowth: creatureId ? {
          creatureId,
          // Используем EconomySystem вместо хардкода!
          amount: BASE_WEEKLY_GROWTH[creatureId] || Math.max(2, 14 - ((b.tier || 1) - 1) * 2)
        } : undefined
      };
    });
  }
  
  private getFallbackBuildings(): Building[] {
    return [
      { id: 'citadel', name: 'Цитадель', description: 'Оборона', cost: { gold: 2000, ore: 10 }, requires: [], faction: 'common', category: 'defense' },
      { id: 'haven_dwelling_1', name: 'Сквайрский зал', description: 'Сквайр / Баллиста', cost: { gold: 500, wood: 5 }, requires: [], faction: 'haven', category: 'dwelling', creatures: ['squire', 'ballista'] },
      { id: 'haven_dwelling_2', name: 'Оружейная', description: 'Копейщик / Арбалетчик', cost: { gold: 1000, wood: 10 }, requires: ['haven_dwelling_1'], faction: 'haven', category: 'dwelling', creatures: ['pikeman_h4', 'archer_h4'] },
      { id: 'haven_dwelling_3', name: 'Храм', description: 'Крестоносец / Монах', cost: { gold: 2000, wood: 5, ore: 5 }, requires: ['haven_dwelling_2'], faction: 'haven', category: 'dwelling', creatures: ['crusader_h4', 'monk_h4'] },
      { id: 'haven_dwelling_4', name: 'Портал славы', description: 'Чемпион / Ангел', cost: { gold: 10000, wood: 10, ore: 10, crystal: 5 }, requires: ['haven_dwelling_3'], faction: 'haven', category: 'dwelling', creatures: ['champion_h4', 'angel_h4'] },
      { id: 'tavern', name: 'Таверна', description: 'Найм героев', cost: { gold: 500, wood: 5 }, requires: [], faction: 'common', category: 'infrastructure' },
      { id: 'marketplace', name: 'Рынок', description: 'Обмен ресурсов', cost: { gold: 500, wood: 5 }, requires: [], faction: 'common', category: 'economy' },
      { id: 'blacksmith', name: 'Кузница', description: 'Артефакты', cost: { gold: 1000, ore: 5 }, requires: [], faction: 'common', category: 'infrastructure' },
      { id: 'mageGuild1', name: 'Гильдия магов', description: 'Заклинания', cost: { gold: 1000, wood: 5 }, requires: [], faction: 'common', category: 'magic' },
      { id: 'shipyard', name: 'Верфь', description: 'Постройка кораблей', cost: { gold: 2000, wood: 20 }, requires: [], faction: 'common', category: 'infrastructure' }
    ];
  }

  private getFallbackCreatures(): any {
    return {
      pikeman: { id: 'pikeman', name: 'Ополченец', tier: 1, attack: 4, defense: 5, damage: { min: 1, max: 3 }, health: 10, speed: 5, growth: 14, cost: { gold: 60 }, abilities: [] },
      archer: { id: 'archer', name: 'Лучник', tier: 2, attack: 6, defense: 3, damage: { min: 2, max: 4 }, health: 10, speed: 4, growth: 9, cost: { gold: 100 }, abilities: ['shooter'] },
      skeleton: { id: 'skeleton', name: 'Скелет', tier: 1, attack: 5, defense: 4, damage: { min: 1, max: 3 }, health: 8, speed: 5, growth: 14, cost: { gold: 60 }, abilities: ['undead'] }
    };
  }

  // ==================== ТАВЕРНА ====================

  private renderTavern(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    const hasTavern = this.town.builtBuildings.includes('tavern');
    if (!hasTavern) {
      const noTavern = this.add.text(width / 2, 300, '🍺 Постройте Таверну для найма героев', {
        fontSize: '18px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(noTavern);
      return;
    }

    const title = this.add.text(width / 2, 140, '🍺 Таверна — найм героев (💰 2500)', {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    // Проверяем лимит героев
    const playerHeroes = this.worldScene.getPlayerHeroes ? this.worldScene.getPlayerHeroes() : [this.worldScene.getHero()];
    const maxHeroes = 3;
    
    if (playerHeroes.length >= maxHeroes) {
      const limitMsg = this.add.text(width / 2, 180, 
        `⚠️ Максимум ${maxHeroes} героев. Увольте одного для найма нового.`, {
        fontSize: '14px', color: '#e74c3c', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(limitMsg);
    }

    // Генерируем героев для найма (2-3 штуки)
    this.tavernHeroes = this.generateTavernHeroes();

    let y = 200;
    for (const tavernHero of this.tavernHeroes) {
      const canHire = this.worldScene.getResources().gold >= 2500 && playerHeroes.length < maxHeroes;

      const bg = this.add.rectangle(width / 2, y, 750, 80, 0x2c3e50, 0.95)
        .setStrokeStyle(2, canHire ? 0xd4af37 : 0x444444);

      // Иконка героя (цветной круг)
      const factionColors: Record<string, number> = {
        haven: 0x4169e1,
        necropolis: 0x8b0000,
        preserve: 0x228b22,
        asylum: 0xff4500,
        academy: 0x9370db,
        stronghold: 0xa0522d
      };
      const icon = this.add.circle(width / 2 - 340, y, 25, factionColors[tavernHero.faction] || 0x4169e1)
        .setStrokeStyle(2, 0xffffff);
      const iconText = this.add.text(width / 2 - 340, y, '👑', {
        fontSize: '20px'
      }).setOrigin(0.5);

      const nameText = this.add.text(width / 2 - 300, y - 20, tavernHero.name, {
        fontSize: '16px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      const classText = this.add.text(width / 2 - 300, y, `${tavernHero.class} (${tavernHero.faction})`, {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      });

      const statsText = this.add.text(width / 2 - 300, y + 15,
        `АТК:${tavernHero.stats.attack} ЗАЩ:${tavernHero.stats.defense} СП:${tavernHero.stats.spellPower} ЗН:${tavernHero.stats.knowledge}`, {
        fontSize: '11px', color: '#888888', fontFamily: 'Segoe UI'
      });

      // Армия героя
      const armyText = this.add.text(width / 2 + 50, y - 20,
        `Армия: ${tavernHero.army.map((s: any) => `${s.count}×${s.creatureId}`).join(', ')}`, {
        fontSize: '11px', color: '#2ecc71', fontFamily: 'Segoe UI'
      });

      const costText = this.add.text(width / 2 + 50, y, '💰 2500', {
        fontSize: '14px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      if (canHire) {
        const hireBtn = this.createMiniButton(width / 2 + 320, y, 'Нанять', 0x2ecc71, () => {
          this.hireTavernHero(tavernHero);
        });
        this.contentContainer.add([bg, icon, iconText, nameText, classText, statsText, armyText, costText, hireBtn]);
      } else {
        const disabledBtn = this.createMiniButton(width / 2 + 320, y, 'Нанять', 0x555555, () => {
          if (this.worldScene.getResources().gold < 2500) {
            this.showNotification('❌ Недостаточно золота!');
          } else {
            this.showNotification(`❌ Максимум ${maxHeroes} героев!`);
          }
        });
        this.contentContainer.add([bg, icon, iconText, nameText, classText, statsText, armyText, costText, disabledBtn]);
      }

      y += 90;
    }

    // Информация о текущих героях
    const currentHeroesTitle = this.add.text(width / 2, y + 20, '🦸 Ваши герои:', {
      fontSize: '14px', color: '#4169e1', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(currentHeroesTitle);

    let heroY = y + 50;
    for (const hero of playerHeroes) {
      const heroInfo = this.add.text(width / 2, heroY, 
        `${hero.name} (${hero.class}) — Уровень ${hero.level}, Армия: ${hero.army.length} отрядов`, {
        fontSize: '12px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
      this.contentContainer.add(heroInfo);
      heroY += 25;
    }

    // === СБЕЖАВШИЕ ГЕРОИ ИЗ ПЛЕНА (канон HoMM4) ===
    const captureSystem = this.worldScene.captureSystem;
    if (captureSystem?.getCapturedByPlayer) {
      const captured = captureSystem.getCapturedByPlayer();
      if (captured.length > 0) {
        heroY += 20;
        const capturedTitle = this.add.text(width / 2, heroY, '🔒 Захваченные вами герои (выкуп):', {
          fontSize: '14px', color: '#e74c3c', fontFamily: 'Segoe UI', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.contentContainer.add(capturedTitle);
        heroY += 25;

        for (const cap of captured) {
          const ransomCost = cap.ransomCost?.gold || 500;
          const canAfford = this.worldScene.getResources().gold >= ransomCost;
          
          const capInfo = this.add.text(width / 2 - 100, heroY,
            `${cap.hero.name} (${cap.hero.class}) — Выкуп: 💰${ransomCost}`, {
            fontSize: '12px', color: '#f0e6d2', fontFamily: 'Segoe UI'
          }).setOrigin(0.5);
          this.contentContainer.add(capInfo);

          if (canAfford) {
            const ransomBtn = this.createMiniButton(width / 2 + 150, heroY, '💰Выкупить', 0x2ecc71, () => {
              const result = captureSystem.ransomHero(cap.hero.id, this.worldScene.getResources());
              if (result.success) {
                this.showNotification(result.message);
                this.refreshUI();
              } else {
                this.showNotification(`❌ ${result.message}`);
              }
            });
            this.contentContainer.add(ransomBtn);
          }

          heroY += 25;
        }
      }
    }
  }

  private generateTavernHeroes(): any[] {
    const heroes: any[] = [];
    const count = 2 + Math.floor(Math.random() * 2); // 2-3 героя

    const heroTemplates: Record<string, any[]> = {
      haven: [
        { name: 'Сэр Гэвин', class: 'Рыцарь', stats: { attack: 3, defense: 3, spellPower: 1, knowledge: 1, morale: 1, luck: 0 } },
        { name: 'Леди Кэтрин', class: 'Рыцарь', stats: { attack: 2, defense: 4, spellPower: 1, knowledge: 1, morale: 1, luck: 1 } },
        { name: 'Паладин Артур', class: 'Паладин', stats: { attack: 4, defense: 2, spellPower: 2, knowledge: 1, morale: 1, luck: 0 } }
      ],
      necropolis: [
        { name: 'Мортис', class: 'Некромант', stats: { attack: 1, defense: 1, spellPower: 4, knowledge: 4, morale: -1, luck: 0 } },
        { name: 'Сандро', class: 'Некромант', stats: { attack: 2, defense: 2, spellPower: 3, knowledge: 3, morale: -1, luck: 0 } },
        { name: 'Видомина', class: 'Некромант', stats: { attack: 1, defense: 2, spellPower: 4, knowledge: 3, morale: -1, luck: 0 } }
      ],
      preserve: [
        { name: 'Элани', class: 'Следопыт', stats: { attack: 3, defense: 2, spellPower: 2, knowledge: 2, morale: 1, luck: 1 } },
        { name: 'Гемма', class: 'Друид', stats: { attack: 2, defense: 2, spellPower: 3, knowledge: 3, morale: 1, luck: 1 } }
      ],
      asylum: [
        { name: 'Грок', class: 'Варвар', stats: { attack: 4, defense: 3, spellPower: 0, knowledge: 1, morale: 1, luck: 1 } },
        { name: 'Тирания', class: 'Варвар', stats: { attack: 5, defense: 2, spellPower: 0, knowledge: 1, morale: 1, luck: 0 } }
      ],
      academy: [
        { name: 'Аламар', class: 'Волшебник', stats: { attack: 1, defense: 1, spellPower: 5, knowledge: 4, morale: 0, luck: 0 } },
        { name: 'Иона', class: 'Волшебник', stats: { attack: 2, defense: 2, spellPower: 4, knowledge: 3, morale: 0, luck: 0 } }
      ],
      stronghold: [
        { name: 'Краг Хак', class: 'Вождь', stats: { attack: 5, defense: 4, spellPower: 0, knowledge: 0, morale: 1, luck: 1 } },
        { name: 'Шива', class: 'Вождь', stats: { attack: 4, defense: 3, spellPower: 1, knowledge: 1, morale: 1, luck: 1 } }
      ]
    };

    const faction = this.town.faction || 'haven';
    const templates = heroTemplates[faction] || heroTemplates.haven;

    for (let i = 0; i < count; i++) {
      const template = templates[Math.floor(Math.random() * templates.length)];
      
      // Генерируем случайную начальную армию
      const army = this.generateStartingArmy(faction);

      heroes.push({
        ...template,
        faction,
        level: 1,
        experience: 0,
        mana: 20,
        maxMana: 20,
        army,
        equipment: {},
        spells: [],
        skills: []
      });
    }

    return heroes;
  }

  private generateStartingArmy(faction: string): any[] {
    const armies: Record<string, any[]> = {
      haven: [
        { creatureId: 'squire', count: 15 + Math.floor(Math.random() * 10) },
        { creatureId: 'ballista', count: 8 + Math.floor(Math.random() * 5) }
      ],
      necropolis: [
        { creatureId: 'skeleton_h4', count: 20 + Math.floor(Math.random() * 10) },
        { creatureId: 'imp_h4', count: 12 + Math.floor(Math.random() * 8) }
      ],
      preserve: [
        { creatureId: 'sprite', count: 10 + Math.floor(Math.random() * 8) },
        { creatureId: 'elf_h4', count: 6 + Math.floor(Math.random() * 4) }
      ],
      asylum: [
        { creatureId: 'bandit', count: 18 + Math.floor(Math.random() * 10) },
        { creatureId: 'orc_h4', count: 8 + Math.floor(Math.random() * 5) }
      ],
      academy: [
        { creatureId: 'dwarf_h4', count: 10 + Math.floor(Math.random() * 6) },
        { creatureId: 'halfling', count: 12 + Math.floor(Math.random() * 6) }
      ],
      stronghold: [
        { creatureId: 'berserker', count: 15 + Math.floor(Math.random() * 10) },
        { creatureId: 'centaur', count: 8 + Math.floor(Math.random() * 5) }
      ]
    };

    return armies[faction] || armies.haven;
  }

  // ==================== ВЕРФЬ (канон HoMM4) ====================

  /**
   * Отрисовка вкладки "⚓ Верфь"
   * В каноне HoMM4: постройка кораблей (только лодка, 1000 золота)
   * Требует: построенное здание shipyard + вода рядом с городом
   */
  private renderShipyard(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    this.contentContainer.add(panel);

    // Проверка 1: построена ли верфь?
    const hasShipyard = this.town.builtBuildings.includes('shipyard');
    if (!hasShipyard) {
      const noShipyard = this.add.text(width / 2, 280,
        '⚓ Постройте Верфь для покупки кораблей', {
          fontSize: '18px', color: '#888888', fontFamily: 'Segoe UI'
        }).setOrigin(0.5);
      const hint = this.add.text(width / 2, 320,
        'Требуется: 💰 2000 + 🪵 20 дерева', {
          fontSize: '14px', color: '#666666', fontFamily: 'Segoe UI'
        }).setOrigin(0.5);
      this.contentContainer.add([noShipyard, hint]);
      return;
    }

    // Проверка 2: есть ли вода рядом с городом?
    const map = this.worldScene.getMap ? this.worldScene.getMap() : null;
    const mapSize = this.worldScene.getMapSize ? this.worldScene.getMapSize() : { w: 60, h: 60 };
    const canBuild = map && canBuildShipyard(
      this.town.x, this.town.y, map, mapSize.w, mapSize.h
    );

    if (!canBuild) {
      const noWater = this.add.text(width / 2, 280,
        '🌊 Верфь не может строить — нет воды рядом с городом!', {
          fontSize: '18px', color: '#e74c3c', fontFamily: 'Segoe UI'
        }).setOrigin(0.5);
      const hint = this.add.text(width / 2, 320,
        'Верфь должна быть построена у берега (в радиусе 2 клеток от города)', {
          fontSize: '13px', color: '#888888', fontFamily: 'Segoe UI'
        }).setOrigin(0.5);
      this.contentContainer.add([noWater, hint]);
      return;
    }

    // Заголовок
    const title = this.add.text(width / 2, 150,
      '⚓ Верфь — постройка кораблей', {
        fontSize: '20px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
      }).setOrigin(0.5);
    this.contentContainer.add(title);

    const subtitle = this.add.text(width / 2, 180,
      'В каноне HoMM4 был только один тип корабля — обычная лодка', {
        fontSize: '12px', color: '#888888', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);
    this.contentContainer.add(subtitle);

    // === ЕДИНСТВЕННЫЙ ТИП КОРАБЛЯ: ЛОДКА (канон HoMM4) ===
    const shipCost = SHIP_COSTS.boat;
    const resources = this.worldScene.getResources();
    const canAfford = resources.gold >= shipCost;

    const bg = this.add.rectangle(width / 2, 280, 700, 140, 0x2c3e50, 0.95)
      .setStrokeStyle(2, canAfford ? 0xd4af37 : 0x444444);

    // Визуал корабля
    const boatBg = this.add.circle(width / 2 - 260, 280, 45, 0x4a7c9f, 0.95)
      .setStrokeStyle(3, 0x87ceeb);
    const boatIcon = this.add.text(width / 2 - 260, 280, '🚢', {
      fontSize: '48px'
    }).setOrigin(0.5);

    // Название
    const name = this.add.text(width / 2 - 180, 240, 'Лодка (Boat)', {
      fontSize: '22px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
    });

    // Описание
    const desc = this.add.text(width / 2 - 180, 270,
      'Позволяет герою перемещаться по воде.\nПосадка/высадка на берег. Телепортация через водовороты.', {
        fontSize: '12px', color: '#aaaaaa', fontFamily: 'Segoe UI',
        wordWrap: { width: 450 }
      });

    // Статы
    const stats = this.add.text(width / 2 - 180, 310,
      '📦 Вместимость: 7 слотов армии  |  🚀 Скорость: базовая', {
        fontSize: '12px', color: '#87ceeb', fontFamily: 'Segoe UI'
      });

    // Цена
    const price = this.add.text(width / 2 - 180, 340,
      `💰 Стоимость: ${shipCost} золота`, {
        fontSize: '16px', color: canAfford ? '#ffd700' : '#e74c3c',
        fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

    // Текущее золото игрока
    const playerGold = this.add.text(width / 2 - 180, 365,
      `У вас: 💰 ${resources.gold} золота`, {
        fontSize: '12px', color: '#888888', fontFamily: 'Segoe UI'
      });

    // Кнопка "Купить"
    if (canAfford) {
      const buyBtn = this.createMiniButton(width / 2 + 260, 280, '🚢 КУПИТЬ', 0x2ecc71, () => {
        this.buyShip();
      });
      this.contentContainer.add([bg, boatBg, boatIcon, name, desc, stats, price, playerGold, buyBtn]);
    } else {
      const disabledBtn = this.createMiniButton(width / 2 + 260, 280, '❌ Нет золота', 0x555555, () => {
        this.showNotification('❌ Недостаточно золота!');
      });
      this.contentContainer.add([bg, boatBg, boatIcon, name, desc, stats, price, playerGold, disabledBtn]);
    }

    // === ИНФОРМАЦИЯ О ИСПОЛЬЗОВАНИИ ===
    const usageTitle = this.add.text(width / 2, 420, '📖 Как использовать корабль:', {
      fontSize: '16px', color: '#4a7c9f', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);

    const usageText = this.add.text(width / 2, 450,
      '• Корабль появится на ближайшей водной клетке рядом с городом\n' +
      '• Подойдите к кораблю и кликните по нему — герой сядет на борт\n' +
      '• Кликните по берегу — герой высадится (корабль останется на воде)\n' +
      '• ⚠️ Водовороты имеют 25% шанс потери слабейшего отряда (канон HoMM4)', {
        fontSize: '12px', color: '#cccccc', fontFamily: 'Segoe UI',
        wordWrap: { width: 700 }, lineSpacing: 4
      }).setOrigin(0.5);

    this.contentContainer.add([usageTitle, usageText]);

    // === СТАТИСТИКА ===
    const playerHeroes = this.worldScene.getPlayerHeroes ? this.worldScene.getPlayerHeroes() : [this.worldScene.getHero()];
    const heroesOnShip = playerHeroes.filter((h: any) => h.onShipId);
    
    const statsText = this.add.text(width / 2, 540,
      `🦸 Героев на кораблях: ${heroesOnShip.length} из ${playerHeroes.length}`,
      { fontSize: '14px', color: '#87ceeb', fontFamily: 'Segoe UI' }
    ).setOrigin(0.5);
    this.contentContainer.add(statsText);
  }

  /**
   * Покупка корабля
   * Списывает 1000 золота и размещает корабль на ближайшей водной клетке рядом с городом
   */
  private buyShip(): void {
    const resources = this.worldScene.getResources();
    const cost = SHIP_COSTS.boat;

    if (resources.gold < cost) {
      this.showNotification('❌ Недостаточно золота!');
      return;
    }

    // Списываем золото
    resources.gold -= cost;

    // Ищем ближайшую водную клетку рядом с городом для размещения корабля
    const map = this.worldScene.getMap();
    const mapSize = this.worldScene.getMapSize();
    const townX = this.town.x;
    const townY = this.town.y;

    let shipX = -1;
    let shipY = -1;

    // Поиск в расширяющемся радиусе (1-5 клеток)
    for (let radius = 1; radius <= 5; radius++) {
      if (shipX >= 0) break;
      for (let dy = -radius; dy <= radius && shipX < 0; dy++) {
        for (let dx = -radius; dx <= radius && shipX < 0; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue; // Только периметр
          const nx = townX + dx;
          const ny = townY + dy;
          if (nx < 0 || nx >= mapSize.w || ny < 0 || ny >= mapSize.h) continue;
          const tile = map[ny][nx];
          if (tile.type === 'water' && !tile.object) {
            shipX = nx;
            shipY = ny;
          }
        }
      }
    }

    if (shipX < 0) {
      // Не нашли воду — возвращаем золото
      resources.gold += cost;
      this.showNotification('❌ Нет свободной воды рядом с городом!');
      return;
    }

    // Создаём объект корабля и размещаем на карте
    const shipObj = createShipObject(shipX, shipY, 'boat');
    
    // Вызываем метод WorldScene для размещения объекта (если он есть)
    if (this.worldScene.placeObjectSafe) {
      this.worldScene.placeObjectSafe(shipObj.id, 'boat', shipX, shipY, shipObj.data);
    } else {
      // Fallback: напрямую в map
      map[shipY][shipX].object = shipObj;
    }

    this.showNotification(`✅ Корабль построен на клетке (${shipX}, ${shipY})!`);
    this.refreshUI();
  }

  private hireTavernHero(tavernHero: any): void {
    const resources = this.worldScene.getResources();
    const heroCost = 2500;

    if (resources.gold < heroCost) {
      this.showNotification('❌ Недостаточно золота!');
      return;
    }

    // Проверяем лимит героев
    const playerHeroes = this.worldScene.getPlayerHeroes ? this.worldScene.getPlayerHeroes() : [this.worldScene.getHero()];
    if (playerHeroes.length >= 3) {
      this.showNotification('❌ Максимум 3 героя!');
      return;
    }

    // Списываем золото
    resources.gold -= heroCost;

    // Создаём нового героя
    const newHero: Hero = {
      id: `hero_${Date.now()}`,
      name: tavernHero.name,
      class: tavernHero.class,
      faction: tavernHero.faction,
      level: tavernHero.level,
      experience: tavernHero.experience,
      stats: tavernHero.stats,
      skills: tavernHero.skills || [],
      mana: tavernHero.mana,
      maxMana: tavernHero.maxMana,
      army: tavernHero.army,
      equipment: tavernHero.equipment || {},
      spells: tavernHero.spells || [],
      specialization: tavernHero.specialization,
      x: this.town.x,
      y: this.town.y,
      movementPoints: 1500,
      maxMovementPoints: 1500,
      morale: 0,
      luck: 0,
      owner: 'player',
      mapLevel: 'surface'
    };

    // Добавляем героя в WorldScene
    if (this.worldScene.addNewHero) {
      this.worldScene.addNewHero(newHero, this.town.x, this.town.y);
    } else {
      console.warn('[TownScene] addNewHero method not found in WorldScene');
    }

    this.showNotification(`✅ Нанят герой: ${newHero.name}!`);
    this.refreshUI();
  }

  // ==================== АЛХИМИК (ЗЕЛЬЯ) ====================

  private renderAlchemy(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x9b59b6);
    this.contentContainer.add(panel);

    const potionSystem = new PotionSystem();
    const hero = this.worldScene.getHero();
    const buildings = this.town.builtBuildings;
    const availablePotions = potionSystem.getAvailablePotions(buildings);

    if (availablePotions.length === 0) {
      const noLab = this.add.text(width / 2, 300, '🧪 Нет алхимической лаборатории.\nПостройте Гильдию магов для доступа к зельям.', {
        fontSize: '16px', color: '#999999', fontFamily: 'Segoe UI', align: 'center'
      }).setOrigin(0.5);
      this.contentContainer.add(noLab);
      return;
    }

    const title = this.add.text(width / 2, 170, '🧪 Алхимическая лавка', {
      fontSize: '20px', color: '#9b59b6', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    let y = 210;
    for (const potion of availablePotions) {
      const canAfford = (potion.cost.gold || 0) <= this.worldScene.getResources().gold;
      const bg = this.add.rectangle(width / 2, y, 750, 50,
        canAfford ? 0x2c3e50 : 0x1a1a2e, 0.95
      ).setStrokeStyle(2, canAfford ? 0x9b59b6 : 0x444444);

      const nameText = this.add.text(width / 2 - 360, y - 8, `${potion.name}`, {
        fontSize: '14px', color: canAfford ? '#f0e6d2' : '#666666', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      const descText = this.add.text(width / 2 - 360, y + 8, `${potion.description} | ${potion.rarity}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      });

      const costStr = Object.entries(potion.cost).map(([k, v]) => `${k}: ${v}`).join(' | ');
      const costText = this.add.text(width / 2 + 200, y, costStr, {
        fontSize: '12px', color: canAfford ? '#ffd700' : '#666666', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);

      if (canAfford) {
        bg.setInteractive({ useHandCursor: true });
        bg.on('pointerover', () => bg.setFillStyle(0x34495e, 1));
        bg.on('pointerout', () => bg.setFillStyle(0x2c3e50, 0.95));
        bg.on('pointerdown', () => {
          const result = potionSystem.buyPotion(hero, potion.id, this.worldScene.getResources());
          if (result.success) {
            this.showNotification(result.message);
            this.refreshUI();
          } else {
            this.showNotification(`❌ ${result.message}`);
          }
        });
      }

      this.contentContainer.add([bg, nameText, descText, costText]);
      y += 58;
    }
  }

  // ==================== РАЗРУШЕНИЕ ГОРОДА ====================

  private renderRaze(): void {
    const { width } = this.scale;
    const panel = this.add.rectangle(width / 2, 400, 800, 500, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xe74c3c);
    this.contentContainer.add(panel);

    const razeSystem = new RazeSystem();
    const allTowns = this.worldScene.victorySystem?.getAllTowns() || [];
    const playerTowns = allTowns.filter((t: any) => t.owner === 'player');

    // Нельзя разрушить свой город
    if (this.town.owner === 'player') {
      const info = this.add.text(width / 2, 300, '❌ Нельзя разрушить свой город!\nЭта функция доступна только для захваченных вражеских городов.', {
        fontSize: '16px', color: '#e74c3c', fontFamily: 'Segoe UI', align: 'center'
      }).setOrigin(0.5);
      this.contentContainer.add(info);
      return;
    }

    const error = razeSystem.canRazeTown(this.townId, allTowns, playerTowns);
    if (error) {
      const info = this.add.text(width / 2, 300, `❌ ${error}`, {
        fontSize: '16px', color: '#e74c3c', fontFamily: 'Segoe UI', align: 'center'
      }).setOrigin(0.5);
      this.contentContainer.add(info);
      return;
    }

    const rewardInfo = razeSystem.calculateRazeReward(this.town as any);

    const title = this.add.text(width / 2, 200, '💥 Разрушить город', {
      fontSize: '24px', color: '#e74c3c', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    const warning = this.add.text(width / 2, 250, `Город: ${this.town.name}\nФракция: ${this.town.faction}`, {
      fontSize: '16px', color: '#f0e6d2', fontFamily: 'Segoe UI', align: 'center'
    }).setOrigin(0.5);
    this.contentContainer.add(warning);

    const rewardText = this.add.text(width / 2, 320, `Награда: ${rewardInfo.reward.gold} золота (${Math.round(rewardInfo.rewardPercent * 100)}% от стоимости)`, {
      fontSize: '16px', color: '#ffd700', fontFamily: 'Segoe UI'
    }).setOrigin(0.5);
    this.contentContainer.add(rewardText);

    const razeBtn = this.add.text(width / 2, 400, '💥 РАЗРУШИТЬ', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Segoe UI', fontStyle: 'bold',
      backgroundColor: '#c0392b', padding: { x: 30, y: 15 }
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    razeBtn.on('pointerover', () => razeBtn.setBackgroundColor('#e74c3c'));
    razeBtn.on('pointerout', () => razeBtn.setBackgroundColor('#c0392b'));
    razeBtn.on('pointerdown', () => {
      const result = razeSystem.razeTown(this.townId, allTowns, playerTowns);
      if (result.success) {
        this.worldScene.addResources(result.reward);
        // Удаляем город с карты (канон HoMM4)
        this.worldScene.removeRazedTown?.(this.townId);
        this.showNotification(result.message);
        this.scene.stop(CONFIG.SCENES.TOWN);
        this.scene.wake(CONFIG.SCENES.WORLD);
      } else {
        this.showNotification(`❌ ${result.message}`);
      }
    });
    this.contentContainer.add(razeBtn);
  }
}
