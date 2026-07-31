import { Component, inject, OnInit, ChangeDetectorRef } from '@angular/core'; // 1. Додано імпорт ChangeDetectorRef
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RevealDirective } from '../../shared/directives/reveal';
import { passwordMatchValidator, complexPasswordValidator } from '../../shared/validators/custom-validators';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule, RevealDirective],
  templateUrl: './register.html',
  styleUrls: ['./register.scss']
})
export class RegisterComponent implements OnInit {
  public registerForm: FormGroup;
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef); // 2. Впроваджуємо сервіс ChangeDetectorRef

  public errorMessage: string | null = null;
  public successMessage: string | null = null;
  public isLoading = false;

  constructor() {
    this.registerForm = this.fb.group({
      login: ['', [Validators.required]],
      password: ['', [Validators.required, complexPasswordValidator]],
      confirmPassword: ['', [Validators.required]],
      termsAccepted: [false, Validators.requiredTrue]
    }, {
      validators: passwordMatchValidator
    });
  }

  ngOnInit(): void {
    this.registerForm.valueChanges.subscribe(() => {
      if (this.errorMessage) {
        this.errorMessage = null;
        this.cdr.detectChanges(); // Синхронізуємо UI при очищенні помилки
      }
    });
  }

  public onSubmit(): void {
    if (this.registerForm.valid) {
      this.isLoading = true;
      this.errorMessage = null;
      this.successMessage = null;
      const { login, password } = this.registerForm.value;

      this.authService.register({ login, password }).subscribe({
        next: (response) => {
          this.authService.login({ login, password }).subscribe({
            next: (loginResponse) => {
              this.isLoading = false;
              this.successMessage = 'Успішно! Перенаправляємо на головну...';
              this.cdr.detectChanges(); // Оновлюємо UI для відображення повідомлення успіху

              setTimeout(() => {
                this.router.navigate(['/']);
              }, 1500);
            },
            error: (loginError) => {
              this.isLoading = false;
              this.errorMessage = 'Аккаунт створено, але не вдалося увійти автоматично.';
              this.cdr.detectChanges(); // Оновлюємо UI у разі помилки автосейву

              setTimeout(() => {
                this.router.navigate(['/login']);
              }, 2000);
            }
          });
        },
        error: (error) => {
          this.isLoading = false;

          // 3. Обробка сценарію відсутності відповіді від сервера (status 0)
          if (error.status === 0) {
            this.errorMessage = 'Сервер не відповідає. Перевірте з’єднання з інтернетом або спробуйте пізніше.';
          } else if (error.status === 400) {
            this.registerForm.get('login')?.setErrors({ loginTaken: true });
            this.errorMessage = error.error?.detail || 'Користувач із таким логіном вже існує.';
          } else {
            this.errorMessage = error.error?.detail || 'Виникла помилка під час реєстрації.';
          }

          this.cdr.detectChanges(); // 4. Примусово оновлюємо DOM у Zoneless середовищі
        }
      });
    } else {
      this.registerForm.markAllAsTouched();
    }
  }
}
