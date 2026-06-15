/**
 * DiplomacySystem — система дипломатии с ИИ-противниками (канон HoMM4)
 *
 * В каноне HoMM IV:
 * - Отношения: война (по умолчанию), перемирие, союз
 * - Возможность предложить перемирие/союз
 * - Обмен ресурсами через дипломатию
 * - Ультиматумы (отдать ресурсы или война)
 * - Репутация влияет на отношение ИИ
 */

import { Resources, Hero } from '../types';

// ============================================================================
// ТИПЫ
// ============================================================================

/** Дипломатический статус */
export type DiplomaticStatus = 'war' | 'truce' | 'alliance';

/** Отношения между игроком и ИИ */
export interface DiplomaticRelation {
  /** ID ИИ-противника */
  aiId: string;
  /** Имя ИИ-противника */
  aiName: string;
  /** Текущий статус */
  status: DiplomaticStatus;
  /** Репутация (-100 до +100) */
  reputation: number;
  /** Осталось ходов до окончания перемирия (0 = бессрочно) */
  turnsRemaining: number;
  /** Последнее действие */
  lastAction: string;
  /** История отношений */
  history: DiplomacyEvent[];
}

/** Событие дипломатии */
export interface DiplomacyEvent {
  day: number;
  event: string;
  details: string;
}

/** Результат предложения перемирия */
export interface TruceResult {
  success: boolean;
  message: string;
  /** Шанс принятия (0-1) */
  acceptanceChance: number;
  /** ИИ принял */
  accepted: boolean;
}

/** Результат обмена ресурсами */
export interface TradeResult {
  success: boolean;
  message: string;
}

// ============================================================================
// КОНСТАНТЫ
// ============================================================================

/** Стоимость предложения перемирия (репутация) */
const TRUCE_REPUTATION_COST = 20;

/** Стоимость предложения союза (репутация) */
const ALLIANCE_REPUTATION_COST = 40;

/** Максимальный шанс принятия перемирия */
const MAX_ACCEPTANCE_CHANCE = 0.8;

/** Штраф к репутации за атаку во время перемирия */
const TREACHERY_PENALTY = -50;

// ============================================================================
// ОСНОВНОЙ КЛАСС
// ============================================================================

export class DiplomacySystem {
  /** Отношения с ИИ */
  private relations: Map<string, DiplomaticRelation> = new Map();
  /** Текущий день игры (для истории) */
  private currentDay: number = 0;

  constructor() {}

  // ==========================================================================
  // ИНИЦИАЛИЗАЦИЯ
  // ==========================================================================

  /**
   * Инициализировать отношения с ИИ-противником
   */
  initRelation(aiId: string, aiName: string): void {
    if (!this.relations.has(aiId)) {
      this.relations.set(aiId, {
        aiId,
        aiName,
        status: 'war',
        reputation: 0,
        turnsRemaining: 0,
        lastAction: 'Война',
        history: [{ day: 0, event: 'war', details: 'Начальное состояние' }]
      });
    }
  }

  // ==========================================================================
  // ПОЛУЧЕНИЕ ИНФОРМАЦИИ
  // ==========================================================================

  /**
   * Получить отношения с ИИ
   */
  getRelation(aiId: string): DiplomaticRelation | undefined {
    return this.relations.get(aiId);
  }

  /**
   * Получить все отношения
   */
  getAllRelations(): DiplomaticRelation[] {
    return Array.from(this.relations.values());
  }

  /**
   * Проверить, можно ли атаковать ИИ
   */
  canAttack(aiId: string): boolean {
    const relation = this.relations.get(aiId);
    return !relation || relation.status === 'war';
  }

  /**
   * Проверить, можно ли торговать с ИИ
   */
  canTrade(aiId: string): boolean {
    const relation = this.relations.get(aiId);
    return relation?.status === 'truce' || relation?.status === 'alliance';
  }

  // ==========================================================================
  // ПЕРЕМИРИЕ
  // ==========================================================================

