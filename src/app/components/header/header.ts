import { Component, HostListener, inject, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * HeaderComponent відповідає за навігаційну панель додатку.
 * Керує станом прокрутки (scroll), навігацією та випадаючим меню профілю користувача.
 */
@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrls: ['./header.scss']
})
export class HeaderComponent {
  // Впровадження залежностей через inject() API
  public authService = inject(AuthService);
  private router = inject(Router);
  private eRef = inject(ElementRef); // Посилання на DOM-елемент компонента для перевірки області кліку

  // Стан для динамічних стилів (наприклад, зміна фону при скролі)
  isScrolled = false;
  // Стан видимості випадаючого меню профілю
  isProfileMenuOpen = false;

  // Перевіряємо, чи є поточний URL сторінкою історії
  get isHistoryRoute(): boolean {
    return this.router.url.includes('/history');
  }

  /**
   * Слухач події скролу вікна.
   * Активує клас 'isScrolled', якщо користувач прокрутив сторінку більше ніж на 40px.
   */
  @HostListener('window:scroll', [])
  onWindowScroll() {
    this.isScrolled = window.scrollY > 39;
  }

  /**
   * Слухач кліків по всій сторінці (Global Document Click).
   * Використовується для реалізації логіки "закриття при кліку поза межами компонента".
   */
  @HostListener('document:click', ['$event'])
  clickout(event: Event) {
    // Перевіряємо, чи клік був виконаний за межами поточного компонента (eRef)
    if (this.isProfileMenuOpen && !this.eRef.nativeElement.contains(event.target)) {
      this.isProfileMenuOpen = false;
    }
  }

  /**
   * Перемикач стану випадаючого меню профілю.
   */
  toggleProfileMenu() {
    this.isProfileMenuOpen = !this.isProfileMenuOpen;
  }

  /**
   * Виконує вихід користувача з системи через AuthService,
   * закриває меню та перенаправляє на головну сторінку або сторінку логіну.
   */
  onLogout() {
    this.authService.logout();
    this.isProfileMenuOpen = false;
    this.router.navigate(['/']);
  }

  /**
   * Перехід на сторінку вимірювання.
   * Якщо користувач ВЖЕ на цій сторінці — робимо примусовий перезапуск компонента.
   */
  public onStartMeasurementClick(event: Event): void {
    event.preventDefault();

    if (this.router.url === '/measurement') {
      this.router.navigateByUrl('/', { skipLocationChange: true }).then(() => {
        this.router.navigate(['/measurement']);
      });
    } else {
      this.router.navigate(['/measurement']);
    }
  }
}
