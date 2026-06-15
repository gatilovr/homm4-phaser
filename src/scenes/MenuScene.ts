import Phaser from 'phaser';
import { CONFIG } from '../config';
import { SaveLoadUI } from '../ui/SaveLoadUI';
import { SaveSystem } from '../systems/SaveSystem';

export class MenuScene extends Phaser.Scene {
  private titleText!: Phaser.GameObjects.Text;
  private stars: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super({ key: CONFIG.SCENES.MENU });
  }

  create(): void {
    this.createBackground();
    this.createTitle();
    this.createButtons();
    this.createVersionInfo();
    this.animateStars();
  }

  private createBackground(): void {
    const { width, height } = this.scale;
    
    // Градиентный фон
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0a0a0f, 0x0a0a0f, 1);
    bg.fillRect(0, 0, width, height);

    // Звёзды
    for (let i = 0; i < 100; i++) {
      const star = this.add.rectangle(
        Phaser.Math.Between(0, width),
        Phaser.Math.Between(0, height),
        Phaser.Math.Between(1, 3),
        Phaser.Math.Between(1, 3),
        0xffffff,
        Phaser.Math.FloatBetween(0.3, 1)
      );
      this.stars.push(star);
    }
  }

  private createTitle(): void {
    const { width } = this.scale;

    this.titleText = this.add.text(width / 2, 120, '⚔️ HEROES IV ⚔️', {
      fontSize: '64px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, 190, 'Phaser Edition', {
      fontSize: '24px',
      color: '#aaa',
      fontFamily: 'Segoe UI'
    }).setOrigin(0.5);

    // Анимация появления
    this.titleText.setScale(0);
    subtitle.setAlpha(0);

    this.tweens.add({
      targets: this.titleText,
      scale: 1,
      duration: 800,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: subtitle,
      alpha: 1,
      delay: 400,
      duration: 500
    });
  }

  private createButtons(): void {
    const { width, height } = this.scale;
    const buttonY = height / 2 + 50;
    const buttonSpacing = 70;

    const buttons = [
      { text: '🎮 НОВАЯ ИГРА', action: () => this.startNewGame() },
      { text: '💾 ЗАГРУЗИТЬ', action: () => this.loadGame() },
      { text: '⚙️ НАСТРОЙКИ', action: () => this.showSettings() },
      { text: '📖 ОБ ИГРЕ', action: () => this.showAbout() }
    ];

    buttons.forEach((btn, index) => {
      const y = buttonY + index * buttonSpacing;
      this.createButton(width / 2, y, btn.text, btn.action);
    });
  }

  private createButton(x: number, y: number, text: string, onClick: () => void): Phaser.GameObjects.Container {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, 300, 50, 0x2c3e50, 0.9)
      .setStrokeStyle(2, 0xd4af37);

    const label = this.add.text(0, 0, text, {
      fontSize: '22px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI'
    }).setOrigin(0.5);

    container.add([bg, label]);
    container.setSize(300, 50);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
      bg.setFillStyle(0x34495e, 1);
      bg.setStrokeStyle(3, 0xffd700);
      label.setColor('#ffd700');
      this.tweens.add({
        targets: container,
        scale: 1.05,
        duration: 100
      });
    });

    container.on('pointerout', () => {
      bg.setFillStyle(0x2c3e50, 0.9);
      bg.setStrokeStyle(2, 0xd4af37);
      label.setColor('#f0e6d2');
      this.tweens.add({
        targets: container,
        scale: 1,
        duration: 100
      });
    });

    container.on('pointerdown', () => {
      this.tweens.add({
        targets: container,
        scale: 0.95,
        duration: 50,
        yoyo: true,
        onComplete: onClick
      });
    });

    return container;
  }

  private createVersionInfo(): void {
    const { width, height } = this.scale;
    
    this.add.text(width - 20, height - 20, 'v2.3.0 — Save/Load', {
      fontSize: '14px',
      color: '#666',
      fontFamily: 'Segoe UI'
    }).setOrigin(1, 1);

    this.add.text(20, height - 20, 'Phaser 3.80 + TypeScript', {
      fontSize: '14px',
      color: '#666',
      fontFamily: 'Segoe UI'
    }).setOrigin(0, 1);
  }

  private animateStars(): void {
    this.stars.forEach(star => {
      this.tweens.add({
        targets: star,
        alpha: { from: star.alpha, to: 0.2 },
        duration: Phaser.Math.Between(1000, 3000),
        yoyo: true,
        repeat: -1
      });
    });
  }

  private startNewGame(): void {
    console.log('Starting new game...');
    this.scene.start(CONFIG.SCENES.WORLD);
  }

  private loadGame(): void {
    console.log('Load game clicked');
    
    const saveSystem = SaveSystem.getInstance();
    const hasAnySave = saveSystem.hasSave(1) || saveSystem.hasSave(2) || saveSystem.hasSave(3) || saveSystem.hasAutoSave();
    
    if (!hasAnySave) {
      this.showNotification('💭 Нет сохранённых игр');
      return;
    }
    
    const ui = new SaveLoadUI(this, 'load');
    ui.show();
  }

  private showSettings(): void {
    const { width, height } = this.scale;
    
    // Затемнение фона
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();
    
    // Панель настроек
    const panel = this.add.rectangle(width / 2, height / 2, 500, 400, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    
    const title = this.add.text(width / 2, height / 2 - 160, '⚙️ НАСТРОЙКИ', {
      fontSize: '28px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    
    // Скорость игры
    const speedLabel = this.add.text(width / 2 - 180, height / 2 - 100, '🎮 Скорость игры:', {
      fontSize: '16px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI'
    });
    
    const speedOptions = ['Медленная', 'Нормальная', 'Быстрая'];
    const currentSpeed = localStorage.getItem('game_speed') || 'normal';
    
    let speedY = height / 2 - 70;
    for (const speed of speedOptions) {
      const isSelected = speed === currentSpeed || (speed === 'Нормальная' && !localStorage.getItem('game_speed'));
      const btn = this.add.text(width / 2 - 100, speedY, `• ${speed}`, {
        fontSize: '14px',
        color: isSelected ? '#ffd700' : '#aaaaaa',
        fontFamily: 'Segoe UI'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      btn.on('pointerdown', () => {
        localStorage.setItem('game_speed', speed === 'Нормальная' ? 'normal' : speed === 'Быстрая' ? 'fast' : 'slow');
        this.showSettings(); // Обновляем UI
      });
      
      speedY += 25;
    }
    
    // Графика
    const graphicsLabel = this.add.text(width / 2 - 180, height / 2 + 10, '🎨 Графика:', {
      fontSize: '16px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI'
    });
    
    const graphicsOptions = ['Низкая', 'Средняя', 'Высокая'];
    const currentGraphics = localStorage.getItem('graphics_quality') || 'medium';
    
    let graphicsY = height / 2 + 40;
    for (const quality of graphicsOptions) {
      const isSelected = quality === currentGraphics || (quality === 'Средняя' && !localStorage.getItem('graphics_quality'));
      const btn = this.add.text(width / 2 - 100, graphicsY, `• ${quality}`, {
        fontSize: '14px',
        color: isSelected ? '#ffd700' : '#aaaaaa',
        fontFamily: 'Segoe UI'
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      
      btn.on('pointerdown', () => {
        localStorage.setItem('graphics_quality', quality === 'Средняя' ? 'medium' : quality === 'Высокая' ? 'high' : 'low');
        this.showSettings(); // Обновляем UI
      });
      
      graphicsY += 25;
    }
    
    // Звук (заглушка)
    const soundLabel = this.add.text(width / 2 - 180, height / 2 + 100, '🔊 Звук:', {
      fontSize: '16px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI'
    });
    
    const soundBtn = this.add.text(width / 2 - 100, height / 2 + 130, '• ВЫКЛ (скоро)', {
      fontSize: '14px',
      color: '#666666',
      fontFamily: 'Segoe UI'
    }).setOrigin(0.5);
    
    // Кнопка закрытия
    const closeBtn = this.add.text(width / 2 + 200, height / 2 - 160, '✕', {
      fontSize: '24px',
      color: '#ff4444',
      fontFamily: 'Segoe UI'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    
    closeBtn.on('pointerdown', () => {
      overlay.destroy();
      panel.destroy();
      title.destroy();
      speedLabel.destroy();
      graphicsLabel.destroy();
      soundLabel.destroy();
      soundBtn.destroy();
      closeBtn.destroy();
    });
  }

  private showAbout(): void {
    this.showNotification('Heroes of Might and Magic IV\nBrowser Edition\n© 2024');
  }

  private showNotification(text: string): void {
    const { width, height } = this.scale;
    
    const panel = this.add.rectangle(width / 2, height / 2, 400, 150, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);
    
    const msg = this.add.text(width / 2, height / 2 - 20, text, {
      fontSize: '18px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      align: 'center'
    }).setOrigin(0.5);

    const closeBtn = this.add.text(width / 2, height / 2 + 40, '[ OK ]', {
      fontSize: '20px',
      color: '#d4af37',
      fontFamily: 'Segoe UI'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    closeBtn.on('pointerdown', () => {
      panel.destroy();
      msg.destroy();
      closeBtn.destroy();
    });
  }
}