  /**
   * Предложить перемирие ИИ
   */
  proposeTruce(aiId: string, playerGold: number, aiPower: number = 0, playerPower: number = 0): TruceResult {
    const relation = this.relations.get(aiId);
    if (!relation) {
      return { success: false, message: 'ИИ не найден', acceptanceChance: 0, accepted: false };
    }

    if (relation.status === 'truce') {
      return { success: false, message: 'Перемирие уже заключено', acceptanceChance: 0, accepted: false };
    }

    if (relation.status === 'alliance') {
      return { success: false, message: 'Уже союзники', acceptanceChance: 0, accepted: false };
    }

    // Рассчитываем шанс принятия
    let chance = 0.3; // Базовый шанс

    // Бонус от репутации
    chance += relation.reputation / 200;

    // Бонус от золота (взятка)
    if (playerGold >= 5000) chance += 0.15;
    if (playerGold >= 10000) chance += 0.15;

    // Штраф если ИИ сильнее игрока
    if (playerPower > 0 && aiPower > playerPower * 1.2) {
      chance -= 0.15;
    } else if (playerPower > 0 && aiPower > playerPower) {
      chance -= 0.05;
    }

    chance = Math.max(0.05, Math.min(MAX_ACCEPTANCE_CHANCE, chance));

    // ИИ решает
    const accepted = Math.random() < chance;

    if (accepted) {
      relation.status = 'truce';
      relation.turnsRemaining = 7; // На неделю
      relation.reputation += 10;
      relation.lastAction = 'Перемирие заключено';
      relation.history.push({
        day: this.currentDay,
        event: 'truce',
        details: `Перемирие заключено (шанс: ${Math.round(chance * 100)}%)`
      });
    } else {
      relation.reputation -= 5;
      relation.lastAction = 'Перемирие отклонено';
      relation.history.push({
        day: this.currentDay,
        event: 'truce_rejected',
        details: `ИИ отклонил предложение (шанс: ${Math.round(chance * 100)}%)`
      });
    }

    return {
      success: true,
      message: accepted
        ? `🤝 ${relation.aiName} согласился на перемирие!`
        : `❌ ${relation.aiName} отклонил предложение.`,
      acceptanceChance: chance,
      accepted
    };
  }

  // ==========================================================================
  // СОЮЗ
  // ==========================================================================

  /**
   * Предложить союз ИИ
   */
  proposeAlliance(aiId: string, playerGold: number): TruceResult {
    const relation = this.relations.get(aiId);
    if (!relation) {
      return { success: false, message: 'ИИ не найден', acceptanceChance: 0, accepted: false };
    }

    if (relation.status === 'alliance') {
      return { success: false, message: 'Уже союзники', acceptanceChance: 0, accepted: false };
    }

    // Нужно сначала иметь перемирие
    if (relation.status !== 'truce') {
      return { success: false, message: 'Сначала заключите перемирие', acceptanceChance: 0, accepted: false };
    }

    // Рассчитываем шанс принятия (ниже чем для перемирия)
    let chance = 0.15;

    // Бонус от репутации
    chance += relation.reputation / 300;

    // Взятка
    if (playerGold >= 10000) chance += 0.15;
    if (playerGold >= 20000) chance += 0.2;

    chance = Math.max(0.05, Math.min(0.6, chance));

    const accepted = Math.random() < chance;

    if (accepted) {
      relation.status = 'alliance';
      relation.turnsRemaining = 0; // Бессрочно
      relation.reputation += 20;
      relation.lastAction = 'Союз заключён';
      relation.history.push({
        day: this.currentDay,
        event: 'alliance',
        details: `Союз заключён (шанс: ${Math.round(chance * 100)}%)`
      });
    } else {
      relation.reputation -= 10;
      relation.lastAction = 'Союз отклонён';
      relation.history.push({
        day: this.currentDay,
        event: 'alliance_rejected',
        details: `ИИ отклонил союз (шанс: ${Math.round(chance * 100)}%)`
      });
    }

    return {
      success: true,
      message: accepted
        ? `🤝 ${relation.aiName} стал вашим союзником!`
        : `❌ ${relation.aiName} отклонил предложение союза.`,
      acceptanceChance: chance,
      accepted
    };
  }

