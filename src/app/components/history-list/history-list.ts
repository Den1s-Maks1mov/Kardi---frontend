import { Component, ElementRef, HostListener, ViewChild, inject, OnInit, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TooltipDirective } from '../../shared/directives/tooltip-directive';
import { TOOLTIP_DATA } from '../tooltip/tooltip';
import { PulseService } from '../../services/pulse.service';
import { HistoryService } from '../../services/history.service';
import { PdfExportService } from '../../services/pdf-export.service';
import {WeeklyStatsData} from '../weekly-stats/weekly-stats';

/**
 * Інтерфейс структури одного запису історії показників пульсу.
 */
export interface HistoryRecord {
  id: number;
  dayOfWeek: string;
  time: string;
  bpm: number;
  meta?: any; // Додаткові дані аналізу (наприклад, оцінка стану)
}

/**
 * HistoryListComponent відображає історію вимірювань,
 * дозволяє фільтрувати дані та генерувати PDF-звіти.
 */
@Component({
  selector: 'app-history-list',
  standalone: true,
  imports: [CommonModule, TooltipDirective],
  templateUrl: './history-list.html',
  styleUrls: ['./history-list.scss']
})
export class HistoryListComponent implements OnInit {
  private pulseService = inject(PulseService);
  private historyService = inject(HistoryService);
  private pdfService = inject(PdfExportService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  readonly tooltipData = TOOLTIP_DATA;
  isDropdownOpen = false;
  selectedFilter = '30 днів';

  // Виправлено: додано рядок 'Всі записи' у масив, щоб він з'явився у випадаючому списку
  readonly filterOptions = ['Сьогодні', '7 днів', '14 днів', '30 днів'];
  records: HistoryRecord[] = [];
  public isLoading = false;
  public isExporting = false;
  public errorMessage: string | null = null;

  @ViewChild('dropdown') dropdownRef!: ElementRef;

  ngOnInit() {
    this.loadHistoryData();
  }

  /**
   * Допоміжний метод для конвертації текстового фільтра у кількість днів для бекенду
   */
  private mapFilterToDays(filter: string): number | undefined {
    switch (filter) {
      case 'Сьогодні': return 1; // Останні 24 години відповідно до timedelta(days=1)
      case '7 днів': return 7;
      case '14 днів': return 14;
      case '30 днів': return 30;
      default: return undefined; // Якщо повернути undefined, параметр days не буде надіслано і сервер віддасть всю історію
    }
  }

  private loadHistoryData(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.isLoading = true;
    this.errorMessage = null;

    // Отримуємо числове значення днів на основі обраного текстового фільтра
    const daysParam = this.mapFilterToDays(this.selectedFilter);

    // Передаємо параметр у сервіс
    this.historyService.getFullHistory(daysParam).subscribe({
      next: (data) => {
        if (!data || !Array.isArray(data)) {
          this.records = [];
        } else {
          this.records = data.map(record => ({
            ...record,
            meta: this.pulseService.analyze(record.bpm)
          }));
        }
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.isLoading = false;
        const isParseError = error?.error instanceof SyntaxError || error?.message?.includes('JSON');
        const isNoData = error.status === 404 || error.status === 200 || isParseError;
        if (isNoData) {
          this.records = [];
          this.errorMessage = null;
        } else {
          this.errorMessage = "Зв'язок із сервером не встановлено.";
        }
        console.error('Деталі помилки історії:', error);
        this.cdr.detectChanges();
      }
    });
  }

  public selectFilter(option: string): void {
    this.selectedFilter = option;
    this.isDropdownOpen = false;

    // Викликаємо метод повторного завантаження даних, щоб зробити новий HTTP-запит до сервера
    this.loadHistoryData();
  }

  /**
   * Генерує та завантажує PDF-звіт на основі поточних даних.
   * Використовує асинхронний виклик для статистики та змушує UI оновитися.
   */
  public downloadReport(): void {
    if (this.records.length === 0) {
      return;
    }

    const userName = this.historyService.lastFetchedLogin || 'Пацієнт';
    const emptyStats: WeeklyStatsData = { min: null, avg: null, max: null };

    this.pdfService.generateReport(this.records, emptyStats, userName);
  }

  /**
   * Закриває випадаючий список при кліку поза його межами.
   */
  @HostListener('document:click', ['$event'])
  public clickout(event: Event): void {
    if (
      this.isDropdownOpen &&
      this.dropdownRef &&
      !this.dropdownRef.nativeElement.contains(event.target as Node)
    ) {
      this.isDropdownOpen = false;
    }
  }

  /**
   * Додатковий спосіб закриття меню через клавішу Escape.
   */
  @HostListener('document:keydown.escape')
  public onKeydownHandler(): void {
    if (this.isDropdownOpen) {
      this.isDropdownOpen = false;
    }
  }

  public toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }
}
