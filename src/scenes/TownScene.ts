import Phaser from 'phaser';
import { CONFIG } from '../config';
import { Town, Building, Resources, ArmySlot, Artifact } from '../types';
import { TownOwnership } from '../systems/VictorySystem';

/**
 * TownScene — полноценная система города:
 * - 🏗️ Строительство зданий
 * - 👥 Найм существ с учётом прироста (неделя)
 * - 🏪 Рынок обмена ресурсов
 * - ⚒️ Кузница артефактов
 * - 🍺 Таверна (найм героев)
 * - 📦 Передача армии между героем и гарнизоном
 */
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
  private activeTab: 'buildings' | 'hire' | 'market' | 'blacksmith' | 'garrison' = 'buildings';
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
        builtBuildings: ['citadel', 'barracks'],
        garrison: [],
        availableForHire: [
          { creatureId: 'pikeman', count: 14 },
          { creatureId: 'archer', count: 9 }
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
      { id: 'buildings', label: '🏗️ Здания', x: width / 2 - 250 },
      { id: 'hire', label: '👥 Найм', x: width / 2 - 130 },
      { id: 'garrison', label: '🛡️ Гарнизон', x: width / 2 - 10 },
      { id: 'market', label: '🏪 Рынок', x: width / 2 + 110 },
      { id: 'blacksmith', label: '⚒️ Кузница', x: width / 2 + 230 }
    ];

    for (const tab of tabs) {
      const container = this.add.container(tab.x, 85);
      const bg = this.add.rectangle(0, 0, 110, 36, 0x2c3e50, 0.9)
        .setStrokeStyle(2, 0x555555);
      const label = this.add.text(0, 0, tab.label, {
        fontSize: '13px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0.5);

      container.add([bg, label]);
      container.setSize(110, 36);
      container.setInteractive({ useHandCursor: true });
      
      container.on('pointerdown', () => {
        this.showTab(tab.id as any);
      });
      
      container.on('pointerover', () => {
        if (this.activeTab !== tab.id as any) {
          bg.setFillStyle(0x34495e, 1);
        }
      });
      container.on('pointerout', () => {
        if (this.activeTab !== tab.id as any) {
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
      case 'garrison': this.renderGarrison(); break;
      case 'market': this.renderMarket(); break;
      case 'blacksmith': this.renderBlacksmith(); break;
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

      const costPerUnit = creature.cost.gold || 0;
      const totalCost = costPerUnit * slot.count;

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
        `АТК:${creature.attack} ЗАЩ:${creature.defense} HP:${creature.health} ⚔️${creature.damage.min}-${creature.damage.max} 🏃${creature.speed}`, {
        fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI'
      });

      const availableText = this.add.text(width / 2 + 50, y - 8, `Доступно: ${slot.count}`, {
        fontSize: '14px', color: '#2ecc71', fontFamily: 'Segoe UI', fontStyle: 'bold'
      });

      const costText = this.add.text(width / 2 + 50, y + 10, `💰 ${costPerUnit}/шт (всего: ${totalCost})`, {
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

    const totalCost = (creature.cost.gold || 0) * count;
    const resources = this.worldScene.getResources();
    if (resources.gold < totalCost) {
      this.showNotification(`❌ Недостаточно золота! Нужно: ${totalCost}`);
      return;
    }

    // Списываем золото
    resources.gold -= totalCost;

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

    const title = this.add.text(width / 2, 140, '🏪 Обмен ресурсов (курс: 1 ед → золото)', {
      fontSize: '18px', color: '#d4af37', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    this.contentContainer.add(title);

    const resources = this.worldScene.getResources();
    const icons: Record<string, string> = {
      wood: '🪵', ore: '⛏️', crystal: '💎', gems: '💠', sulfur: '🟡', mercury: '🩸'
    };

    let y = 190;
    const tradable = ['wood', 'ore', 'crystal', 'gems', 'sulfur', 'mercury'];
    
    for (const res of tradable) {
      const rate = this.marketRates[res] || 500;
      const bg = this.add.rectangle(width / 2, y, 700, 50, 0x2c3e50, 0.95)
        .setStrokeStyle(1, 0x555555);
      
      const info = this.add.text(width / 2 - 330, y, 
        `${icons[res]} ${(resources as any)[res]} шт — курс: ${rate} зол/шт`, {
        fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI'
      }).setOrigin(0, 0.5);

      const sellBtn = this.createMiniButton(width / 2 + 100, y, 'Продать 1', 0xe67e22, () => {
        this.sellResource(res, 1);
      });
      const sellAllBtn = this.createMiniButton(width / 2 + 200, y, 'Всё', 0xc0392b, () => {
        this.sellResource(res, (resources as any)[res]);
      });
      const buyBtn = this.createMiniButton(width / 2 + 290, y, 'Купить 1', 0x27ae60, () => {
        this.buyResource(res, 1);
      });

      this.contentContainer.add([bg, info, sellBtn, sellAllBtn, buyBtn]);
      y += 55;
    }

    // Обмен золота на ресурсы
    const goldInfo = this.add.text(width / 2, y + 20, `💰 Золото: ${resources.gold}`, {
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

    const rate = this.marketRates[res] || 500;
    const gold = rate * count;
    
    (resources as any)[res] -= count;
    resources.gold += gold;

    this.showNotification(`✅ Продано ${count} ${res} за ${gold} 💰`);
    this.refreshUI();
  }

  private buyResource(res: string, count: number): void {
    const resources = this.worldScene.getResources();
    const rate = this.marketRates[res] || 500;
    const gold = rate * count;
    
    if (resources.gold < gold) {
      this.showNotification(`❌ Недостаточно золота! Нужно: ${gold}`);
      return;
    }

    resources.gold -= gold;
    (resources as any)[res] += count;

    this.showNotification(`✅ Куплено ${count} ${res} за ${gold} 💰`);
    this.refreshUI();
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

    // Если это жилище — добавляем существ для найма
    if (building.creatureGrowth) {
      const existing = this.town.availableForHire.find(s => s.creatureId === building.creatureGrowth!.creatureId);
      if (existing) {
        existing.count += building.creatureGrowth.amount;
      } else {
        this.town.availableForHire.push({
          creatureId: building.creatureGrowth.creatureId,
          count: building.creatureGrowth.amount
        });
      }
    }

    this.showNotification(`✅ Построено: ${building.name}!`);
    this.refreshUI();
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
    return building.requirements.every(req => this.town.builtBuildings.includes(req));
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
    this.input.keyboard?.on('keydown-THREE', () => this.showTab('garrison'));
    this.input.keyboard?.on('keydown-FOUR', () => this.showTab('market'));
    this.input.keyboard?.on('keydown-FIVE', () => this.showTab('blacksmith'));
  }

  private returnToWorld(): void {
    // Обновляем UI на карте
    this.worldScene.updateResourceDisplay?.();
    this.scene.stop();
    this.scene.wake(CONFIG.SCENES.WORLD);
  }

  private loadBuildings(): Building[] {
    const buildings = this.registry.get('buildings');
    const faction = this.town.faction || 'haven';
    return buildings?.[faction] || [];
  }

  private getFallbackCreatures(): any {
    return {
      pikeman: { id: 'pikeman', name: 'Ополченец', tier: 1, attack: 4, defense: 5, damage: { min: 1, max: 3 }, health: 10, speed: 5, growth: 14, cost: { gold: 60 }, abilities: [] },
      archer: { id: 'archer', name: 'Лучник', tier: 2, attack: 6, defense: 3, damage: { min: 2, max: 4 }, health: 10, speed: 4, growth: 9, cost: { gold: 100 }, abilities: ['shooter'] },
      skeleton: { id: 'skeleton', name: 'Скелет', tier: 1, attack: 5, defense: 4, damage: { min: 1, max: 3 }, health: 8, speed: 5, growth: 14, cost: { gold: 60 }, abilities: ['undead'] }
    };
  }
}