  // ==========================================================================
  // РАЗРЫВ
  // ==========================================================================

  /**
   * Разорвать перемирие/союз
   */
  breakTreaty(aiId: string): string {
    const relation = this.relations.get(aiId);
    if (!relation) return 'ИИ не найден';

    const oldStatus = relation.status;
    relation.status = 'war';
    relation.turnsRemaining = 0;
    relation.reputation += TREACHERY_PENALTY;
    relation.lastAction = 'Договор разорван';
    relation.history.push({
      day: this.currentDay,
      event: 'treachery',
      details: `Разорван ${oldStatus === 'alliance' ? 'союз' : 'перемирие'}`
    });

    return `⚔️ Вы разорвали ${oldStatus === 'alliance' ? 'союз' : 'перемирие'} с ${relation.aiName}!`;
  }

  // ==========================================================================
  // ОБЪЯВЛЕНИЕ ВОЙНЫ
  // ==========================================================================

  /**
   * Объявить войну
   */
  declareWar(aiId: string): string {
    const relation = this.relations.get(aiId);
    if (!relation) return 'ИИ не найден';

    if (relation.status === 'war') return 'Уже в состоянии войны';

    const wasAlliance = relation.status === 'alliance';
    relation.status = 'war';
    relation.turnsRemaining = 0;
    relation.reputation += TREACHERY_PENALTY;
    relation.lastAction = 'Война объявлена';
    relation.history.push({
      day: this.currentDay,
      event: 'war_declared',
      details: `Объявлена война (был ${wasAlliance ? 'союзник' : 'перемирие'})`
    });

    return `⚔️ Война объявлена ${relation.aiName}!${wasAlliance ? ' (ПРЕДАТЕЛЬСТВО!)' : ''}`;
  }

  // ==========================================================================
  // ОБМЕН РЕСУРСАМИ
  // ==========================================================================

  /**
   * Обменять ресурсы с ИИ
   */
  tradeResources(
    aiId: string,
    give: Partial<Resources>,
    receive: Partial<Resources>,
    playerResources: Resources
  ): TradeResult {
    const relation = this.relations.get(aiId);
    if (!relation) {
      return { success: false, message: 'ИИ не найден' };
    }

    if (!this.canTrade(aiId)) {
      return { success: false, message: 'Нужно перемирие или союз для торговли' };
    }

    // Проверяем ресурсы игрока
    if ((give.gold || 0) > playerResources.gold) {
      return { success: false, message: 'Недостаточно золота' };
    }
    if ((give.wood || 0) > playerResources.wood) {
      return { success: false, message: 'Недостаточно дерева' };
    }
    if ((give.ore || 0) > playerResources.ore) {
      return { success: false, message: 'Недостаточно руды' };
    }
    if ((give.crystal || 0) > playerResources.crystal) {
      return { success: false, message: 'Недостаточно кристаллов' };
    }
    if ((give.gems || 0) > playerResources.gems) {
      return { success: false, message: 'Недостаточно самоцветов' };
    }
    if ((give.sulfur || 0) > playerResources.sulfur) {
      return { success: false, message: 'Недостаточно серы' };
    }
    if ((give.mercury || 0) > playerResources.mercury) {
      return { success: false, message: 'Недостаточно ртути' };
    }

    // Курс обмена: 2:1 (за 2 единицы дают 1)
    // Союзники: 1.5:1
    const rate = relation.status === 'alliance' ? 1.5 : 2.0;

    // Списываем ресурсы игрока
    playerResources.gold -= give.gold || 0;
    playerResources.wood -= give.wood || 0;
    playerResources.ore -= give.ore || 0;
    playerResources.crystal -= give.crystal || 0;
    playerResources.gems -= give.gems || 0;
    playerResources.sulfur -= give.sulfur || 0;
    playerResources.mercury -= give.mercury || 0;

    // Выдаём ресурсы игроку (с учётом курса)
    playerResources.gold += Math.floor((receive.gold || 0) / rate);
    playerResources.wood += Math.floor((receive.wood || 0) / rate);
    playerResources.ore += Math.floor((receive.ore || 0) / rate);
    playerResources.crystal += Math.floor((receive.crystal || 0) / rate);
    playerResources.gems += Math.floor((receive.gems || 0) / rate);
    playerResources.sulfur += Math.floor((receive.sulfur || 0) / rate);
    playerResources.mercury += Math.floor((receive.mercury || 0) / rate);

    relation.reputation += 5;
    relation.lastAction = 'Торговля';

    return {
      success: true,
      message: `💱 Обмен с ${relation.aiName} завершён (курс: ${rate}:1)`
    };
  }

