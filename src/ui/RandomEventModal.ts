// ============================================================================
// RandomEventModal — Модальное окно случайного события (канон HoMM4)
// ============================================================================

import Phaser from 'phaser';
import { RandomEvent } from '../systems/RandomEventsSystem';

export class RandomEventModal {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private onClose: () => void;

  constructor(scene: Phaser.Scene, event: RandomEvent, onClose: () => void) {
    this.scene = scene;
    this.onClose = onClose;
    this.container = scene.add.container(0, 0);
    this.container.setDepth(10000);

    this.createModal(event);
  }

  private createModal(event: RandomEvent): void {
    const width = 500;
    const height = 350;
    const x = (this.scene.scale.width - width) / 2;
    const y = (this.scene.scale.height - height) / 2;

    // Затемнение фона
    const overlay = this.scene.add.rectangle(
      0, 0,
      this.scene.scale.width,
      this.scene.scale.height,
      0x000000, 0.7
    );
    overlay.setInteractive();
    this.container.add(overlay);

    // Рамка окна
    const border = this.scene.add.rectangle(x, y, width, height, 0x000000, 1);
    border.setStrokeStyle(4, event.color);
    border.setOrigin(0, 0);
    this.container.add(border);

    // Фон окна (градиент)
    const bg = this.scene.add.rectangle(x + 2, y + 2, width - 4, height - 4, 0x1a1a2e, 1);
    bg.setOrigin(0, 0);
    this.container.add(bg);

    // Заголовок с иконкой
    const titleBg = this.scene.add.rectangle(x, y, width, 60, event.color, 0.3);
    titleBg.setOrigin(0, 0);
    this.container.add(titleBg);

    const icon = this.scene.add.text(x + 20, y + 10, event.icon, {
      fontSize: '40px',
    });
    this.container.add(icon);

    const title = this.scene.add.text(x + 80, y + 15, event.name, {
      fontSize: '28px',
      color: event.positive ? '#4CAF50' : '#F44336',
      fontStyle: 'bold',
    });
    this.container.add(title);

    // Разделитель
    const divider = this.scene.add.rectangle(x + 20, y + 70, width - 40, 2, event.color, 0.5);
    divider.setOrigin(0, 0);
    this.container.add(divider);

    // Описание события
    const description = this.scene.add.text(x + 30, y + 90, event.description, {
      fontSize: '18px',
      color: '#FFFFFF',
      wordWrap: { width: width - 60 },
      lineSpacing: 8,
    });
    this.container.add(description);

    // Длительность (если есть)
    if (event.duration > 0) {
      const durationText = this.scene.add.text(x + 30, y + 200, `⏱️ Длительность: ${event.duration} дней`, {
        fontSize: '16px',
        color: '#FFD700',
      });
      this.container.add(durationText);
    }

    // Кнопка "Принять"
    const buttonWidth = 200;
    const buttonHeight = 50;
    const buttonX = x + (width - buttonWidth) / 2;
    const buttonY = y + height - 80;

    const button = this.scene.add.rectangle(buttonX, buttonY, buttonWidth, buttonHeight, event.color, 0.8);
    button.setOrigin(0, 0);
    button.setInteractive({ useHandCursor: true });
    this.container.add(button);

    const buttonText = this.scene.add.text(buttonX + buttonWidth / 2, buttonY + buttonHeight / 2, '✓ Принять', {
      fontSize: '20px',
      color: '#FFFFFF',
      fontStyle: 'bold',
    });
    buttonText.setOrigin(0.5, 0.5);
    this.container.add(buttonText);

    // Hover эффект
    button.on('pointerover', () => {
      button.setFillStyle(event.color, 1);
    });

    button.on('pointerout', () => {
      button.setFillStyle(event.color, 0.8);
    });

    // Клик по кнопке
    button.on('pointerdown', () => {
      this.close();
    });

    // Анимация появления
    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 300,
      ease: 'Power2',
    });
  }

  private close(): void {
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.container.destroy();
        this.onClose();
      },
    });
  }
}
