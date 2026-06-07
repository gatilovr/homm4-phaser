import Phaser from 'phaser';
import { BattleUnit } from '../types';
import { getCreatureType, isRanged, isFlying, isCavalry } from './CreatureTypes';

/**
 * Визуальная очередь ходов — показывает порядок хода юнитов.
 * Как в оригинальном HoMM4: иконки юнитов слева/справа от поля боя.
 */
export class BattleQueue {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private items: Phaser.GameObjects.Container[] = [];
  private isLeftSide: boolean = true;

  constructor(scene: Phaser.Scene, leftSide: boolean = true) {
    this.scene = scene;
    this.isLeftSide = leftSide;
    this.container = scene.add.container(0, 0).setDepth(35);
  }

  /**
   * Обновить очередь с новым списком юнитов
   */
  update(units: BattleUnit[], currentUnitId: string): void {
    // Очистка старых элементов
    this.items.forEach(item => item.destroy());
    this.items = [];

    // Фильтруем живых юнитов и сортируем по скорости
    const alive = units
      .filter(u => u.count > 0)
      .sort((a, b) => {
        // Текущий юнит всегда первый
        if (a.id === currentUnitId) return -1;
        if (b.id === currentUnitId) return 1;
        
        // Дальше по hasActed
        if (a.hasActed !== b.hasActed) return a.hasActed ? 1 : -1;
        
        return 0;
      });

    // Показываем максимум 8 юнитов в очереди
    const maxShow = 8;
    const toShow = alive.slice(0, maxShow);

    const startX = this.isLeftSide ? 20 : this.scene.scale.width - 60;
    const startY = 120;
    const itemHeight = 50;

    toShow.forEach((unit, i) => {
      const item = this.createQueueItem(unit, startX, startY + i * itemHeight, unit.id === currentUnitId);
      this.container.add(item);
      this.items.push(item);
    });

    // Заголовок очереди
    const title = this.scene.add.text(
      startX + 20,
      startY - 25,
      '🎯 Очередь',
      {
        fontSize: '12px',
        color: '#d4af37',
        fontFamily: 'Segoe UI',
        fontStyle: 'bold'
      }
    ).setDepth(35);
    this.container.add(title);
    this.items.push(this.scene.add.container(0, 0).add(title) as any);
  }

  private createQueueItem(
    unit: BattleUnit, 
    x: number, 
    y: number, 
    isCurrent: boolean
  ): Phaser.GameObjects.Container {
    const item = this.scene.add.container(x, y).setDepth(35);

    // Фон
    const bgColor = isCurrent ? 0x3d5a80 : 0x1a1a2e;
    const borderColor = isCurrent ? 0xffd700 : 0x444444;
    const bg = this.scene.add.rectangle(20, 20, 40, 40, bgColor, 0.9)
      .setStrokeStyle(isCurrent ? 2 : 1, borderColor);
    item.add(bg);

    // Иконка типа юнита
    const type = getCreatureType(unit.creatureId);
    let icon = '⚔️';
    if (unit.isHero) icon = '👑';
    else if (type.type === 'ranged') icon = '🏹';
    else if (type.type === 'flying') icon = '🦅';
    else if (type.type === 'cavalry') icon = '🐎';
    else if (type.type === 'caster') icon = '🧙';
    else if (unit.isWall) icon = '🧱';
    else if (unit.isTower) icon = '🗼';

    const iconText = this.scene.add.text(20, 14, icon, {
      fontSize: '16px'
    }).setOrigin(0.5);
    item.add(iconText);

    // Количество
    if (!unit.isWall && !unit.isTower) {
      const countText = this.scene.add.text(20, 32, `${unit.count}`, {
        fontSize: '10px',
        color: '#ffffff',
        fontFamily: 'Segoe UI',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);
      item.add(countText);
    }

    // Индикатор стороны
    const sideColor = unit.side === 'attacker' ? '#3498db' : '#e74c3c';
    const sideIndicator = this.scene.add.rectangle(45, 20, 4, 30, 
      Phaser.Display.Color.HexStringToColor(sideColor).color, 1);
    item.add(sideIndicator);

    // Затемнение если уже ходил
    if (unit.hasActed && !isCurrent) {
      const overlay = this.scene.add.rectangle(20, 20, 40, 40, 0x000000, 0.5);
      item.add(overlay);
    }

    // Пульсация для текущего
    if (isCurrent) {
      this.scene.tweens.add({
        targets: bg,
        alpha: 0.7,
        duration: 800,
        yoyo: true,
        repeat: -1
      });
    }

    return item;
  }

  /**
   * Скрыть очередь
   */
  hide(): void {
    this.container.setVisible(false);
  }

  /**
   * Показать очередь
   */
  show(): void {
    this.container.setVisible(true);
  }

  /**
   * Уничтожить очередь
   */
  destroy(): void {
    this.container.destroy();
  }
}
