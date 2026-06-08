/**
 * SaveLoadUI — интерфейс сохранения и загрузки игры
 * 
 * Отображается:
 * - В главном меню (MenuScene) — кнопка "Загрузить"
 * - В игре (WorldScene) — по F5 (сохранить) и F9 (загрузить)
 */

import Phaser from 'phaser';
import { SaveSystem, SaveSlotInfo } from '../systems/SaveSystem';

export class SaveLoadUI {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private saveSystem: SaveSystem;
  private mode: 'save' | 'load';
  private onClose?: () => void;
  private slots: Phaser.GameObjects.Container[] = [];
  private titleText!: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, mode: 'save' | 'load', onClose?: () => void) {
    this.scene = scene;
    this.mode = mode;
    this.onClose = onClose;
    this.saveSystem = SaveSystem.getInstance();
  }

  /**
   * Показать UI сохранения/загрузки
   */
  public show(): void {
    const { width, height } = this.scene.scale;

    // Контейнер
    this.container = this.scene.add.container(0, 0).setDepth(10000);

    // Затемнение фона
    const overlay = this.scene.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setInteractive();
    this.container.add(overlay);

    // Панель
    const panelW = 700;
    const panelH = 520;
    const panelX = width / 2 - panelW / 2;
    const panelY = height / 2 - panelH / 2;

    const panel = this.scene.add.rectangle(
      width / 2,
      height / 2,
      panelW,
      panelH,
      0x1a1a2e,
      0.95
    ).setStrokeStyle(3, 0xd4af37);
    this.container.add(panel);

    // Заголовок
    const title = this.mode === 'save' ? '💾 СОХРАНИТЬ ИГРУ' : '📂 ЗАГРУЗИТЬ ИГРУ';
    this.titleText = this.scene.add.text(
      width / 2,
      panelY + 30,
      title,
      {
        fontSize: '28px',
        color: '#d4af37',
        fontFamily: 'Segoe UI',
        fontStyle: 'bold',
      }
    ).setOrigin(0.5);
    this.container.add(this.titleText);

    // Получить информацию о слотах
    const slotsInfo = this.saveSystem.getAllSlotsInfo();

    // Создать UI для каждого слота
    this.slots = [];
    for (let i = 0; i < 3; i++) {
      const slotUI = this.createSlotUI(
        slotsInfo[i],
        panelX + 30,
        panelY + 90 + i * 120,
        panelW - 60,
        100
      );
      this.container.add(slotUI);
      this.slots.push(slotUI);
    }

    // Автосохранение (если есть)
    if (this.saveSystem.hasAutoSave()) {
      const autoSlotUI = this.createAutoSaveSlotUI(
        panelX + 30,
        panelY + 460,
        panelW - 60,
        40
      );
      this.container.add(autoSlotUI);
    }

    // Кнопка закрытия
    const closeBtn = this.createButton(
      width / 2 + panelW / 2 - 50,
      panelY + 30,
      '✕',
      () => this.hide()
    );
    this.container.add(closeBtn);

    // Горячие клавиши
    this.scene.input.keyboard?.once('keydown-ESC', () => this.hide());
  }

  /**
   * Создать UI одного слота
   */
  private createSlotUI(
    info: SaveSlotInfo,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const slotContainer = this.scene.add.container(x, y);

    // Фон слота
    const bg = this.scene.add.rectangle(0, 0, w, h, 0x16213e, 0.9)
      .setOrigin(0)
      .setStrokeStyle(2, 0x0f3460)
      .setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => {
      bg.setStrokeStyle(3, 0xd4af37);
    });
    bg.on('pointerout', () => {
      bg.setStrokeStyle(2, 0x0f3460);
    });

    // Клик по слоту
    bg.on('pointerdown', () => {
      if (this.mode === 'save') {
        this.saveToSlot(info.slot);
      } else {
        if (info.exists) {
          this.loadFromSlot(info.slot);
        } else {
          this.showMessage('Слот пуст');
        }
      }
    });

    slotContainer.add(bg);

    if (info.exists) {
      // Слот занят
      const slotNum = this.scene.add.text(15, 15, `Слот ${info.slot}`, {
        fontSize: '18px',
        color: '#d4af37',
        fontFamily: 'Segoe UI',
        fontStyle: 'bold',
      });
      slotContainer.add(slotNum);

      // Имя героя
      const heroInfo = info.heroName 
        ? `👑 ${info.heroName} (ур. ${info.heroLevel})` 
        : 'Неизвестный герой';
      const hero = this.scene.add.text(15, 40, heroInfo, {
        fontSize: '16px',
        color: '#e8e8e8',
        fontFamily: 'Segoe UI',
      });
      slotContainer.add(hero);

      // День и дата
      const date = new Date(info.timestamp || 0);
      const dateStr = date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      const dayInfo = this.scene.add.text(15, 65, `📅 Неделя ${info.week}, День ${info.day} | ${dateStr}`, {
        fontSize: '14px',
        color: '#a0a0a0',
        fontFamily: 'Segoe UI',
      });
      slotContainer.add(dayInfo);

      // Кнопка удаления
      const deleteBtn = this.createSmallButton(
        w - 40,
        15,
        '🗑️',
        () => {
          this.confirmDelete(info.slot);
        }
      );
      slotContainer.add(deleteBtn);
    } else {
      // Слот пуст
      const slotNum = this.scene.add.text(15, 15, `Слот ${info.slot}`, {
        fontSize: '18px',
        color: '#555',
        fontFamily: 'Segoe UI',
        fontStyle: 'bold',
      });
      slotContainer.add(slotNum);

      const empty = this.scene.add.text(15, 45, '💭 Пустой слот', {
        fontSize: '16px',
        color: '#777',
        fontFamily: 'Segoe UI',
      });
      slotContainer.add(empty);

      if (this.mode === 'save') {
        const hint = this.scene.add.text(15, 70, '👆 Нажмите чтобы сохранить здесь', {
          fontSize: '14px',
          color: '#4a90e2',
          fontFamily: 'Segoe UI',
        });
        slotContainer.add(hint);
      } else {
        const hint = this.scene.add.text(15, 70, 'Нет сохранения', {
          fontSize: '14px',
          color: '#555',
          fontFamily: 'Segoe UI',
        });
        slotContainer.add(hint);
      }
    }

    return slotContainer;
  }

  /**
   * Создать UI слота автосохранения
   */
  private createAutoSaveSlotUI(
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, w, h, 0x0f3460, 0.9)
      .setOrigin(0)
      .setStrokeStyle(2, 0x4a90e2)
      .setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => bg.setStrokeStyle(3, 0x7ec8e3));
    bg.on('pointerout', () => bg.setStrokeStyle(2, 0x4a90e2));
    
    if (this.mode === 'load') {
      bg.on('pointerdown', () => this.loadAutoSave());
    }

    container.add(bg);

    const label = this.scene.add.text(15, 10, '⚡ Автосохранение', {
      fontSize: '16px',
      color: '#4a90e2',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
    });
    container.add(label);

    const hint = this.scene.add.text(200, 10, 
      this.mode === 'load' ? '(Нажмите чтобы загрузить)' : '(автоматически каждый ход)',
      {
        fontSize: '14px',
        color: '#a0a0a0',
        fontFamily: 'Segoe UI',
      }
    );
    container.add(hint);

    return container;
  }

  /**
   * Сохранить в указанный слот
   */
  private saveToSlot(slot: number): void {
    const worldScene = this.scene.scene.get('WorldScene') as any;
    if (!worldScene) {
      this.showMessage('Игра не запущена');
      return;
    }

    // Собрать данные
    const saveData = this.saveSystem.collectSaveData(worldScene);
    
    // Сохранить
    const success = this.saveSystem.saveGame(slot, saveData);
    
    if (success) {
      this.showMessage('✅ Игра сохранена!');
      setTimeout(() => this.hide(), 800);
    } else {
      this.showMessage('❌ Ошибка сохранения');
    }
  }

  /**
   * Загрузить из указанного слота
   */
  private loadFromSlot(slot: number): void {
    const saveData = this.saveSystem.loadGame(slot);
    
    if (!saveData) {
      this.showMessage('❌ Не удалось загрузить');
      return;
    }

    // Перезапустить WorldScene с флагом загрузки
    this.scene.scene.start('WorldScene', { 
      loadSave: true, 
      saveData: saveData,
      seed: saveData.seed 
    });
  }

  /**
   * Загрузить автосохранение
   */
  private loadAutoSave(): void {
    const saveData = this.saveSystem.loadAutoSave();
    
    if (!saveData) {
      this.showMessage('❌ Автосохранение не найдено');
      return;
    }

    this.scene.scene.start('WorldScene', { 
      loadSave: true, 
      saveData: saveData,
      seed: saveData.seed 
    });
  }

  /**
   * Подтвердить удаление сохранения
   */
  private confirmDelete(slot: number): void {
    if (confirm(`Удалить сохранение из слота ${slot}?`)) {
      this.saveSystem.deleteSave(slot);
      this.showMessage('🗑️ Слот очищен');
      setTimeout(() => {
        this.hide();
        this.show(); // обновить UI
      }, 600);
    }
  }

  /**
   * Создать кнопку
   */
  private createButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, 40, 40, 0x2d2d44)
      .setStrokeStyle(1, 0xd4af37)
      .setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => bg.setFillStyle(0x4a4a6a));
    bg.on('pointerout', () => bg.setFillStyle(0x2d2d44));
    bg.on('pointerdown', onClick);

    const label = this.scene.add.text(0, 0, text, {
      fontSize: '20px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
    }).setOrigin(0.5);

    container.add(bg);
    container.add(label);

    return container;
  }

  /**
   * Создать маленькую кнопку
   */
  private createSmallButton(
    x: number,
    y: number,
    text: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const container = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, 30, 30, 0x8b0000, 0.8)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });

    bg.on('pointerover', () => bg.setFillStyle(0xb22222));
    bg.on('pointerout', () => bg.setFillStyle(0x8b0000, 0.8));
    bg.on('pointerdown', onClick);

    const label = this.scene.add.text(15, 15, text, {
      fontSize: '16px',
    }).setOrigin(0.5);

    container.add(bg);
    container.add(label);

    return container;
  }

  /**
   * Показать всплывающее сообщение
   */
  private showMessage(msg: string): void {
    const { width, height } = this.scene.scale;
    
    const toast = this.scene.add.text(width / 2, height - 80, msg, {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Segoe UI',
      backgroundColor: '#000000cc',
      padding: { x: 20, y: 10 },
    }).setOrigin(0.5).setDepth(10001);

    this.container.add(toast);

    this.scene.tweens.add({
      targets: toast,
      alpha: 0,
      y: height - 120,
      duration: 1500,
      delay: 800,
      onComplete: () => toast.destroy(),
    });
  }

  /**
   * Скрыть UI
   */
  public hide(): void {
    this.container?.destroy();
    this.onClose?.();
  }
}
