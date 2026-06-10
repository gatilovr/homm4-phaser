/**
 * AdventureMagicBook - UI книга заклинаний на карте приключений (канон HoMM4)
 * 
 * Отображает 8 заклинаний с иконками, стоимостью маны и описанием.
 * Серый цвет для недоступных заклинаний.
 * 
 * Открытие: клавиша M на карте
 */

import Phaser from 'phaser';
import { Hero } from '../types';
import { 
  AdventureMagicSystem, 
  AdventureSpell, 
  AdventureSpellId,
  ADVENTURE_SPELLS 
} from '../systems/AdventureMagicSystem';

/**
 * Callback при выборе заклинания
 */
export type SpellSelectCallback = (spellId: AdventureSpellId) => void;

/**
 * UI класс книги заклинаний на карте
 */
export class AdventureMagicBook {
  private scene: Phaser.Scene;
  private hero: Hero;
  private onSelect: SpellSelectCallback;
  
  // UI элементы
  private container: Phaser.GameObjects.Container;
  private background: Phaser.GameObjects.Graphics;
  private spellButtons: Map<string, Phaser.GameObjects.Container> = new Map();
  private isVisible: boolean = false;
  
  // Константы UI
  private readonly BOOK_WIDTH = 600;
  private readonly BOOK_HEIGHT = 450;
  private readonly SPELL_CARD_WIDTH = 120;
  private readonly SPELL_CARD_HEIGHT = 100;
  private readonly COLS = 4;
  private readonly ROWS = 2;
  private readonly PADDING = 15;
  
  constructor(scene: Phaser.Scene, hero: Hero, onSelect: SpellSelectCallback) {
    this.scene = scene;
    this.hero = hero;
    this.onSelect = onSelect;
    
    this.container = scene.add.container(0, 0);
    this.container.setDepth(1000);
    this.container.setVisible(false);
    
    this.createBookUI();
  }
  
  /**
   * Создать UI книги заклинаний
   */
  private createBookUI(): void {
    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Затемнение фона
    const overlay = this.scene.add.graphics();
    overlay.fillStyle(0x000000, 0.7);
    overlay.fillRect(0, 0, width, height);
    overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );
    overlay.on('pointerdown', () => this.hide());
    this.container.add(overlay);
    
    // Фон книги
    this.background = this.scene.add.graphics();
    this.background.fillStyle(0x2c1810, 1);
    this.background.fillRoundedRect(
      centerX - this.BOOK_WIDTH / 2,
      centerY - this.BOOK_HEIGHT / 2,
      this.BOOK_WIDTH,
      this.BOOK_HEIGHT,
      10
    );
    this.background.lineStyle(3, 0x8b4513, 1);
    this.background.strokeRoundedRect(
      centerX - this.BOOK_WIDTH / 2,
      centerY - this.BOOK_HEIGHT / 2,
      this.BOOK_WIDTH,
      this.BOOK_HEIGHT,
      10
    );
    this.container.add(this.background);
    
    // Заголовок
    const title = this.scene.add.text(centerX, centerY - this.BOOK_HEIGHT / 2 + 30, '📖 Книга заклинаний', {
      fontSize: '24px',
      fontFamily: 'Georgia',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(title);
    
    // Информация о мане
    const manaText = this.scene.add.text(centerX, centerY - this.BOOK_HEIGHT / 2 + 60, 
      `🔮 Мана: ${this.hero.mana} / ${this.hero.maxMana}`, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#87ceeb'
    }).setOrigin(0.5);
    this.container.add(manaText);
    
    // Создание карточек заклинаний
    this.createSpellCards(centerX, centerY);
    
    // Кнопка закрытия
    const closeBtn = this.scene.add.text(
      centerX + this.BOOK_WIDTH / 2 - 30,
      centerY - this.BOOK_HEIGHT / 2 + 20,
      '✖',
      { fontSize: '24px', color: '#ff6666', backgroundColor: '#333', padding: { x: 8, y: 4 } }
    ).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', () => this.hide());
    closeBtn.on('pointerover', () => closeBtn.setColor('#ff0000'));
    closeBtn.on('pointerout', () => closeBtn.setColor('#ff6666'));
    this.container.add(closeBtn);
    
    // Инструкция
    const hint = this.scene.add.text(centerX, centerY + this.BOOK_HEIGHT / 2 - 25, 
      'Кликните на заклинание, затем на цель. ESC - закрыть.', {
      fontSize: '12px',
      color: '#aaaaaa'
    }).setOrigin(0.5);
    this.container.add(hint);
  }
  