  // ==========================================================================
  // УЛЬТИМАТУМ
  // ==========================================================================

  /**
   * Отправить ультиматум ИИ
   */
  sendUltimatum(aiId: string, demand: Partial<Resources>, playerResources: Resources): string {
    const relation = this.relations.get(aiId);
    if (!relation) return 'ИИ не найден';

    // Проверяем ресурсы игрока (если требует отдать)
    if ((demand.gold || 0) > playerResources.gold) {
      return '❌ Недостаточно золота для ультиматума';
    }

    // Шанс принятия ультиматума зависит от силы игрока
    const chance = 0.2; // 20% шанс
    const accepted = Math.random() < chance;

    if (accepted) {
      // ИИ принимает — передаёт ресурсы игроку
      playerResources.gold += demand.gold || 0;
      playerResources.wood += demand.wood || 0;
      playerResources.ore += demand.ore || 0;
      playerResources.crystal += demand.crystal || 0;
      playerResources.gems += demand.gems || 0;
      playerResources.sulfur += demand.sulfur || 0;
      playerResources.mercury += demand.mercury || 0;

      relation.reputation -= 10;
      relation.lastAction = 'Ультиматум принят';
      relation.history.push({
        day: this.currentDay,
        event: 'ultimatum_accepted',
        details: `Ультиматум принят`
      });
      return `📢 ${relation.aiName} принял ваш ультиматум!`;
    } else {
      relation.reputation -= 30;
      relation.status = 'war';
      relation.lastAction = 'Ультиматум отклонён';
      relation.history.push({
        day: this.currentDay,
        event: 'ultimatum_rejected',
        details: `Ультиматум отклонён, война`
      });
      return `⚔️ ${relation.aiName} отклонил ультиматум! ВОЙНА!`;
    }
  }

  // ==========================================================================
  // ОБНОВЛЕНИЕ
  // ==========================================================================

  /**
   * Обновить дипломатию (вызывается каждый ход)
   */
  updateTurn(currentDay?: number): void {
    if (currentDay !== undefined) {
      this.currentDay = currentDay;
    }

    for (const [aiId, relation] of this.relations) {
      // Уменьшаем счётчик перемирия
      if (relation.turnsRemaining > 0) {
        relation.turnsRemaining--;
        if (relation.turnsRemaining <= 0 && relation.status === 'truce') {
          relation.status = 'war';
          relation.lastAction = 'Перемирие истекло';
          relation.history.push({
            day: this.currentDay,
            event: 'truce_expired',
            details: 'Перемирие истекло'
          });
        }
      }

      // Медленное восстановление репутации
      if (relation.reputation < 0) {
        relation.reputation = Math.min(0, relation.reputation + 1);
      }
    }
  }

  /**
   * ИИ принимает решение о дипломатии
   */
  aiEvaluateDiplomacy(aiId: string, aiPower: number, playerPower: number): string | null {
    const relation = this.relations.get(aiId);
    if (!relation || relation.status !== 'war') return null;

    // ИИ может предложить перемирие если слабее
    if (aiPower < playerPower * 0.6) {
      return 'propose_truce';
    }

    return null;
  }

  // ==========================================================================
  // СЕРИАЛИЗАЦИЯ
  // ==========================================================================

  serialize(): DiplomaticRelation[] {
    return Array.from(this.relations.values());
  }

  deserialize(data: DiplomaticRelation[]): void {
    this.relations.clear();
    for (const relation of data) {
      this.relations.set(relation.aiId, relation);
    }
  }
}
