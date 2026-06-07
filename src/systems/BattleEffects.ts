import Phaser from 'phaser';
import { BattleUnit } from '../types';
import { GameRandom } from '../utils/Random';

/**
 * Визуальные эффекты в бою.
 * Анимации ударов, всплывающий урон, частицы, эффекты смерти.
 */
export class BattleEffects {
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * Всплывающий текст урона
   */
  showDamageNumber(x: number, y: number, damage: number, isCrit: boolean = false): void {
    const color = isCrit ? '#ff0000' : '#ffff00';
    const fontSize = isCrit ? '28px' : '22px';
    const prefix = isCrit ? '💥' : '';

    const text = this.scene.add.text(x, y, `${prefix}${damage}`, {
      fontSize,
      color,
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  /**
   * Всплывающий текст лечения
   */
  showHealNumber(x: number, y: number, heal: number): void {
    const text = this.scene.add.text(x, y, `+${heal}`, {
      fontSize: '22px',
      color: '#2ecc71',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(50);

    this.scene.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => text.destroy()
    });
  }

  /**
   * Анимация удара (shake + flash)
   */
  playAttackAnimation(attackerSprite: Phaser.GameObjects.Sprite, defenderSprite: Phaser.GameObjects.Sprite): Promise<void> {
    return new Promise(resolve => {
      const originalX = attackerSprite.x;
      const originalY = attackerSprite.y;
      const targetX = defenderSprite.x;
      const targetY = defenderSprite.y;

      const midX = originalX + (targetX - originalX) * 0.6;
      const midY = originalY + (targetY - originalY) * 0.6;

      this.scene.tweens.add({
        targets: attackerSprite,
        x: midX,
        y: midY,
        duration: 200,
        ease: 'Quad.easeOut',
        yoyo: true,
        hold: 50,
        onComplete: () => {
          // Эффект удара по защитнику
          this.scene.tweens.add({
            targets: defenderSprite,
            tint: 0xff0000,
            duration: 80,
            yoyo: true,
            repeat: 2
          });

          // Shake защитника
          this.scene.tweens.add({
            targets: defenderSprite,
            x: defenderSprite.x + 5,
            duration: 50,
            yoyo: true,
            repeat: 3,
            onComplete: () => resolve()
          });
        }
      });
    });
  }

  /**
   * Летящий снаряд для стрелков
   */
  playRangedAttack(
    attackerSprite: Phaser.GameObjects.Sprite,
    defenderSprite: Phaser.GameObjects.Sprite,
    projectileColor: number = 0xffff00
  ): Promise<void> {
    return new Promise(resolve => {
      const projectile = this.scene.add.circle(
        attackerSprite.x + 20,
        attackerSprite.y + 20,
        5,
        projectileColor
      ).setDepth(40);

      this.scene.tweens.add({
        targets: projectile,
        x: defenderSprite.x + 20,
        y: defenderSprite.y + 20,
        duration: 400,
        ease: 'Linear',
        onComplete: () => {
          projectile.destroy();

          // Эффект попадания
          this.scene.tweens.add({
            targets: defenderSprite,
            tint: 0xff0000,
            duration: 80,
            yoyo: true,
            repeat: 2
          });

          resolve();
        }
      });
    });
  }

  /**
   * Анимация смерти юнита
   */
  playDeathAnimation(sprite: Phaser.GameObjects.Sprite): Promise<void> {
    return new Promise(resolve => {
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        angle: 90,
        tint: 0x800000,
        duration: 600,
        ease: 'Quad.easeIn',
        onComplete: () => {
          sprite.destroy();
          resolve();
        }
      });
    });
  }

  /**
   * Баннер морали (большой текст по центру)
   */
  showMoraleBanner(isPositive: boolean): Promise<void> {
    return new Promise(resolve => {
      const { width, height } = this.scene.scale;

      const text = isPositive ? '🔥 ВЫСОКАЯ МОРАЛЬ!' : '😨 НИЗКАЯ МОРАЛЬ!';
      const color = isPositive ? '#ffd700' : '#8b0000';
      const bg = this.scene.add.rectangle(width / 2, height / 2, 500, 100, 0x000000, 0.8)
        .setDepth(100).setStrokeStyle(3, 0xd4af37);

      const banner = this.scene.add.text(width / 2, height / 2, text, {
        fontSize: '36px',
        color,
        fontFamily: 'Segoe UI',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(101).setScale(0);

      this.scene.tweens.add({
        targets: banner,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.scene.time.delayedCall(800, () => {
            this.scene.tweens.add({
              targets: [banner, bg],
              alpha: 0,
              scale: 1.5,
              duration: 400,
              onComplete: () => {
                banner.destroy();
                bg.destroy();
                resolve();
              }
            });
          });
        }
      });
    });
  }

  /**
   * Баннер удачи
   */
  showLuckBanner(isPositive: boolean): Promise<void> {
    return new Promise(resolve => {
      const { width, height } = this.scene.scale;

      const text = isPositive ? '🍀 УДАЧА! Критический удар!' : '😓 НЕУДАЧА!';
      const color = isPositive ? '#2ecc71' : '#e74c3c';

      const bg = this.scene.add.rectangle(width / 2, height / 2 - 50, 500, 80, 0x000000, 0.8)
        .setDepth(100).setStrokeStyle(3, 0xd4af37);

      const banner = this.scene.add.text(width / 2, height / 2 - 50, text, {
        fontSize: '32px',
        color,
        fontFamily: 'Segoe UI',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(101).setScale(0);

      this.scene.tweens.add({
        targets: banner,
        scale: 1,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.scene.time.delayedCall(600, () => {
            this.scene.tweens.add({
              targets: [banner, bg],
              alpha: 0,
              duration: 300,
              onComplete: () => {
                banner.destroy();
                bg.destroy();
                resolve();
              }
            });
          });
        }
      });
    });
  }

  /**
   * Эффект молнии
   */
  playLightningEffect(fromX: number, fromY: number, toX: number, toY: number): void {
    const graphics = this.scene.add.graphics().setDepth(45);
    graphics.lineStyle(3, 0xffff00, 1);
    graphics.beginPath();
    graphics.moveTo(fromX, fromY);

    // Зигзагообразная линия
    const segments = 8;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const x = fromX + (toX - fromX) * t + GameRandom.randomInt(-20, 20);
      const y = fromY + (toY - fromY) * t + GameRandom.randomInt(-20, 20);
      graphics.lineTo(x, y);
    }
    graphics.strokePath();

    this.scene.tweens.add({
      targets: graphics,
      alpha: 0,
      duration: 400,
      onComplete: () => graphics.destroy()
    });
  }

  /**
   * Эффект огненного шара
   */
  playFireballEffect(x: number, y: number): void {
    const circle = this.scene.add.circle(x, y, 10, 0xff4500).setDepth(45);

    this.scene.tweens.add({
      targets: circle,
      radius: 60,
      scale: 6,
      alpha: 0,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => circle.destroy()
    });
  }

  /**
   * Эффект защиты (щит вокруг юнита)
   */
  playShieldEffect(sprite: Phaser.GameObjects.Sprite): void {
    const shield = this.scene.add.circle(
      sprite.x + 20,
      sprite.y + 20,
      25,
      0x00bfff,
      0.3
    ).setStrokeStyle(2, 0x00bfff).setDepth(9);

    this.scene.tweens.add({
      targets: shield,
      alpha: 0,
      scale: 1.5,
      duration: 800,
      onComplete: () => shield.destroy()
    });
  }

  /**
   * Эффект телепортации
   */
  playTeleportEffect(sprite: Phaser.GameObjects.Sprite, newX: number, newY: number): Promise<void> {
    return new Promise(resolve => {
      // Исчезновение в старой позиции
      this.scene.tweens.add({
        targets: sprite,
        alpha: 0,
        scale: 0,
        duration: 300,
        onComplete: () => {
          sprite.setPosition(newX, newY);
          sprite.setScale(1);

          // Появление в новой позиции
          this.scene.tweens.add({
            targets: sprite,
            alpha: 1,
            duration: 300,
            onComplete: () => resolve()
          });
        }
      });
    });
  }
}
