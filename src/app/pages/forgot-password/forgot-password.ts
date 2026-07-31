import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RevealDirective } from '../../shared/directives/reveal';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  // ReactiveFormsModule імпортується для підтримки інфраструктури декларативного зв'язування форм [formGroup] та formControlName
  imports: [CommonModule, RouterModule, ReactiveFormsModule, RevealDirective],
  templateUrl: './forgot-password.html',
  styleUrls: ['./forgot-password.scss']
})
export class ForgotPasswordComponent {
  /** Головний екземпляр керування станом і структурою форми (Form Object Model) */
  forgotPasswordForm: FormGroup;

  constructor(private fb: FormBuilder) {
    // Декларативна ініціалізація дерева елементів форми (Form Tree Control) за допомогою сервісу FormBuilder
    this.forgotPasswordForm = this.fb.group({
      // Конфігурація єдиного поля введення із застосуванням композиції синхронних валідаторів (Required та Email RegExp)
      email: ['', [Validators.required, Validators.email]]
    });
  }

  /**
   * Обробник події відправки форми (Form Submission Lifecycle Hook).
   * Виконує перевірку цілісності та валідності даних перед ініціалізацією HTTP-мутацій.
   */
  public onSubmit(): void {
    if (this.forgotPasswordForm.valid) {
      console.log('Запит на відновлення паролю для:', this.forgotPasswordForm.value.email);
      // Наступним кроком тут ініціалізується пайплайн відправки форми на API Gateway (Auth Service Payload)
    } else {
      /**
       * Механізм примусового оновлення стану UI.
       * Маркує всі наявні AbstractControls як `touched`. Це тригерить цикл перевірки змін Angular,
       * змушуючи кастомні селектори або CSS-правила (`.is-invalid`) негайно відобразити помилки валідації.
       */
      this.forgotPasswordForm.markAllAsTouched();
    }
  }
}
