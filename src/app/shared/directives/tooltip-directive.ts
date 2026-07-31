import { Directive, ElementRef, HostListener, Input, ComponentRef, inject } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { TooltipComponent, TooltipContent } from '../../components/tooltip/tooltip';

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective {
  /** Впровадження низькорівневого CDK Overlay сервісу для динамічного створення шарів накладання (Floating Panels) */
  private overlay = inject(Overlay);

  /** Отримання посилання на нативний хост-елемент (Anchor Element), до якого прикріплено директиву */
  private elementRef = inject(ElementRef);

  /** Вхідні структуровані дані підказки (Вхідний API-аліас співпадає із назвою селектора) */
  @Input('appTooltip') content!: TooltipContent;

  /** Посилання на інстанс створеного оверлей-контейнера у глобальному Portal Root */
  private overlayRef: OverlayRef | null = null;

  /** Програмне посилання на інстанс згенерованого всередині оверлею компонента для прямої мутації його властивостей */
  private componentRef: ComponentRef<TooltipComponent> | null = null;

  /**
   * Слухач подій ховеру (Mouse Enter Event Bound).
   * Ініціалізує та монтує плаваючу панель підказки в DOM-дерево при наведенні курсору.
   */
  @HostListener('mouseenter')
  public show(): void {
    // Захист від дублювання: якщо оверлей вже відрендерено — перериваємо виконання
    if (this.overlayRef) return;

    /**
     * Конфігурація гнучкої стратегії просторового позиціонування (Flexible Connected Position Strategy).
     * Розраховує оптимальні координати відображення плаваючої панелі відносно хост-елемента.
     */
    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.elementRef)
      .withViewportMargin(16) // Обов'язковий безпековий відступ (Bounding Box Padding) від країв екрану браузера
      .withPositions([
        // Пріоритет 1: Рендеринг вертикально ЗНИЗУ по центру відносно іконки-якоря
        { originX: 'center', originY: 'bottom', overlayX: 'center', overlayY: 'top', offsetY: 8 },
        // Пріоритет 2 (Fallback): Якщо знизу немає місця (Collision) — перекидаємо ЗВЕРХУ по центру
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -8 },
        // Пріоритет 3 (Fallback): Екстремальне зміщення ЗЛІВА за браком вертикального простору
        { originX: 'start', originY: 'center', overlayX: 'end', overlayY: 'center', offsetX: -8 }
      ]);

    /**
     * Створення інстансу OverlayRef з визначеними параметрами поведінки.
     * Розміщує порожній контейнер-підкладку у спеціальному глобальному вузлі `cdk-overlay-container` наприкінці `<body>`.
     */
    this.overlayRef = this.overlay.create({
      positionStrategy,
      // Стратегія репозиціонування: автоматично перераховує координати підказки при скролі сторінки (Anti-drift)
      scrollStrategy: this.overlay.scrollStrategies.reposition(),
      hasBackdrop: false // Відсутність заднього фону гарантує, що підказка не блокуватиме кліки по інших елементах UI
    });

    /**
     * Ініціалізація компонента через механізм Angular Portals (ComponentPortal).
     * Програмно інжектує та монтує `TooltipComponent` всередину створеного оверлею.
     */
    const tooltipPortal = new ComponentPortal(TooltipComponent);
    this.componentRef = this.overlayRef.attach(tooltipPortal);

    /**
     * Пряме зв'язування даних (Direct Property Injection).
     * Передає розпарсений контент типу `TooltipContent` безпосередньо в інстанс новоствореного компонента.
     */
    this.componentRef.instance.title = this.content.title;
    this.componentRef.instance.paragraphs = this.content.paragraphs;
    this.componentRef.instance.alertText = this.content.alertText || '';
  }

  /**
   * Слухач подій виходу курсору (Mouse Leave Event Bound).
   * Ініціює повне демонтування та деструкцію елементів підказки.
   */
  @HostListener('mouseleave')
  public hide(): void {
    this.destroy();
  }

  /**
   * Хук життєвого циклу деструкції директиви.
   * Обов'язково викликає метод `destroy()` для запобігання витокам пам'яті (Memory Leaks),
   * якщо хост-елемент буде видалено з DOM (наприклад, при переході через Angular Router).
   */
  ngOnDestroy(): void {
    this.destroy();
  }

  /**
   * Комплексна утилізація та очищення виділених асинхронних ресурсів CDK Overlay.
   */
  private destroy(): void {
    if (this.overlayRef) {
      this.overlayRef.detach();  // Відкріплює ComponentPortal від CDK контейнера
      this.overlayRef.dispose(); // Повністю видаляє нативний cdk-обгортку з DOM-структури body та очищає підписки
      this.overlayRef = null;
      this.componentRef = null;
    }
  }
}
