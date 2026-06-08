import Phaser from 'phaser';
import { SkillData } from '../systems/SkillSystem';
import { SkillCategory } from '../types';

/**
 * SkillChoiceUI — модальное окно выбора навыка при повышении уровня.
 * 
 * Показывает 2 карточки навыков с:
 * - Иконкой и названием
 * - Текущим и новым уровнем
 * - Описанием эффекта
 * - Цветом по категории
 */
export class SkillChoiceUI {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private callback: (skillId: string) => void;
  private destroyed: boolean = false;

  private static CATEGORY_COLORS: Record<SkillCategory, { bg: number; border: number; text: string }> = {
    combat:     { bg: 0x8b0000, border: 0xff4444, text: '#ff6666' },
    magic:      { bg: 0x000080, border: 0x4488ff, text: '#66aaff' },
    adventure:  { bg: 0x006400, border: 0x44aa44, text: '#66cc66' },
    economy:    { bg: 0x8b6508, border: 0xffaa00, text: '#ffcc44' },
    exploration:{ bg: 0x2f4f4f, border: 0x669966, text: '#88cc88' }
  };

  constructor(scene: Phaser.Scene, callback: (skillId: string) => void) {
    this.scene = scene;
    this.callback = callback;
  }

  /**
   * Показать модальное окно с двумя навыками на выбор
   */
  public show(
    skill1: SkillData, 
    skill2: SkillData, 
    currentLevel1: number, 
    currentLevel2: number
  ): void {
    if (this.destroyed) return;

    const { width, height } = this.scene.scale;
    const categoryNames: Record<SkillCategory, string> = {
      combat: 'Боевой', magic: 'Магический', adventure: 'Приключенческий', economy: 'Экономический', exploration: 'Исследование'
    };

    this.container = this.scene.add.container(0, 0).setDepth(2000).setScrollFactor(0);

    // Затемнение фона
    const overlay = this.scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75)
      .setInteractive();
    this.container.add(overlay);

    // Заголовок
    const titleBg = this.scene.add.rectangle(width / 2, height / 2 - 180, 400, 50, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xffd700);
    const titleText = this.scene.add.text(width / 2, height / 2 - 180, '🎉 ПОВЫШЕНИЕ УРОВНЯ!', {
      fontSize: '22px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3
    }).setOrigin(0.5);
    this.container.add([titleBg, titleText]);

    // Подзаголовок
    const subtitleText = this.scene.add.text(width / 2, height / 2 - 130, 'Выберите навык:', {
      fontSize: '16px', color: '#f0e6d2', fontFamily: 'Segoe UI'
    }).setOrigin(0.5);
    this.container.add(subtitleText);

    // === КАРТОЧКА 1 ===
    this.createSkillCard(skill1, currentLevel1, width / 2 - 160, height / 2 + 20, categoryNames);
    
    // === КАРТОЧКА 2 ===
    this.createSkillCard(skill2, currentLevel2, width / 2 + 160, height / 2 + 20, categoryNames);

