import Phaser from 'phaser';
import { CONFIG } from '../config';

export class UIScene extends Phaser.Scene {
  private worldScene: any;
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private needsUpdate: boolean = true;
  private lastUpdateTime: number = 0;
  private readonly UPDATE_INTERVAL = 500; // Обновлять раз в 500мс
  
  private minimapX: number = 0;
  private minimapY: number = 0;
  private minimapSize: number = 180;

  constructor() {
    super({ key: CONFIG.SCENES.UI });
  }

  init(data: { worldScene: any }): void {
    this.worldScene = data.worldScene;
    this.needsUpdate = true;
    this.lastUpdateTime = 0;
  }

  create(): void {
    console.log('[UIScene] Creating...');
    
    try {
      this.createMinimap();
      this.createControls();
      this.createEndTurnButton();
      console.log('[UIScene] Created successfully');
    } catch (error) {
      console.error('[UIScene] Error:', error);
    }
    
    // Первоначальная отрисовка
    this.time.delayedCall(100, () => {
      this.updateMinimap();
    });
  }

  update(time: number): void {
    // Обновляем мини-карту только если нужно и прошло достаточно времени
    if (this.needsUpdate && (time - this.lastUpdateTime > this.UPDATE_INTERVAL)) {
      this.updateMinimap();
      this.needsUpdate = false;
      this.lastUpdateTime = time;
    }
  }

  private createMinimap(): void {
    const { width } = this.scale;
    this.minimapSize = 180;
    this.minimapX = width - this.minimapSize - 20;
    this.minimapY = 80;

    // Фон мини-карты
    this.add.rectangle(
      this.minimapX + this.minimapSize / 2, 
      this.minimapY + this.minimapSize / 2, 
      this.minimapSize, 
      this.minimapSize, 
      0x1a1a2e, 
      0.95
    ).setStrokeStyle(2, 0xd4af37);

    // Заголовок
    this.add.text(this.minimapX + this.minimapSize / 2, this.minimapY - 15, '🗺️ Карта', {
      fontSize: '14px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Graphics для отрисовки мини-карты
    this.minimapGraphics = this.add.graphics();
    
    // Кликабельная область
    const hitArea = this.add.rectangle(
      this.minimapX + this.minimapSize / 2, 
      this.minimapY + this.minimapSize / 2, 
      this.minimapSize, 
      this.minimapSize, 
      0xffffff, 
      0
    ).setInteractive({ useHandCursor: true });

    hitArea.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const localX = pointer.x - this.minimapX;
      const localY = pointer.y - this.minimapY;
      
      const mapX = Math.floor((localX / this.minimapSize) * CONFIG.MAP_WIDTH);
      const mapY = Math.floor((localY / this.minimapSize) * CONFIG.MAP_HEIGHT);
      
      if (this.worldScene && this.worldScene.camera) {
        this.worldScene.camera.pan(
          mapX * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
          mapY * CONFIG.TILE_SIZE + CONFIG.TILE_SIZE / 2,
          500,
          'Sine.easeInOut'
        );
      }
    });
  }

