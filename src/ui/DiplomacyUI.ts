/**
 * DiplomacyUI — интерфейс дипломатии (канон HoMM4)
 *
 * Позволяет игроку:
 * - Смотреть статус отношений со всеми ИИ
 * - Предлагать перемирие/союз
 * - Обмениваться ресурсами
 * - Отправлять ультиматумы
 * - Разрывать договоры
 */

import Phaser from 'phaser';
import { DiplomacySystem, DiplomaticRelation } from '../systems/DiplomacySystem';
import { Resources } from '../types';

export class DiplomacyUI {
  private scene: Phaser.Scene;
  private diplomacySystem: DiplomacySystem;
  private resources: Resources;
  private container?: Phaser.GameObjects.Container;
  private onCloseCallback?: () => void;

  constructor(
    scene: Phaser.Scene,
    diplomacySystem: DiplomacySystem,
    resources: Resources
  ) {
    this.scene = scene;
    this.diplomacySystem = diplomacySystem;
    this.resources = resources;
  }

  /**
   * Показать окно дипломатии
   */
  show(onClose?: () => void): void {
    this.onCloseCallback = onClose;
    this.container = this.scene.add.container(0, 0).setDepth(1000);

    // Затемнение фона
    const bg = this.scene.add.rectangle(640, 360, 1280, 720, 0x000000, 0.6)
      .setInteractive();
    this.container.add(bg);

    // Основная панель
    const panel = this.scene.add.rectangle(640, 360, 700, 550, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0x4a9eff);
    this.container.add(panel);

    // Заголовок
    const title = this.scene.add.text(640, 110, '🤝 ДИПЛОМАТИЯ', {
      fontSize: '28px',
      fontFamily: 'Arial',
      color: '#4a9eff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.container.add(title);

    // Список ИИ-противников
    const relations = this.diplomacySystem.getAllRelations();
    let y = 160;

    for (const relation of relations) {
      this.createRelationPanel(relation, 390, y);
      y += 100;
    }

    // Кнопка закрытия
    const closeBtn = this.scene.add.text(1040, 110, '✕', {
      fontSize: '24px',
      fontFamily: 'Arial',
      color: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    closeBtn.on('pointerdown', () => this.hide());
    this.container.add(closeBtn);

    // Кнопка ESC
    this.scene.input.keyboard?.once('keydown-ESC', () => this.hide());
  }

  /**
   * Создать панель для одного ИИ-противника
   */
  private createRelationPanel(relation: DiplomaticRelation, x: number, y: number): void {
    // Фон панели
    const statusColors: Record<string, number> = {
      war: 0x441111,
      truce: 0x444411,
      alliance: 0x114411
    };
    const statusLabels: Record<string, string> = {
      war: '⚔️ Война',
      truce: '🤝 Перемирие',
      alliance: '💚 Союз'
    };

    const panelBg = this.scene.add.rectangle(x, y, 500, 80, statusColors[relation.status] || 0x333333, 0.8)
      .setStrokeStyle(1, 0x666666);
    this.container!.add(panelBg);

    // Имя ИИ
    const nameText = this.scene.add.text(x - 230, y - 25, relation.aiName, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
      fontStyle: 'bold'
    });
    this.container!.add(nameText);

    // Статус
    const statusText = this.scene.add.text(x - 230, y + 5, statusLabels[relation.status], {
      fontSize: '13px',
      fontFamily: 'Arial',
      color: '#aaaaaa'
    });
    this.container!.add(statusText);

    // Репутация
    const repColor = relation.reputation >= 0 ? '#44ff44' : '#ff4444';
    const repText = this.scene.add.text(x + 100, y - 25, `Реп: ${relation.reputation}`, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: repColor
    });
    this.container!.add(repText);

    // Кнопки действий
    if (relation.status === 'war') {
      this.createActionButton(x + 200, y - 10, '🤝 Перемирие', 0x4a9eff, () => {
        const result = this.diplomacySystem.proposeTruce(relation.aiId, this.resources.gold);
        this.showNotification(result.message);
        this.refresh();
      });

      if (relation.turnsRemaining > 0) {
        const timerText = this.scene.add.text(x + 100, y + 5, `${relation.turnsRemaining} ход.`, {
          fontSize: '11px', fontFamily: 'Arial', color: '#ffaa00'
        });
        this.container!.add(timerText);
      }
    } else if (relation.status === 'truce') {
      this.createActionButton(x + 180, y - 15, '💚 Союз', 0x44aa44, () => {
        const result = this.diplomacySystem.proposeAlliance(relation.aiId, this.resources.gold);
        this.showNotification(result.message);
        this.refresh();
      });
      this.createActionButton(x + 180, y + 10, '⚔️ Разорвать', 0xaa4444, () => {
        const msg = this.diplomacySystem.breakTreaty(relation.aiId);
        this.showNotification(msg);
        this.refresh();
      });
    } else if (relation.status === 'alliance') {
      this.createActionButton(x + 180, y - 15, '💱 Торговля', 0xaaaa44, () => {
        this.showNotification('Торговля: обмен 2:1 (союз 1.5:1)');
      });
      this.createActionButton(x + 180, y + 10, '⚔️ Разорвать', 0xaa4444, () => {
        const msg = this.diplomacySystem.breakTreaty(relation.aiId);
        this.showNotification(msg);
        this.refresh();
      });
    }
  }

  /**
   * Создать кнопку действия
   */
  private createActionButton(x: number, y: number, text: string, color: number, onClick: () => void): void {
    const btn = this.scene.add.text(x, y, text, {
      fontSize: '12px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: `#${color.toString(16).padStart(6, '0')}`,
      padding: { x: 8, y: 4 }
    }).setOrigin(0, 0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover', () => btn.setStyle({ backgroundColor: '#666666' }));
    btn.on('pointerout', () => btn.setStyle({ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }));
    btn.on('pointerdown', onClick);

    this.container!.add(btn);
  }

  /**
   * Показать уведомление
   */
  private showNotification(message: string): void {
    const notification = this.scene.add.text(640, 650, message, {
      fontSize: '16px',
      fontFamily: 'Arial',
      color: '#ffffff',
      backgroundColor: '#333333',
      padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setDepth(1001);

    this.scene.time.delayedCall(2000, () => notification.destroy());
  }

  /**
   * Обновить UI
   */
  private refresh(): void {
    this.hide();
    this.show(this.onCloseCallback);
  }

  /**
   * Скрыть окно
   */
  hide(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined;
    }
    this.onCloseCallback?.();
  }
}
