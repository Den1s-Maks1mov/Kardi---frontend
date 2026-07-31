import { Component, inject, OnInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule } from '@angular/router';
import { TooltipDirective } from '../../shared/directives/tooltip-directive';
import { TOOLTIP_DATA } from '../tooltip/tooltip';
import { PulseService, PulseMeta } from '../../services/pulse.service';
import { HistoryService } from '../../services/history.service';

/**
 * Інтерфейс для даних вимірювання за сьогодні.
 */
export interface TodayData {
  time: string;
  bpm: number | null;
}

/**
 * TodayMeasurementComponent відповідає за отримання та візуалізацію
 * результату останнього вимірювання пульсу за поточну добу.
 */
@Component({
  selector: 'app-today-measurement',
  standalone: true,
  imports: [CommonModule, TooltipDirective, RouterModule],
  templateUrl: './today-measurement.html',
  styleUrls: ['./today-measurement.scss']
})
export class TodayMeasurementComponent implements OnInit {
  private pulseService = inject(PulseService);
  private historyService = inject(HistoryService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  protected readonly tooltipData = TOOLTIP_DATA;

  public data: TodayData | null = null;
  public isLoading = true;
  public errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadTodayData();
  }

  /**
   * Завантаження даних вимірювання з API.
   * Містить перевірку на платформу (SSR safe) та логіку обробки статусів відповіді.
   */
  private loadTodayData(): void {
    // SSR Check: запобігання виконанню запитів на сервері
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.historyService.getTodayData().subscribe({
      next: (response) => {
        this.data = response;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;

        // Обробка специфічних помилок API або відсутності даних (404/Empty)
        const isParseError = error?.error instanceof SyntaxError || error?.message?.includes('JSON');
        const isNoData = error.status === 404 || error.status === 200 || isParseError;

        if (isNoData) {
          this.data = { time: '--:--', bpm: null };
          this.errorMessage = null;
        } else {
          this.errorMessage = 'Зв\'язок із сервером не встановлено.';
        }

        console.error('Не вдалося завантажити дані за сьогодні:', error);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Перевірка наявності валідних даних пульсу.
   */
  get hasData(): boolean {
    return !!this.data && this.data.bpm !== null;
  }

  /**
   * Отримання метаданих стану пульсу (норма/відхилення) через сервіс.
   */
  get meta(): PulseMeta {
    return this.pulseService.analyze(this.data?.bpm ?? null);
  }

  /**
   * Повертає контент для підказки (tooltip) на основі поточного статусу пульсу.
   */
  get currentTooltip() {
    const status = this.meta.status;
    if (status === 'empty' || status === 'error') return { title: '', paragraphs: [] };
    return this.tooltipData[status];
  }

  /**
   * Обчислення позиції маркера на шкалі вимірювань (у відсотках).
   * Використовує лінійну інтерполяцію між межами 40-140 BPM.
   */
  get markerPosition(): string {
    if (!this.hasData || !this.data || this.data.bpm === null) return '0%';

    const bpm = this.data.bpm;
    const minBpm = 40;
    const maxBpm = 140;

    let percentage = ((bpm - minBpm) / (maxBpm - minBpm)) * 100;
    // Обмежуємо значення в діапазоні [0, 100]%
    return `${Math.max(0, Math.min(percentage, 100))}%`;
  }
}
