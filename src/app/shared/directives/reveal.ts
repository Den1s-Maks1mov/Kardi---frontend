import { Directive, ElementRef, AfterViewInit, OnDestroy, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Directive({
  selector: '[appReveal]',
  standalone: true
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  /** Екземпляр асинхронного системного Web API для оптимізованого відстеження перетину меж Viewport */
  private observer: IntersectionObserver | null = null;

  constructor(
    private el: ElementRef,
    /** Впровадження ідентифікатора платформи для верифікації середовища виконання (Browser vs Server) */
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  /**
   * Хук життєвого циклу, що викликається після повної ініціалізації представлення (View) та DOM-вузлів.
   * Використовується як ідеальна точка для старту маніпуляцій з нативними елементами.
   */
  ngAfterViewInit(): void {
    /**
     * Захист від помилок SSR (Server-Side Rendering Guard).
     * Оскільки `IntersectionObserver` є специфічним браузерним Web API, його виклик у середовищі Node.js (при SSR/Prerendering)
     * призведе до критичного збою (ReferenceError). Код виконується виключно на стороні клієнта.
     */
    if (isPlatformBrowser(this.platformId)) {

      // Конфігурація параметрів відстеження перетину меж
      const options = {
        root: null,       // В якості контейнера виступає системний Viewport браузера
        rootMargin: '0px',// Нульові зміщення меж відносно країв екрану
        threshold: 0.25   // Спрацювання колбеку відбудеться при фіксації 25% площі елемента в полі зору
      };

      /**
       * Ініціалізація спостерігача із застосуванням деструктуризації масиву записів перетину `[entry]`.
       * Забезпечує високу продуктивність інтерфейсу, оскільки обчислення виконуються асинхронно у фоновому потоці браузера,
       * на відміну від класичного слухання подій `window.scroll` (яке перевантажує Main Thread).
       */
      this.observer = new IntersectionObserver(([entry]) => {

        // Валідація факту входження елемента в активну зону Viewport
        if (entry.isIntersecting) {
          // Додавання класу-маркера, що запускає анімаційні CSS-переходи (Transitions/Keyframes)
          this.el.nativeElement.classList.add('is-visible');

          /**
           * Патерн "Одноразова анімація" (Once Animation Pattern).
           * Після першої фіксації елемента ми повністю демонтуємо та відключаємо `IntersectionObserver`.
           * Це звільняє обчислювальні ресурси пристрою та запобігає повторному миготінню інтерфейсу при скролі.
           */
          if (this.observer) {
            this.observer.disconnect();
          }
        }
      }, options);

      // Реєстрація нативного DOM-елемента у черзі спостереження рушія IntersectionObserver
      this.observer.observe(this.el.nativeElement);
    }
  }

  /**
   * Хук життєвого циклу деструкції директиви.
   * Виконує обов'язкове очищення для запобігання витокам оперативної пам'яті (Memory Leaks).
   */
  ngOnDestroy(): void {
    /**
     * Якщо компонент або сторінку було демонтовано (наприклад, через Angular Router) до того,
     * як елемент потрапив на екран, примусово відключаємо спостерігач, руйнуючи посилання в Memory Heap.
     */
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