  /**
   * Создать карточки заклинаний (4×2 сетка)
   */
  private createSpellCards(centerX: number, centerY: number): void {
    const spellsWithStatus = AdventureMagicSystem.getSpellsWithStatus(this.hero);
    
    const startX = centerX - (this.COLS * (this.SPELL_CARD_WIDTH + this.PADDING)) / 2 + this.SPELL_CARD_WIDTH / 2 + this.PADDING / 2;
    const startY = centerY - this.BOOK_HEIGHT / 2 + 100;
    
    spellsWithStatus.forEach((spellStatus, index) => {
      const col = index % this.COLS;
      const row = Math.floor(index / this.COLS);
      
      const x = startX + col * (this.SPELL_CARD_WIDTH + this.PADDING);
      const y = startY + row * (this.SPELL_CARD_HEIGHT + this.PADDING);
      
      this.createSpellCard(spellStatus.spell, spellStatus.canCast, spellStatus.manaCost, x, y, spellStatus.reason);
    });
  }
  
  /**
   * Создать одну карточку заклинания
   */
  private createSpellCard(
    spell: AdventureSpell, 
    canCast: boolean, 
    manaCost: number,
    x: number, 
    y: number,
    reason?: string
  ): void {
    const card = this.scene.add.container(x, y);
    
    // Фон карточки
    const bg = this.scene.add.graphics();
    const bgColor = canCast ? 0x3a5f0b : 0x444444;
    const borderColor = canCast ? 0x7cba3c : 0x666666;
    
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(
      -this.SPELL_CARD_WIDTH / 2,
      -this.SPELL_CARD_HEIGHT / 2,
      this.SPELL_CARD_WIDTH,
      this.SPELL_CARD_HEIGHT,
      8
    );
    bg.lineStyle(2, borderColor, 1);
    bg.strokeRoundedRect(
      -this.SPELL_CARD_WIDTH / 2,
      -this.SPELL_CARD_HEIGHT / 2,
      this.SPELL_CARD_WIDTH,
      this.SPELL_CARD_HEIGHT,
      8
    );
    card.add(bg);
    
    // Иконка заклинания
    const icon = this.scene.add.text(0, -25, spell.icon, {
      fontSize: '28px'
    }).setOrigin(0.5);
    if (!canCast) icon.setAlpha(0.4);
    card.add(icon);
    
    // Название
    const nameText = this.scene.add.text(0, 0, spell.name, {
      fontSize: '11px',
      fontFamily: 'Arial',
      color: canCast ? '#ffffff' : '#888888',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: this.SPELL_CARD_WIDTH - 10 }
    }).setOrigin(0.5);
    card.add(nameText);
    
    // Стоимость маны
    const manaColor = canCast && this.hero.mana >= manaCost ? '#87ceeb' : '#ff6666';
    const manaText = this.scene.add.text(0, 30, `🔮 ${manaCost}`, {
      fontSize: '13px',
      color: manaColor
    }).setOrigin(0.5);
    card.add(manaText);
    
    // Интерактивность (только для доступных заклинаний)
    if (canCast && this.hero.mana >= manaCost) {
      card.setSize(this.SPELL_CARD_WIDTH, this.SPELL_CARD_HEIGHT);
      card.setInteractive({ useHandCursor: true });
      
      // Hover эффект
      card.on('pointerover', () => {
        bg.clear();
        bg.fillStyle(0x4a7f1b, 1);
        bg.fillRoundedRect(
          -this.SPELL_CARD_WIDTH / 2,
          -this.SPELL_CARD_HEIGHT / 2,
          this.SPELL_CARD_WIDTH,
          this.SPELL_CARD_HEIGHT,
          8
        );
        bg.lineStyle(3, 0xffd700, 1);
        bg.strokeRoundedRect(
          -this.SPELL_CARD_WIDTH / 2,
          -this.SPELL_CARD_HEIGHT / 2,
          this.SPELL_CARD_WIDTH,
          this.SPELL_CARD_HEIGHT,
          8
        );
        
        // Tooltip с описанием
        this.showTooltip(spell, x, y);
      });
      
      card.on('pointerout', () => {
        bg.clear();
        bg.fillStyle(bgColor, 1);
        bg.fillRoundedRect(
          -this.SPELL_CARD_WIDTH / 2,
          -this.SPELL_CARD_HEIGHT / 2,
          this.SPELL_CARD_WIDTH,
          this.SPELL_CARD_HEIGHT,
          8
        );
        bg.lineStyle(2, borderColor, 1);
        bg.strokeRoundedRect(
          -this.SPELL_CARD_WIDTH / 2,
          -this.SPELL_CARD_HEIGHT / 2,
          this.SPELL_CARD_WIDTH,
          this.SPELL_CARD_HEIGHT,
          8
        );
        this.hideTooltip();
      });
      
      // Клик
      card.on('pointerdown', () => {
        this.hide();
        this.onSelect(spell.id);
      });
    } else {
      // Tooltip для недоступных заклинаний
      card.setSize(this.SPELL_CARD_WIDTH, this.SPELL_CARD_HEIGHT);
      card.setInteractive();
      
      card.on('pointerover', () => {
        this.showTooltip(spell, x, y, reason || 'Недоступно');
      });
      
      card.on('pointerout', () => {
        this.hideTooltip();
      });
    }
    
