import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Інтерфейс, що описує структуру даних окремого кадру (слайду) інструкції.
 */
interface InstructionSlide {
  icon: string;
  title: string;
  desc: string;
}

@Component({
  selector: 'app-instruction-slider',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './instruction-slider.html',
  styleUrls: ['./instruction-slider.scss']
})
export class InstructionSlider {
  /** * Подія-емітер (Event Boundary), що сигналізує батьківському компоненту
   * про успішне проходження та верифікацію користувачем усіх інструкцій.
   */
  @Output() onComplete = new EventEmitter<void>();

  /** Індекс поточного активного слайду (Zero-based Index) */
  currentSlide = 0;

  /**
   * Статична колекція об'єктів (Data Array) для рендерингу кроків підготовки.
   * Описує необхідні фізичні умови (Environmental Conditions) для коректної роботи rPPG-алгоритму.
   */
  public readonly slides: InstructionSlide[] = [
    {
      icon: '/assets/tutorial-face.svg',
      title: '1. Дивіться прямо в камеру',
      desc: 'Не рухайте голову, дивіться прямо в камеру на рівні очей, таким чином вимірювання буде більш чітке.'
    },
    {
      icon: '/assets/tutorial-glasses.svg',
      title: '2. Не прикривайте обличчя',
      desc: 'Ваше обличчя має бути видно. Зніміть окуляри, приберіть волосся з лиця.'
    },
    {
      icon: '/assets/tutorial-light.svg',
      title: '3. Увімкніть світло',
      desc: 'У вашій кімнаті повинно бути достатньо світла, зробіть так, аби ваше обличчя було ясне як день.'
    }
  ];

  /**
   * Логічний метод інкременту поточного кроку інструкції.
   * Виконує валідацію межі масиву (Array Bound Check). Якщо досягнуто термінального слайду,
   * ініціалізує пайплайн події `onComplete` для запуску запису камери.
   */
  public nextSlide(): void {
    if (this.currentSlide < this.slides.length - 1) {
      this.currentSlide++;
    } else {
      // Вихід за межі масиву слайдів означає завершення ознайомлення
      this.onComplete.emit();
    }
  }

  /**
   * Логічний метод декременту поточного кроку інструкції.
   * Містить захист від виходу за нижню межу масиву (Underflow Protection), обмежуючи індекс нулем.
   */
  public prevSlide(): void {
    if (this.currentSlide > 0) {
      this.currentSlide--;
    }
  }
}
