import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RevealDirective } from '../../shared/directives/reveal';
import { AuthService } from '../../services/auth.service';
import { complexPasswordValidator } from '../../shared/validators/custom-validators';

/**
 * LoginComponent реалізує логіку входу користувача.
 * Використовує Reactive Forms для керування валідацією полів та станом форми.
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, RevealDirective],
  templateUrl: './login.html',
  styleUrls: ['./login.scss']
})
export class LoginComponent implements OnInit {
  // Сучасне впровадження залежностей (DI)
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  /** Екземпляр реактивної форми (FormGroup) */
  public loginForm: FormGroup;

  // Стани для UI: обробка помилок та індикатор завантаження
  public errorMessage: string | null = null;
  public isLoading = false;

  constructor() {
    // Ініціалізація структури форми та визначення валідаторів
    this.loginForm = this.fb.group({
      login: ['', [Validators.required]],
      password: ['', [Validators.required, complexPasswordValidator]]
    });
  }

  ngOnInit(): void {
    // Спостереження за змінами форми для скидання повідомлень про помилки
    this.loginForm.valueChanges.subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
        this.cdr.detectChanges();
      }
    });
  }

  /**
   * Обробник події відправки форми.
   * Валідує введені дані та ініціює запит до сервісу аутентифікації.
   */
  public onSubmit(): void {
    if (this.loginForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;

      const { login, password } = this.loginForm.value;

      this.authService.login({ login, password }).subscribe({
        next: (response) => {
          this.isLoading = false;
          // Перенаправлення на головну сторінку після успішної авторизації
          this.router.navigate(['/']);
        },
        error: (error) => {
          this.isLoading = false;

          // Обробка помилок сервера (401 - Unauthorized, 400 - Bad Request, 404 - Not Found)
          if (error.status === 401 || error.status === 400 || error.status === 404) {
            this.errorMessage = 'Невірний логін або пароль.';
          } else {
            this.errorMessage = 'Виникла помилка під час авторизації. Спробуйте пізніше.';
          }

          // Примусове оновлення UI, щоб відобразити статус помилки
          this.cdr.detectChanges();
        }
      });
    } else {
      // Підсвічування всіх полів як "торкнутих", щоб показати валідаційні помилки
      this.loginForm.markAllAsTouched();
    }
  }
}