    this.container.add(card);
    this.spellButtons.set(spell.id, card);
  }
  
  // Tooltip элементы
  private tooltipContainer: Phaser.GameObjects.Container | null = null;
  
  /**
   * Показать tooltip с описанием заклинания
   */
  private showTooltip(spell: AdventureSpell, x: number, y: number, reason?: string): void {
    this.hideTooltip();
    
    this.tooltipContainer = this.scene.add.container(x, y - this.SPELL_CARD_HEIGHT / 2 - 80);
    this.tooltipContainer.setDepth(1001);
    
    // Фон tooltip
    const tooltipBg = this.scene.add.graphics();
    tooltipBg.fillStyle(0x1a1a1a, 0.95);
    tooltipBg.fillRoundedRect(-130, -40, 260, 80, 8);
    tooltipBg.lineStyle(2, 0xffd700, 1);
    tooltipBg.strokeRoundedRect(-130, -40, 260, 80, 8);
    this.tooltipContainer.add(tooltipBg);
    
    // Название + школа (канон HoMM4)
    const schoolEmoji: Record<string, string> = {
      'life': '💛',
      'death': '💀',
      'order': '⚜️',
      'chaos': '🔥',
      'natural': '🌿',
      'tactics': '⚔️'
    };
    const emoji = schoolEmoji[spell.school] || '✨';
    
    const titleText = this.scene.add.text(0, -25, `${spell.icon} ${spell.name} ${emoji}`, {
      fontSize: '14px',
      fontFamily: 'Arial',
      color: '#ffd700',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tooltipContainer.add(titleText);
    
    // Описание
    const descText = this.scene.add.text(0, 0, spell.description, {
      fontSize: '11px',
      color: '#ffffff',
      align: 'center',
      wordWrap: { width: 240 }
    }).setOrigin(0.5);
    this.tooltipContainer.add(descText);
    
    // Причина недоступности (если есть)
    if (reason) {
      const reasonText = this.scene.add.text(0, 25, reason, {
        fontSize: '10px',
        color: '#ff6666'
      }).setOrigin(0.5);
      this.tooltipContainer.add(reasonText);
    }
    
    this.container.add(this.tooltipContainer);
  }
  
  /**
   * Скрыть tooltip
   */
  private hideTooltip(): void {
    if (this.tooltipContainer) {
      this.tooltipContainer.destroy();
      this.tooltipContainer = null;
    }
  }
  
  /**
   * Показать книгу заклинаний
   */
  show(): void {
    if (this.isVisible) return;
    
    // Пересоздать UI с актуальными данными
    this.container.removeAll(true);
    this.spellButtons.clear();
    this.createBookUI();
    
    this.container.setVisible(true);
    this.isVisible = true;
  }
  
  /**
   * Скрыть книгу заклинаний
   */
  hide(): void {
    if (!this.isVisible) return;
    
    this.container.setVisible(false);
    this.isVisible = false;
    this.hideTooltip();
  }
  
  /**
   * Переключить видимость
   */
  toggle(): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show();
    }
  }
  
  /**
   * Проверка: открыта ли книга?
   */
  getIsVisible(): boolean {
    return this.isVisible;
  }
  
  /**
   * Обновить данные героя (после применения заклинания)
   */
  updateHero(hero: Hero): void {
    this.hero = hero;
    if (this.isVisible) {
      this.hide();
      this.show();
    }
  }
  
  /**
   * Уничтожить UI
   */
  destroy(): void {
    this.container.destroy();
  }
}