  private updateMinimap(): void {
    if (!this.minimapGraphics || !this.worldScene) return;

    const scale = this.minimapSize / Math.max(CONFIG.MAP_WIDTH, CONFIG.MAP_HEIGHT);
    const map = this.worldScene.map;
    if (!map) return;

    this.minimapGraphics.clear();

    const colors: Record<string, number> = {
      grass: 0x4a7c2e,
      sand: 0xc2b280,
      water: 0x2e5a7c,
      rock: 0x6b6b6b,
      snow: 0xe8e8e8,
      swamp: 0x3d5a3d,
      lava: 0xc0392b,
      forest: 0x2d5016
    };

    const objColors: Record<string, number> = {
      town: 0xffd700,
      enemy_town: 0xff0000,
      hero: 0x4169e1,
      mine: 0xff8c00,
      artifact: 0xff1493,
      creature: 0xff4500,
      resource: 0xffff00,
      portal: 0x9b59b6
    };

    // Размер пикселя для мини-карты
    const pixelSize = Math.max(2, Math.ceil(scale));

    // Отрисовка тайлов
    for (let ty = 0; ty < CONFIG.MAP_HEIGHT; ty += 2) { // Пропускаем каждую вторую строку для скорости
      for (let tx = 0; tx < CONFIG.MAP_WIDTH; tx += 2) { // Пропускаем каждую вторую колонку
        const tile = map[ty]?.[tx];
        if (!tile) continue;

        const px = this.minimapX + tx * scale;
        const py = this.minimapY + ty * scale;

        if (tile.revealed) {
          this.minimapGraphics.fillStyle(colors[tile.type] || 0x4a7c2e, 1);
          this.minimapGraphics.fillRect(px, py, pixelSize * 2, pixelSize * 2);

          // Объекты (рисуем крупнее)
          if (tile.object) {
            this.minimapGraphics.fillStyle(objColors[tile.object.type] || 0xffffff, 1);
            this.minimapGraphics.fillCircle(px + pixelSize, py + pixelSize, pixelSize + 1);
          }
        } else {
          this.minimapGraphics.fillStyle(0x111111, 0.9);
          this.minimapGraphics.fillRect(px, py, pixelSize * 2, pixelSize * 2);
        }
      }
    }

    // Позиция героя (яркая точка)
    if (this.worldScene.getHeroPosition) {
      const heroPos = this.worldScene.getHeroPosition();
      if (heroPos) {
        const hx = this.minimapX + heroPos.x * scale;
        const hy = this.minimapY + heroPos.y * scale;
        
        // Белая рамка вокруг героя
        this.minimapGraphics.lineStyle(2, 0x2ecc71, 1);
        this.minimapGraphics.strokeRect(hx - 4, hy - 4, 8, 8);
        
        // Точка героя
        this.minimapGraphics.fillStyle(0x2ecc71, 1);
        this.minimapGraphics.fillCircle(hx, hy, 3);
      }
    }
  }

  private createControls(): void {
    const { width, height } = this.scale;
    
    const panelX = width - 200;
    const panelY = height - 160;

    this.add.rectangle(panelX + 90, panelY + 55, 180, 130, 0x1a1a2e, 0.95)
      .setStrokeStyle(2, 0xd4af37);

    this.add.text(panelX + 90, panelY - 10, '⌨️ Управление', {
      fontSize: '13px',
      color: '#d4af37',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    const controls = [
      '🖱️ Клик - движение',
      '🖱️ ПКМ - инфо о тайле',
      '🔍 Колесо - зум',
      '⏎ Enter - конец хода',
      'ℹ️ H - инфо героя',
      '⎋ Esc - главное меню'
    ];

    this.add.text(panelX + 10, panelY + 15, controls.join('\n'), {
      fontSize: '11px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      lineSpacing: 4
    });
  }

  private createEndTurnButton(): void {
    const { width, height } = this.scale;
    const btnX = width - 110;
    const btnY = height - 220;

    const btn = this.add.rectangle(btnX, btnY, 160, 44, 0x8b4513, 0.95)
      .setStrokeStyle(2, 0xd4af37)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(btnX, btnY, '⏭️ КОНЕЦ ХОДА', {
      fontSize: '14px',
      color: '#f0e6d2',
      fontFamily: 'Segoe UI',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setFillStyle(0xa0522d, 1);
      btnText.setColor('#ffd700');
    });

    btn.on('pointerout', () => {
      btn.setFillStyle(0x8b4513, 0.95);
      btnText.setColor('#f0e6d2');
    });

    btn.on('pointerdown', () => {
      if (this.worldScene && typeof this.worldScene.endTurn === 'function') {
        this.worldScene.endTurn();
        this.needsUpdate = true;
      }
    });
  }

  // Публичный метод для принудительного обновления
  public forceUpdate(): void {
    this.needsUpdate = true;
  }
}
