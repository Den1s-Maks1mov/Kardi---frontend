import { Component, inject, OnInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TooltipDirective } from '../../shared/directives/tooltip-directive';
import { TOOLTIP_DATA } from '../tooltip/tooltip';
import { PulseService, PulseMeta } from '../../services/pulse.service';
import { HistoryService } from '../../services/history.service';

/**
 * Інтерфейс для агрегованих статистичних даних за тиждень.
 */
export interface WeeklyStatsData {
  min: number | null;
  avg: number | null;
  max: number | null;
}

/**
 * WeeklyStatsComponent отримує та відображає статистику пульсу (мін, сер, макс)
 * за останній тиждень, використовуючи сервіси PulseService та HistoryService.
 */
@Component({
  selector: 'app-weekly-stats',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './weekly-stats.html',
  styleUrls: ['./weekly-stats.scss']
})
export class WeeklyStatsComponent implements OnInit {
  // Впровадження сервісів та механізмів зміни виявлення
  private pulseService = inject(PulseService);
  private historyService = inject(HistoryService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  readonly tooltipData = TOOLTIP_DATA;

  // Об'єкт зі статистикою (або null, якщо дані відсутні)
  public stats: WeeklyStatsData | null = null;
  public isLoading = true;
  public errorMessage: string | null = null;

  ngOnInit(): void {
    this.loadWeeklyStats();
  }

  /**
   * Завантаження тижневої статистики.
   * Використовує SSR-запобіжник для виключення виконання коду на стороні сервера.
   */
  private loadWeeklyStats(): void {
    // SSR Check: виконання логіки лише в браузері
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.isLoading = true;
    this.errorMessage = null;

    this.historyService.getWeeklyStats().subscribe({
      next: (data) => {
        // Ініціалізація даних або скидання до значень null за замовчуванням
        this.stats = data || { min: null, avg: null, max: null };
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;

        // Обробка специфічних помилок API (404/200/JSON errors)
        const isParseError = error?.error instanceof SyntaxError || error?.message?.includes('JSON');
        const isNoData = error.status === 404 || error.status === 200 || isParseError;

        if (isNoData) {
          this.stats = { min: null, avg: null, max: null };
          this.errorMessage = null;
        } else {
          this.errorMessage = "Зв'язок із сервером не встановлено.";
        }

        console.error('Не вдалося завантажити тижневу статистику:', error);
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Аналізує конкретне значення пульсу для відображення його мета-статусу (наприклад, колір індикатора чи категорія).
   * @param value - BPM значення для аналізу
   */
  public getMeta(value: number | null | undefined): PulseMeta {
    return this.pulseService.analyze(value ?? null);
  }
}
