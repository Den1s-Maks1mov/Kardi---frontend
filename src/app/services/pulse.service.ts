import { Injectable } from '@angular/core';

/**
 * Строгий перелік логічних станів (Union Type), що відображають rPPG-статуси та системні виключення.
 */
export type PulseStatus = 'low' | 'normal' | 'warning' | 'danger' | 'error' | 'empty';

/**
 * Інтерфейс, що описує структуру результуючих метаданих (Design Tokens / UI Metadata Layer).
 * Агрегує токени стилів та текстові ресурси для консистентного рендерингу у шаблонах.
 */
export interface PulseMeta {
  status: PulseStatus;
  badgeText: string;
  icon: string;
  color: string;       // Шістнадцятковий код (HEX) для токенів тексту, іконок та рамкових меж (Border Colors)
  bgColor: string;     // Шістнадцятковий код (HEX) для токенів фонових підкладок (Background Colors)
}

@Injectable({
  // Реєстрація сервісу як Singleton на рівні Root Injector (Global Application Scope)
  providedIn: 'root'
})
export class PulseService {

  /**
   * Централізований аналітичний метод (Business Logic Core). Реалізує архітектурний патерн "Єдине джерело правди"
   * (Single Source of Truth). Обчислює медичні rPPG-діапазони на основі вхідного ЧСС та повертає
   * відповідні UI-декоратори, виключаючи дублювання логіки умовних розгалужень у компонентах.
   * * @param bpm - Показник частоти серцевих скорочень (число), прапорець відсутності виміру (null) або стан системного збою ('error')
   * @returns Об'єкт інкапсульованих метаданих та дизайн-токенів PulseMeta
   */
  public analyze(bpm: number | null | 'error'): PulseMeta {

    // ==========================================================================
    // 1. ВАЛІДАЦІЯ СИСТЕМНИХ ВИКЛЮЧЕНЬ ТА КРИТИЧНИХ СТАНІВ (Edge Cases)
    // ==========================================================================

    // Сценарій 'error': Біометричний запис перервано через критичне порушення умов ШІ-камери
    if (bpm === 'error') {
      return {
        status: 'error',
        badgeText: 'Помилка',
        icon: '/assets/alert-circle.svg',
        color: '#EF383C',
        bgColor: '#FEF2F2'
      };
    }

    // Сценарій null: Нульовий зріз даних (наприклад, за поточну добу ще не було ініційовано жодного заміру)
    if (bpm === null) {
      return {
        status: 'empty',
        badgeText: 'Немає даних',
        icon: '',
        color: '#8B91A4',
        bgColor: '#F4F6FB'
      };
    }

    // ==========================================================================
    // 2. ДЕТЕКЦІЯ ТА КЛАСИФІКАЦІЯ КЛІНІЧНИХ ДІАПАЗОНІВ ЧСС (rPPG Threshold Mapping)
    // ==========================================================================

    // Діапазон: Брадикардія (Знижена частота серцевих скорочень у стані спокою)
    if (bpm < 60) {
      return {
        status: 'low',
        badgeText: 'Низький (< 60)',
        icon: '/assets/arrow-down-circle.svg',
        color: '#5673D3',
        bgColor: '#EEF1FD'
      };
    }

    // Діапазон: Нормосистолія (Здоровий фізіологічний показник серцево-судинної системи)
    if (bpm >= 60 && bpm <= 100) {
      return {
        status: 'normal',
        badgeText: 'Норма (60 - 100)',
        icon: '/assets/check-circle.svg',
        color: '#21BC54',
        bgColor: '#EEFAF5'
      };
    }

    // Діапазон: Помірна (гранична) Тахікардія. Може виникати внаслідок стресу або кавової стимуляції
    if (bpm > 100 && bpm <= 130) {
      return {
        status: 'warning',
        badgeText: 'Межа (100 - 130)',
        icon: '/assets/minus-circle.svg',
        color: '#E8A90B',
        bgColor: '#FDF7E7'
      };
    }

    // Термінальний діапазон: Виражена Тахікардія (Суттєве патологічне відхилення для стану спокою, bpm > 130)
    return {
      status: 'danger',
      badgeText: 'Відхилення (130 - 140+)',
      icon: '/assets/alert-circle.svg',
      color: '#EF383C',
      bgColor: '#FDE7E7'
    };
  }
}
