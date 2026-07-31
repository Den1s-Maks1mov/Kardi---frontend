import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../shared/environments/environment';

import { HistoryRecord } from '../components/history-list/history-list';
import { TodayData } from '../components/today-measurement/today-measurement';
import { WeeklyStatsData } from '../components/weekly-stats/weekly-stats';

export interface BackendHistoryItem {
  user_id?: number;
  timestamp: string;
  bpm: number;
  signal_quality: number;
  status?: string;
  processing_time_ms: number;
  request_id: string;
}

export interface HistoryApiResponse {
  user_login: string;
  total_records: number;
  data: BackendHistoryItem[];
}

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/history/`;
  public lastFetchedLogin: string = 'Користувач';

  /**
   * Конвертація часу з бази даних (UTC) у місцевий час користувача.
   * SQLite віддає час без маркера часового поясу (наприклад, "2026-06-19 23:56:34"),
   * через що браузер сприймає його як локальний. Ця функція додає потрібний маркер.
   */
  private parseUtcDate(timestamp: string): Date {
    // Замінюємо пробіл на 'T' (стандарт ISO), якщо база віддала формат з пробілом
    let isoString = timestamp.replace(' ', 'T');

    // Додаємо 'Z' (Zulu), щоб браузер точно зрозумів, що це UTC і правильно додав ваші +3 години
    if (!isoString.endsWith('Z')) {
      isoString += 'Z';
    }
    return new Date(isoString);
  }

  /**
   * 1. Отримання історії вимірювань (з можливістю фільтрації за кількістю днів)
   */
  getFullHistory(days?: number): Observable<HistoryRecord[]> {
    const options = days ? { params: { days: days.toString() } } : {};

    return this.http.get<any>(this.apiUrl, options).pipe(
      map(response => {
        // 1. Зберігаємо нікнейм, який прийшов від бекенду
        if (response?.user_login) {
          this.lastFetchedLogin = response.user_login;
        }

        // 2. Обробляємо масив записів (як і раніше)
        const items = response?.data;
        if (!items || !Array.isArray(items)) {
          return [];
        }

        const sortedItems = items.sort((a, b) =>
          this.parseUtcDate(b.timestamp).getTime() - this.parseUtcDate(a.timestamp).getTime()
        );
        return sortedItems.map((item, index) => this.mapToHistoryRecord(item, index));
      })
    );
  }

  /**
   * 2. Отримання даних для віджета "Сьогодні"
   */
  getTodayData(): Observable<TodayData> {
    // Звертаємось до всієї історії, щоб уникнути помилок фільтрації на бекенді
    return this.http.get<HistoryApiResponse>(this.apiUrl).pipe(
      map(response => {
        const items = response?.data;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return { time: '--:--', bpm: null };
        }

        const todayStr = new Date().toDateString();

        // Фільтруємо записи з урахуванням конвертованого часового поясу
        const todayItems = items.filter(item =>
          this.parseUtcDate(item.timestamp).toDateString() === todayStr
        );

        if (todayItems.length === 0) {
          return { time: '--:--', bpm: null };
        }

        // Знаходимо найсвіжіший вимір
        const latest = todayItems.reduce((a, b) =>
          this.parseUtcDate(a.timestamp).getTime() > this.parseUtcDate(b.timestamp).getTime() ? a : b
        );

        return {
          time: this.extractTime(this.parseUtcDate(latest.timestamp)),
          bpm: Math.round(latest.bpm)
        };
      })
    );
  }

  /**
   * 3. Отримання тижневої статистики
   */
  getWeeklyStats(): Observable<WeeklyStatsData> {
    return this.http.get<HistoryApiResponse>(this.apiUrl).pipe(
      map(response => {
        const items = response?.data;

        if (!items || !Array.isArray(items) || items.length === 0) {
          return { min: null, avg: null, max: null };
        }

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Фільтруємо з правильним місцевим часом
        const weeklyItems = items.filter(item =>
          this.parseUtcDate(item.timestamp) >= sevenDaysAgo
        );

        if (weeklyItems.length === 0) {
          return { min: null, avg: null, max: null };
        }

        const bpms = weeklyItems.map(i => i.bpm);
        const min = Math.round(Math.min(...bpms));
        const max = Math.round(Math.max(...bpms));
        const avg = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);

        return { min, avg, max };
      })
    );
  }

  // ДОПОМІЖНІ МЕТОДИ ДЛЯ ФОРМАТУВАННЯ

  private mapToHistoryRecord(item: BackendHistoryItem, index: number): HistoryRecord {
    const date = this.parseUtcDate(item.timestamp);
    return {
      id: date.getTime() + index,
      // Замість сухого виклику getUkrainianDayOfWeek впроваджуємо гнучкий метод форматизації дати
      dayOfWeek: this.getDisplayDateOrDay(date),
      time: this.extractTime(date),
      bpm: Math.round(item.bpm)
    };
  }

  private getDisplayDateOrDay(date: Date): string {
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

  // Обнуляємо часові компоненти (години, хвилини) для точного порівняння саме календарних днів
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfRecordDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

  // Розраховуємо різницю в днях
    const diffDays = Math.round((startOfNow - startOfRecordDate) / oneDayMs);

    if (diffDays < 7) {
      return this.getUkrainianDayOfWeek(date);
    } else {
      const day = date.getDate().toString().padStart(2, '0');
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      return `${day}.${month}`;
    }
  }

  private extractTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private getUkrainianDayOfWeek(date: Date): string {
    const days = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
    return days[date.getDay()];
  }
}
