import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PulseService, PulseMeta } from '../../services/pulse.service';
import { TooltipDirective } from '../../shared/directives/tooltip-directive';
import { TOOLTIP_DATA } from '../tooltip/tooltip';

@Component({
  selector: 'app-result-screen',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './result-screen.html',
  styleUrls: ['./result-screen.scss']
})
export class ResultScreenComponent {
  /** Впровадження інстансу сервісу аналітики пульсу через DI Token механізм Angular */
  private pulseService = inject(PulseService);
  protected readonly tooltipData = TOOLTIP_DATA;

  /**
   * Отримуємо пульс від батьківського measurement.ts.
   * Якщо на бекенді сталася помилка, сюди прийде рядок 'error'.
   */
  @Input() finalBpm!: number | 'error';

  /** Події-емітери для делегування навігації та збереження даних до батьківського контейнера */
  @Output() onHome = new EventEmitter<void>();
  @Output() onRetry = new EventEmitter<void>();
  @Output() onSave = new EventEmitter<void>();

  /** Штамп часу фіксації результату (за замовчуванням встановлює момент ініціалізації компонента) */
  public readonly measurementDate: Date = new Date();

  /**
   * Обчислювальний прапорець (Getter) для визначення валідності отриманого результату вимірювання.
   * Використовується для умовного рендерингу (Conditional Rendering via *ngIf) екрану критичної помилки.
   */
  get isError(): boolean {
    return this.finalBpm === 'error';
  }

  /**
   * Отримання обчисленого об'єкта метаданих (Design Tokens, тексти, іконки).
   * Викликає ядро аналізу rPPG-діапазонів у PulseService на основі вхідного `bpm`.
   */
  get meta(): PulseMeta {
    // Якщо сталася помилка, передаємо null у сервіс, щоб він повернув стан 'error' або 'empty'
    const valueToAnalyze = this.finalBpm === 'error' ? null : this.finalBpm;
    return this.pulseService.analyze(valueToAnalyze);
  }

  /**
   * Отримуємо текст для інформаційної підказки (тултипа) залежно від медичного статусу
   */
  get currentTooltip() {
    const status = this.meta.status;
    // Уникаємо помилок, якщо статус порожній або виникла помилка
    if (status === 'empty' || status === 'error') {
      return { title: '', paragraphs: [] };
    }
    return this.tooltipData[status];
  }

  /**
   * Контекстна мапінг-функція (Getter) для генерації локалізованого заголовка банера
   * залежно від отриманого біометричного статусу.
   */
  get statusTitleText(): string {
    switch (this.meta.status) {
      case 'low': return 'Знижені показники';
      case 'normal': return 'Все в нормі';
      case 'warning': return 'Підвищені показники';
      case 'danger': return 'Відхилення від норми';
      default: return '';
    }
  }

  /**
   * Допоміжний геттер для перевірки, чи пройшло вимірювання успішно
   */
  get isSuccess(): boolean {
    return this.finalBpm !== 'error' && this.finalBpm !== null;
  }

  /**
   * Алгоритм лінійної інтерполяції (LERP) для розрахунку зміщення маркерного вказівника на шкалі.
   * Трансформує реальне значення ЧСС у відсоткове значення `left` координати для CSS absolute positioning.
   * * Формула масштабування: f(x) = ((x - min) / (max - min)) * 100%
   * Граничні рамки за макетом: min = 40 bpm, max = 140 bpm.
   */
  get markerPosition(): string {
    if (this.isError) return '0%';

    const bpmNum = this.finalBpm as number;

    // Обчислення відносного відсотка зміщення
    const percentage = ((bpmNum - 40) / (140 - 40)) * 100;

    // clamping-захист: обмежує вихід маркера за межі фізичної шкали [0% ... 100%]
    return `${Math.max(0, Math.min(percentage, 100))}%`;
  }
}
