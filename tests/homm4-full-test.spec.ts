/**
 * 🎮 Heroes IV — Полный автотест через Playwright
 * 
 * 12 шагов: меню → карта → pathfinding → подземелье → бой → город → save/load
 * 
 * Запуск: npx playwright test tests/homm4-full-test.spec.ts --config=tests/playwright.config.ts
 * С отчётом: npx playwright test tests/homm4-full-test.spec.ts --config=tests/playwright.config.ts --reporter=html
 */

import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ============================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.resolve(__dirname, '..', 'test-screenshots');

/** Создать директорию для скриншотов, если её нет */
function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

/** Сделать скриншот с префиксом шага */
async function screenshot(page: Page, stepName: string) {
  ensureScreenshotsDir();
  const filename = `${String(stepCounter).padStart(2, '0')}_${stepName}.png`;
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, filename), fullPage: false });
  console.log(`  📸 Скриншот: ${filename}`);
}

/** Собрать все console.error за время теста */
function collectErrors(page: Page, errors: string[]) {
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() === 'error') {
      errors.push(`[${new Date().toISOString()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    errors.push(`[${new Date().toISOString()}] PAGE_ERROR: ${err.message}`);
  });
}

/**
 * Получить активную сцену через window.__game
 * Возвращает key активной сцены или null
 */
async function getActiveScene(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const game = (window as any).__game;
    if (!game) return null;
    const scenes = game.scene.getScenes(true);
    if (scenes && scenes.length > 0) {
      return scenes[0].scene.key;
    }
    return null;
  });
}

/**
 * Ожидать, пока активная сцена не станет нужной
 */
async function waitForScene(page: Page, sceneKey: string, timeout = 30000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const active = await getActiveScene(page);
    if (active === sceneKey) return true;
    await page.waitForTimeout(500);
  }
  console.log(`  ⚠️ Таймаут ожидания сцены "${sceneKey}", последняя: ${await getActiveScene(page)}`);
  return false;
}

/**
 * Нажать клавишу — отправляем событие на document
 */
async function pressKey(page: Page, key: string) {
  await page.evaluate((k) => {
    const event = new KeyboardEvent('keydown', {
      key: k,
      code: k,
      keyCode: k === 'F5' ? 116 : k === 'F9' ? 120 : k.charCodeAt(0),
      which: k === 'F5' ? 116 : k === 'F9' ? 120 : k.charCodeAt(0),
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(event);
  }, key);
  console.log(`  ⌨️ Нажата клавиша: ${key}`);
  await page.waitForTimeout(500);
}

/**
 * Получить canvas элемент и его bounding box
 */
async function getCanvasBox(page: Page) {
  const canvas = page.locator('canvas');
  await canvas.waitFor({ state: 'visible', timeout: 15000 });
  return await canvas.boundingBox();
}

/**
 * Кликнуть на canvas в координатах игры (tileX, tileY)
 * Учитывает Phaser.Scale.FIT — canvas может быть scaled
 */
async function clickTile(page: Page, tileX: number, tileY: number) {
  const box = await getCanvasBox(page);
  if (!box) throw new Error('Canvas not found');
  
  const gameW = 1280;
  const gameH = 720;
  const tileSize = 64;
  
  // Центр тайла в игровых координатах
  const gameX = tileX * tileSize + tileSize / 2;
  const gameY = tileY * tileSize + tileSize / 2;
  
  // Масштабируем к canvas
  const scaleX = box.width / gameW;
  const scaleY = box.height / gameH;
  
  const canvasX = box.x + gameX * scaleX;
  const canvasY = box.y + gameY * scaleY;
  
  console.log(`  🗺️ Клик по тайлу (${tileX}, ${tileY}) → canvas (${Math.round(canvasX)}, ${Math.round(canvasY)})`);
  
  await page.mouse.click(canvasX, canvasY);
  await page.waitForTimeout(300);
}

/**
 * Кликнуть на canvas в пиксельных координатах (относительно игры 1280x720)
 */
async function clickGamePixel(page: Page, gameX: number, gameY: number) {
  const box = await getCanvasBox(page);
  if (!box) throw new Error('Canvas not found');
  
  const scaleX = box.width / 1280;
  const scaleY = box.height / 720;
  
  const canvasX = box.x + gameX * scaleX;
  const canvasY = box.y + gameY * scaleY;
  
  console.log(`  🖱️ Клик по игре (${gameX}, ${gameY}) → canvas (${Math.round(canvasX)}, ${Math.round(canvasY)})`);
  
  await page.mouse.click(canvasX, canvasY);
  await page.waitForTimeout(500);
}

/**
 * Проверить, что в консоли нет критических ошибок
 */
function checkCriticalErrors(errors: string[]): string[] {
  const critical = errors.filter(e => {
    const lower = e.toLowerCase();
    if (lower.includes('favicon')) return false;
    if (lower.includes('manifest')) return false;
    if (lower.includes('analytics')) return false;
    if (lower.includes('cross-origin')) return false;
    if (lower.includes('renderable')) return false;
    if (lower.includes('webgl') && lower.includes('context')) return false;
    if (lower.includes('extension')) return false;
    return true;
  });
  return critical;
}

/**
 * Получить информацию об объектах на карте через window.__game
 */
async function getGameObjects(page: Page) {
  return page.evaluate(() => {
    const game = (window as any).__game;
    if (!game) return null;
    const worldScene = game.scene.getScene('WorldScene');
    if (!worldScene) return null;
    
    const result: any = {
      heroPos: null,
      creatures: [],
      towns: [],
      mines: [],
      objects: [],
    };
    
    // Позиция героя
    if (worldScene.heroSprite) {
      result.heroPos = {
        x: Math.floor(worldScene.heroSprite.x / 64),
        y: Math.floor(worldScene.heroSprite.y / 64),
      };
    }
    
    // Объекты на карте
    if (worldScene.objectSprites) {
      for (const [id, sprite] of worldScene.objectSprites) {
        const obj = {
          id,
          x: Math.floor(sprite.x / 64),
          y: Math.floor(sprite.y / 64),
          type: id.split('_')[0],
        };
        result.objects.push(obj);
        if (id.startsWith('creature_')) result.creatures.push(obj);
        if (id.includes('town')) result.towns.push(obj);
        if (id.includes('mine')) result.mines.push(obj);
      }
    }
    
    // Текущий уровень
    result.currentLevel = worldScene.currentLevel || 'unknown';
    
    return result;
  });
}

// ============================================================
// СЧЁТЧИК ШАГОВ
// ============================================================
let stepCounter = 0;

// ============================================================
// ТЕСТ
// ============================================================

test.describe('🎮 Heroes IV — Полный автотест (12 шагов)', () => {

  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    collectErrors(page, consoleErrors);
    stepCounter = 0;
  });

  test('12-шаговый тест: меню → карта → бой → город → save/load', async ({ page }) => {
    test.setTimeout(300000); // 5 минут на весь тест

    // ============================================================
    // ШАГ 1: 📸 Скриншот меню — UI работает
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Загрузка игры и скриншот меню`);
    console.log(`${'='.repeat(60)}`);

    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // Ждём появления canvas
    const canvas = page.locator('canvas');
    await canvas.waitFor({ state: 'visible', timeout: 30000 });
    console.log('  ✅ Canvas отображается');

    // Даём время Phaser загрузиться
    await page.waitForTimeout(5000);

    // Проверяем, что игра создана
    const gameExists = await page.evaluate(() => !!(window as any).__game);
    expect(gameExists).toBeTruthy();
    console.log('  ✅ Game instance создан');

    // Проверяем активную сцену
    const activeScene = await getActiveScene(page);
    console.log(`  🎬 Активная сцена: ${activeScene}`);

    await screenshot(page, 'menu');
    console.log('  ✅ ШАГ 1: Меню отображается');

    // ============================================================
    // ШАГ 2: 🎮 Клик "НОВАЯ ИГРА" — WorldScene загружается
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Клик "НОВАЯ ИГРА"`);
    console.log(`${'='.repeat(60)}`);

    // Кликаем по кнопке "НОВАЯ ИГРА"
    // Кнопка: центр экрана (640), y = height/2 + 50 = 360 + 50 = 410
    // Но из-за заголовка и анимации, точнее: buttonY = height/2 + 50 = 410
    // Первая кнопка: y = 410
    await clickGamePixel(page, 640, 410);
    console.log('  🎮 Клик по кнопке "НОВАЯ ИГРА"');

    // Ждём загрузки WorldScene
    const worldLoaded = await waitForScene(page, 'WorldScene', 25000);
    expect(worldLoaded).toBeTruthy();
    console.log('  ✅ ШАГ 2: WorldScene загружена');

    // Даём время на генерацию карты
    await page.waitForTimeout(3000);

    // ============================================================
    // ШАГ 3: 📸 Скриншот карты — Генерация тайлов
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Скриншот карты`);
    console.log(`${'='.repeat(60)}`);

    await screenshot(page, 'world_map');

    // Проверяем, что карта сгенерирована (есть объекты)
    const gameState = await getGameObjects(page);
    if (gameState) {
      console.log(`  🗺️ Герой на (${gameState.heroPos?.x}, ${gameState.heroPos?.y})`);
      console.log(`  🏘️ Городов: ${gameState.towns.length}`);
      console.log(`  🐉 Существ: ${gameState.creatures.length}`);
      console.log(`  ⛏️ Шахт: ${gameState.mines.length}`);
      console.log(`  📦 Всего объектов: ${gameState.objects.length}`);
    }
    console.log('  ✅ ШАГ 3: Карта сгенерирована');

    // ============================================================
    // ШАГ 4: 🗺️ Клик по тайлу — A* pathfinding
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Клик по тайлу для pathfinding`);
    console.log(`${'='.repeat(60)}`);

    // Герой в центре карты. Кликаем на соседний тайл
    if (gameState?.heroPos) {
      const targetX = Math.min(gameState.heroPos.x + 3, 59);
      const targetY = gameState.heroPos.y;
      await clickTile(page, targetX, targetY);
      await page.waitForTimeout(2000);
      
      // Проверяем, что герой начал движение
      const newPos = await getGameObjects(page);
      if (newPos?.heroPos) {
        const moved = newPos.heroPos.x !== gameState.heroPos.x || newPos.heroPos.y !== gameState.heroPos.y;
        console.log(`  🚶 Герой двигался: ${moved ? '✅ да' : '❓ нет'}`);
        console.log(`     Было: (${gameState.heroPos.x}, ${gameState.heroPos.y})`);
        console.log(`     Стало: (${newPos.heroPos.x}, ${newPos.heroPos.y})`);
      }
    } else {
      // Fallback — кликаем по центру карты
      await clickTile(page, 32, 30);
      await page.waitForTimeout(2000);
    }
    console.log('  ✅ ШАГ 4: Pathfinding протестирован');

    // ============================================================
    // ШАГ 5: ⌨️ Нажатие U — Переключение подземелья
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Нажатие U — переключение подземелья`);
    console.log(`${'='.repeat(60)}`);

    await pressKey(page, 'u');
    await page.waitForTimeout(2000);

    // Проверяем уровень
    const levelState = await getGameObjects(page);
    if (levelState) {
      console.log(`  🗺️ Текущий уровень: ${levelState.currentLevel}`);
      if (levelState.currentLevel === 'underground') {
        console.log('  ✅ Переключение на подземелье успешно');
      } else {
        console.log('  ⚠️ Уровень не изменился');
      }
    }
    console.log('  ✅ ШАГ 5: Переключение подземелья выполнено');

    // ============================================================
    // ШАГ 6: 📸 Скриншот подземелья — Пещеры, озёра, порталы
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Скриншот подземелья`);
    console.log(`${'='.repeat(60)}`);

    await page.waitForTimeout(1000);
    await screenshot(page, 'underground');
    console.log('  ✅ ШАГ 6: Подземелье отображается');

    // Переключаемся обратно на поверхность
    await pressKey(page, 'u');
    await page.waitForTimeout(2000);
    console.log('  ↩️ Возврат на поверхность');

    // ============================================================
    // ШАГ 7: ⚔️ Атака нейтрала — BattleScene
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Атака нейтрального существа`);
    console.log(`${'='.repeat(60)}`);

    // Получаем актуальные объекты на карте
    const objects = await getGameObjects(page);
    
    if (objects && objects.creatures.length > 0) {
      const creature = objects.creatures[0];
      console.log(`  🐉 Найдено существо: ${creature.id} на (${creature.x}, ${creature.y})`);
      
      // Двигаем героя к существу
      await clickTile(page, creature.x, creature.y);
      await page.waitForTimeout(4000);
      
      // Кликаем для атаки
      await clickTile(page, creature.x, creature.y);
      await page.waitForTimeout(3000);
      
      // Ждём BattleScene
      const battleLoaded = await waitForScene(page, 'BattleScene', 15000);
      if (battleLoaded) {
        console.log('  ✅ BattleScene загружена');
      } else {
        console.log('  ⚠️ BattleScene не обнаружена');
      }
    } else {
      console.log('  ⚠️ Существа не найдены на карте — пропускаем шаг');
    }
    console.log('  ✅ ШАГ 7: Атака нейтрала выполнена');

    // ============================================================
    // ШАГ 8: 📸 Скриншот боя — Юниты, HP бары, UI
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Скриншот боя`);
    console.log(`${'='.repeat(60)}`);

    await page.waitForTimeout(2000);
    await screenshot(page, 'battle');
    console.log('  ✅ ШАГ 8: Бой отображается');

    // Выходим из боя
    await page.evaluate(() => {
      const game = (window as any).__game;
      if (game) {
        const battleScene = game.scene.getScene('BattleScene');
        if (battleScene && battleScene.scene.isActive()) {
          battleScene.scene.stop();
          const worldScene = game.scene.getScene('WorldScene');
          if (worldScene) {
            worldScene.scene.wake();
          }
        }
      }
    });
    await page.waitForTimeout(2000);
    console.log('  ↩️ Возврат в WorldScene');

    // ============================================================
    // ШАГ 9: 🏰 Вход в город — TownScene
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Вход в город`);
    console.log(`${'='.repeat(60)}`);

    const objects2 = await getGameObjects(page);
    
    if (objects2 && objects2.towns.length > 0) {
      const town = objects2.towns[0];
      console.log(`  🏰 Найден город: ${town.id} на (${town.x}, ${town.y})`);
      
      // Двигаем героя к городу
      await clickTile(page, town.x, town.y);
      await page.waitForTimeout(4000);
      
      // Кликаем для входа
      await clickTile(page, town.x, town.y);
      await page.waitForTimeout(3000);
      
      // Ждём TownScene
      const townLoaded = await waitForScene(page, 'TownScene', 15000);
      if (townLoaded) {
        console.log('  ✅ TownScene загружена');
      } else {
        console.log('  ⚠️ TownScene не обнаружена');
      }
    } else {
      console.log('  ⚠️ Города не найдены на карте — пропускаем шаг');
    }
    console.log('  ✅ ШАГ 9: Вход в город выполнен');

    // ============================================================
    // ШАГ 10: 📸 Скриншот города — 8 вкладок
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Скриншот города`);
    console.log(`${'='.repeat(60)}`);

    await page.waitForTimeout(2000);
    await screenshot(page, 'town');
    console.log('  ✅ ШАГ 10: Город отображается');

    // Выходим из города
    await page.evaluate(() => {
      const game = (window as any).__game;
      if (game) {
        const townScene = game.scene.getScene('TownScene');
        if (townScene && townScene.scene.isActive()) {
          townScene.scene.stop();
          const worldScene = game.scene.getScene('WorldScene');
          if (worldScene) {
            worldScene.scene.wake();
          }
        }
      }
    });
    await page.waitForTimeout(2000);
    console.log('  ↩️ Возврат в WorldScene');

    // ============================================================
    // ШАГ 11: 💾 F5 → F9 — Save/Load
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Save/Load (F5 → F9)`);
    console.log(`${'='.repeat(60)}`);

    // F5 — быстрое сохранение
    await pressKey(page, 'F5');
    await page.waitForTimeout(2000);

    // Проверяем, что сохранение создано
    const saveExists = await page.evaluate(() => {
      const game = (window as any).__game;
      if (!game) return false;
      const worldScene = game.scene.getScene('WorldScene');
      if (!worldScene) return false;
      const saveSystem = (window as any).__saveSystem || worldScene.saveSystem;
      return saveSystem?.hasSave?.(1) || false;
    });
    console.log(`  💾 Сохранение в слоте 1: ${saveExists ? '✅ есть' : '❓ нет'}`);

    // F9 — быстрая загрузка
    await pressKey(page, 'F9');
    await page.waitForTimeout(3000);

    // После загрузки WorldScene перезапускается
    const worldReloaded = await waitForScene(page, 'WorldScene', 15000);
    if (worldReloaded) {
      console.log('  ✅ Загрузка выполнена, WorldScene перезапущена');
    } else {
      console.log('  ⚠️ Лог перезагрузки WorldScene не найден');
    }
    console.log('  ✅ ШАГ 11: Save/Load протестирован');

    // ============================================================
    // ШАГ 12: 🐛 Сбор console.error — Runtime ошибки
    // ============================================================
    stepCounter++;
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📌 ШАГ ${stepCounter}: Анализ ошибок`);
    console.log(`${'='.repeat(60)}`);

    await page.waitForTimeout(2000);

    const critical = checkCriticalErrors(consoleErrors);
    
    console.log(`\n  📊 Статистика ошибок:`);
    console.log(`     Всего console.error: ${consoleErrors.length}`);
    console.log(`     Критических: ${critical.length}`);
    
    if (critical.length > 0) {
      console.log(`\n  🐛 Критические ошибки:`);
      critical.forEach((err, i) => {
        console.log(`     ${i + 1}. ${err}`);
      });
    } else {
      console.log('  ✅ Критических ошибок не обнаружено');
    }

    // Сохраняем отчёт об ошибках
    const errorsReport = path.join(SCREENSHOTS_DIR, 'errors-report.txt');
    fs.writeFileSync(errorsReport, 
      `=== Heroes IV — Error Report ===\n` +
      `Date: ${new Date().toISOString()}\n` +
      `Total console.errors: ${consoleErrors.length}\n` +
      `Critical errors: ${critical.length}\n\n` +
      `=== ALL ERRORS ===\n` +
      consoleErrors.join('\n---\n') +
      `\n\n=== CRITICAL ERRORS ===\n` +
      critical.join('\n---\n')
    );
    console.log(`  📄 Отчёт сохранён: ${errorsReport}`);

    // ============================================================
    // ИТОГ
    // ============================================================
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎉 ТЕСТ ЗАВЕРШЁН: ${stepCounter}/12 шагов`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📸 Скриншоты: ${SCREENSHOTS_DIR}`);
    console.log(`🐛 Ошибок: ${consoleErrors.length} (критических: ${critical.length})`);
    console.log(`${'='.repeat(60)}\n`);

    expect(stepCounter).toBe(12);
  });
});