    // Кнопка отмены
    const cancelBtn = this.scene.add.rectangle(width / 2, height / 2 + 200, 200, 40, 0x8b4513, 0.9)
      .setStrokeStyle(2, 0xd4af37)
      .setInteractive({ useHandCursor: true });
    const cancelText = this.scene.add.text(width / 2, height / 2 + 200, '❌ Отмена', {
      fontSize: '14px', color: '#f0e6d2', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);
    
    cancelBtn.on('pointerover', () => cancelBtn.setFillStyle(0xa0522d));
    cancelBtn.on('pointerout', () => cancelBtn.setFillStyle(0x8b4513));
    cancelBtn.on('pointerdown', () => this.destroy());
    
    this.container.add([cancelBtn, cancelText]);

    // Анимация появления
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });
  }

  /**
   * Создать карточку навыка
   */
  private createSkillCard(
    skill: SkillData, 
    currentLevel: number, 
    x: number, 
    y: number,
    categoryNames: Record<SkillCategory, string>
  ): void {
    const colors = SkillChoiceUI.CATEGORY_COLORS[skill.category];
    const nextLevel = currentLevel + 1;
    const isNew = currentLevel === 0;
    const nextEffect = skill.effects[nextLevel - 1] || skill.effects[skill.effects.length - 1];

    // Фон карточки
    const card = this.scene.add.rectangle(x, y, 280, 260, colors.bg, 0.95)
      .setStrokeStyle(3, colors.border)
      .setInteractive({ useHandCursor: true });

    // Hover эффект
    card.on('pointerover', () => {
      card.setFillStyle(colors.border, 0.3);
      card.setStrokeStyle(4, 0xffd700);
    });
    card.on('pointerout', () => {
      card.setFillStyle(colors.bg, 0.95);
      card.setStrokeStyle(3, colors.border);
    });
    card.on('pointerdown', () => {
      if (!this.destroyed) {
        this.callback(skill.id);
        this.destroy();
      }
    });

    // Иконка навыка
    const iconText = this.scene.add.text(x, y - 80, skill.icon, {
      fontSize: '48px'
    }).setOrigin(0.5);

    // Название
    const nameText = this.scene.add.text(x, y - 30, skill.name, {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Segoe UI', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 2
    }).setOrigin(0.5);

    // Категория
    const categoryText = this.scene.add.text(x, y - 5, categoryNames[skill.category], {
      fontSize: '12px', color: colors.text, fontFamily: 'Segoe UI'
    }).setOrigin(0.5);

    // Уровень
    const levelStr = isNew 
      ? `Уровень 0 → 1`
      : `Уровень ${currentLevel} → ${nextLevel}`;
    const levelText = this.scene.add.text(x, y + 20, levelStr, {
      fontSize: '14px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);

    // Прогресс звёзд
    const stars = '⭐'.repeat(Math.min(nextLevel, skill.maxLevel)) + '☆'.repeat(Math.max(0, skill.maxLevel - nextLevel));
    const starsText = this.scene.add.text(x, y + 42, stars, {
      fontSize: '14px'
    }).setOrigin(0.5);

    // Эффект (что меняется)
    const effectDesc = nextEffect.description;
    const effectText = this.scene.add.text(x, y + 70, effectDesc, {
      fontSize: '13px', color: '#ffffff', fontFamily: 'Segoe UI',
      align: 'center', wordWrap: { width: 250 }
    }).setOrigin(0.5);

    // Описание навыка
    const descText = this.scene.add.text(x, y + 105, skill.description, {
      fontSize: '11px', color: '#aaaaaa', fontFamily: 'Segoe UI',
      align: 'center', wordWrap: { width: 240 }
    }).setOrigin(0.5);

    // Кнопка "Выбрать"
    const selectBtn = this.scene.add.rectangle(x, y + 140, 180, 35, colors.bg, 1)
      .setStrokeStyle(2, 0xffd700)
      .setInteractive({ useHandCursor: true });
    const selectText = this.scene.add.text(x, y + 140, isNew ? '✨ Изучить' : '⬆️ Улучшить', {
      fontSize: '14px', color: '#ffd700', fontFamily: 'Segoe UI', fontStyle: 'bold'
    }).setOrigin(0.5);

    selectBtn.on('pointerover', () => selectBtn.setFillStyle(colors.border, 0.5));
    selectBtn.on('pointerout', () => selectBtn.setFillStyle(colors.bg, 1));
    selectBtn.on('pointerdown', () => {
      if (!this.destroyed) {
        this.callback(skill.id);
        this.destroy();
      }
    });

    this.container.add([card, iconText, nameText, categoryText, levelText, starsText, effectText, descText, selectBtn, selectText]);
  }

  /**
   * Уничтожить UI
   */
  public destroy(): void {
    this.destroyed = true;
    if (this.container) {
      this.scene.tweens.add({
        targets: this.container,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.container.destroy();
        }
      });
    }
  }
}
