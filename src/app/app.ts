import { Component, signal } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { HeaderComponent } from './components/header/header';
import { FooterComponent } from './components/footer/footer';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';

@Component({
  selector: 'app-root',
  standalone: true,
  // Набір імпортованих залежностей для забезпечення роботи базових директив та дочірніх компонентів макета
  imports: [
    CommonModule,
    RouterOutlet,
    HeaderComponent,
    FooterComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  /** * Текстовий ідентифікатор застосунку, обгорнутий у реактивний контейнер Angular Signals.
   * Модифікатор `protected readonly` обмежує область видимості межами шаблону та захищає посилання від перезапису.
   */
  protected readonly title = signal('kardi');

  /** Прапорець-маркер для умовного відображення наскрізних UI-компонентів (Shell Components Visibility) */
  public showHeaderFooter = true;

  constructor(private router: Router) {
    this.initLayoutOrchestrator();
  }

  /**
   * Патерн Декларативного оркестрування макета (Layout Orchestrator Pattern).
   * Реалізує реактивне відстеження життєвого циклу маршрутизації через RxJS-пайплайн.
   * Зчитує метадані з активованих конфігурацій для динамічного керування структурними блоками сторінки.
   */
  private initLayoutOrchestrator(): void {
    this.router.events.pipe(
      /**
       * Оператор фільтрації потоку RxJS.
       * Пропускає далі по ланцюжку лише події типу `NavigationEnd`, які сигналізують
       * про успішне завершення фази переходу та фіксацію нового URL-абзацу.
       */
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {

      /**
       * Алгоритм рекурсивного обходу дерева маршрутизації (Router Tree Traversal).
       * Angular оперує ієрархічною структурою роутів. Для отримання кастомних метаданих
       * безпосередньо поточної сторінки, ми стартуємо з кореня (`root`) і за допомогою циклу `while`
       * спускаємось до найглибшого активованого дочірнього вузла (`firstChild`), тобто кінцевого маршруту.
       */
      let currentRoute = this.router.routerState.root;
      while (currentRoute.firstChild) {
        currentRoute = currentRoute.firstChild;
      }

      /**
       * Екстракція статичних метаданих із фіксованого зліпку активованого маршруту (ActivatedRouteSnapshot).
       * Зчитує кастомний прапорець `hideLayout` із конфігураційного об'єкта `data`, визначеного у файлі `app.routes.ts`.
       */
      const isLayoutHidden = currentRoute.snapshot.data['hideLayout'] === true;

      /**
       * Мутація стану відображення. Інверсоване значення прапорця автоматично тригерить
       * перевірку змін Angular (Change Detection), приховуючи або монтуючи блоки `<app-header>` та `<app-footer>`
       * за допомогою директиви `*ngIf` у HTML-шаблоні.
       */
      this.showHeaderFooter = !isLayoutHidden;
    });
  }
}
