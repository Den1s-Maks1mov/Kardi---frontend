import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

// Імпорти бібліотеки pdfmake для генерації PDF-документів на стороні клієнта
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import { HistoryRecord } from '../components/history-list/history-list';
import { WeeklyStatsData } from '../components/weekly-stats/weekly-stats';
import { PulseService, PulseMeta } from './pulse.service';

@Injectable({
  providedIn: 'root' // Сервіс реєструється на кореневому рівні (Singleton), один екземпляр на весь застосунок
})
export class PdfExportService {
  // Використання функції inject() (доступно з Angular 14+) як альтернатива ін'єкції через конструктор
  private pulseService = inject(PulseService);
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);

  // Кешуємо ресурси прямо в класі.
  // Збереження SVG у вигляді рядків дозволяє уникнути асинхронних HTTP-запитів безпосередньо під час формування PDF.
  private logoSvg = `<svg width="100" height="30" viewBox="0 0 100 30" xmlns="http://www.w3.org/2000/svg"><text x="0" y="20" fill="#5673D3" font-family="sans-serif" font-size="24" font-weight="bold">Kardi</text></svg>`;
  private iconsCache: Record<string, string> = {};

  constructor() {
    // Щойно сервіс ініціалізується, ми у фоновому режимі (не блокуючи UI) завантажуємо іконки.
    // isPlatformBrowser гарантує, що код виконається лише в браузері (важливо для сумісності з Server-Side Rendering - SSR).
    if (isPlatformBrowser(this.platformId)) {
      this.preloadAssets();
    }
  }

  /**
   * Асинхронне завантаження SVG-файлів як тексту для подальшого вбудовування в PDF.
   * Використовує Promise.all для паралельного виконання HTTP-запитів.
   */
  private async preloadAssets() {
    try {
      // lastValueFrom перетворює Observable від HttpClient у Promise
      const [logo, alert, minus, check, arrowDown] = await Promise.all([
        lastValueFrom(this.http.get('/assets/kardi-logo.svg', { responseType: 'text' })),
        lastValueFrom(this.http.get('/assets/alert-circle.svg', { responseType: 'text' })),
        lastValueFrom(this.http.get('/assets/minus-circle.svg', { responseType: 'text' })),
        lastValueFrom(this.http.get('/assets/check-circle.svg', { responseType: 'text' })),
        lastValueFrom(this.http.get('/assets/arrow-down-circle.svg', { responseType: 'text' }))
      ]);

      // Заповнення кешу в пам'яті
      this.logoSvg = logo;
      this.iconsCache['/assets/alert-circle.svg'] = alert;
      this.iconsCache['/assets/minus-circle.svg'] = minus;
      this.iconsCache['/assets/check-circle.svg'] = check;
      this.iconsCache['/assets/arrow-down-circle.svg'] = arrowDown;
    } catch (e) {
      console.warn('Не вдалося завантажити SVG ресурси у фоні', e);
    }
  }

  // МЕТОД ЗНОВУ СТАВ СИНХРОННИМ (БЕЗ ASYNC)
  // Завдяки попередньому кешуванню SVG, генерація PDF більше не потребує очікування I/O операцій.
  public generateReport(history: HistoryRecord[], stats: WeeklyStatsData, userName: string = 'Гість') {
    if (!isPlatformBrowser(this.platformId)) return; // Блокуємо виконання при SSR

    // Ініціалізація віртуальної файлової системи (VFS) шрифтів для pdfmake
    const pdfMakeAny = pdfMake as any;
    const pdfFontsAny = pdfFonts as any;
    pdfMakeAny.vfs = pdfFontsAny?.pdfMake?.vfs || pdfFontsAny?.vfs;

    const currentDate = new Date();
    const formattedDate = this.formatDate(currentDate);

    // Обчислення часового проміжку (періоду) на основі масиву історії
    let periodText = 'весь час';
    if (history.length > 0) {
      const dates = history.map(h => new Date(h.id).getTime());
      const minDate = Math.min(...dates);
      const maxDate = Math.max(...dates);
      const diffDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)); // Конвертація мілісекунд у дні

      if (diffDays <= 1) periodText = 'сьогодні';
      else periodText = `останні ${diffDays} днів`;
    }

    // Конфігурація документа pdfmake (Document Definition Object)
    const documentDefinition: any = {
      pageSize: 'A4',
      pageMargins: [0, 110, 0, 80], // Відступи сторінки: [left, top, right, bottom]

      // Динамічний генератор заголовка (викликається для кожної сторінки)
      header: () => {
        return {
          margin: [40, 40, 40, 0],
          stack: [
            {
              columns: [
                { svg: this.logoSvg, width: 100 }, // Використовуємо кеш
                {
                  stack: [
                    { text: formattedDate, alignment: 'right', color: '#64748B', fontSize: 12, margin: [0, 0, 0, 8] },
                    { text: `Історія вимірювання (${userName}) за ${periodText}`, alignment: 'right', color: '#0F172A', fontSize: 14, bold: true }
                  ]
                }
              ]
            },
            {
              // Малювання розділової лінії за допомогою Canvas API від pdfmake
              canvas: [{ type: 'line', x1: -40, y1: 20, x2: 555, y2: 20, lineWidth: 2, lineColor: '#5673D3' }]
            }
          ]
        };
      },

      footer: () => {
        return {
          margin: [40, 20, 40, 0],
          columns: [
            { svg: this.logoSvg, width: 80 },
            { text: formattedDate, alignment: 'right', color: '#64748B', fontSize: 12, margin: [0, 8, 0, 0] }
          ]
        };
      },

      content: [
        this.createHistoryTable(history)
      ],
      defaultStyle: {
        font: 'Roboto', // Базовий шрифт
        color: '#334155'
      }
    };

    // Створення PDF та автоматичне відкриття у новій вкладці браузера
    pdfMakeAny.createPdf(documentDefinition).open();
  }

  /**
   * Генерує структуру таблиці історії у форматі, зрозумілому для pdfmake.
   */
  private createHistoryTable(history: HistoryRecord[]) {
    // Ініціалізація масиву рядків таблиці з заголовком
    const tableBody: any[][] = [
      [
        { text: 'Дата', bold: true, color: '#0F172A', fontSize: 14 },
        { text: 'Пульс', bold: true, color: '#0F172A', fontSize: 14 },
        { text: 'Характеристика', bold: true, color: '#0F172A', fontSize: 14, alignment: 'right' }
      ]
    ];

    history.forEach(record => {
      // Отримання метаданих (колір, бейдж) через бізнес-логіку PulseService
      const meta = this.pulseService.analyze(record.bpm);
      const exactDate = new Date(record.id);
      const dateString = `${this.formatDateOnly(exactDate)}`;
      const timeString = record.time;

      // Беремо іконку з кешу напряму (синхронний доступ)
      const iconSvgCode = this.iconsCache[meta.icon] || '';

      tableBody.push([
        {
          text: [
            { text: dateString, color: '#0F172A', bold: true },
            { text: `  ${timeString}`, color: '#94A3B8' }
          ],
          margin: [0, 15, 0, 15]
        },
        {
          text: `${record.bpm} bpm`,
          color: meta.color,
          bold: true,
          fontSize: 16,
          margin: [0, 15, 0, 15]
        },
        {
          svg: this.generateBadgeSvg(meta, iconSvgCode), // Вбудовування згенерованого SVG-бейджа
          width: 160,
          alignment: 'right',
          margin: [0, 10, 0, 10]
        }
      ]);
    });

    return {
      table: {
        headerRows: 1, // Закріплює перший рядок як заголовок при розриві сторінок
        widths: ['30%', '30%', '40%'], // Пропорційний розподіл ширини колонок
        body: tableBody
      },
      layout: {
        // Кастомні налаштування меж таблиці (показувати лише горизонтальні роздільники)
        hLineWidth: (i: number) => (i === 0) ? 0 : 1,
        vLineWidth: () => 0,
        hLineColor: () => '#E2E8F0',
        paddingLeft: () => 40,
        paddingRight: () => 40,
        paddingTop: () => 4,
        paddingBottom: () => 4
      }
    };
  }

  /**
   * Створює композитний SVG-код для бейджа характеристики (з фоном, текстом та іконкою).
   */
  private generateBadgeSvg(meta: PulseMeta, iconSvgCode: string): string {
    // Запобіжник: якщо замість SVG сервер повернув HTML-сторінку (наприклад, помилку 404)
    if (iconSvgCode.toLowerCase().includes('<html')) {
      iconSvgCode = '';
    }

    // Очищення імпортованого SVG від XML-декларацій, які конфліктують із парсером pdfmake
    const cleanIconSvg = iconSvgCode
      .replace(/<\?xml.*?\?>/gi, '')
      .replace(/<!DOCTYPE.*?>/gi, '')
      .trim();

    // Динамічна заміна змінної currentColor на конкретний HEX-колір із метаданих
    const coloredIconSvg = cleanIconSvg.replace(/currentColor/g, meta.color);

    // Додаємо екранування тексту для XML/SVG, щоб уникнути помилок парсингу при наявності спецсимволів
    const safeBadgeText = meta.badgeText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

    // Повертаємо цілісний SVG-контейнер з вкладеною графікою
    return `
      <svg width="180" height="36" viewBox="0 0 180 36" xmlns="http://www.w3.org/2000/svg">
        <rect x="0" y="0" width="180" height="36" rx="18" fill="${meta.bgColor}" />
        <text x="80" y="23" fill="${meta.color}" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">${safeBadgeText}</text>
        <g transform="translate(144, 6)">
          ${coloredIconSvg}
        </g>
      </svg>
    `;
  }

  // Допоміжні функції для форматування дати
  private formatDate(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d} - ${m} (${y})`;
  }

  private formatDateOnly(date: Date): string {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${d}.${m}`;
  }
}
