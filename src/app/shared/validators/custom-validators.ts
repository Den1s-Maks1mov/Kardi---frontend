import { AbstractControl, ValidationErrors } from '@angular/forms';
/**
 * Кастомна функція крос-польової валідації (Custom Group Validator).
 * Призначається на рівні `FormGroup` для перевірки еквівалентності значень у полях пароля та його підтвердження.
 */
export function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value;
  const confirmPasswordControl = group.get('confirmPassword');

  // Якщо хоча б одне з полів порожнє, не перевіряємо на збіг (щоб не сваритись завчасно)
  if (!password || !confirmPasswordControl?.value) {
    return null;
  }

  // Якщо паролі не збігаються
  if (password !== confirmPasswordControl.value) {
    // Встановлюємо помилку безпосередньо на контрол confirmPassword
    confirmPasswordControl.setErrors({ ...confirmPasswordControl.errors, passwordMismatch: true });
    return { passwordMismatch: true }; // Повертаємо помилку для всієї форми
  } else {
    // Якщо паролі збігаються, знімаємо помилку mismatch з контролу
    if (confirmPasswordControl.hasError('passwordMismatch')) {
      const errors = { ...confirmPasswordControl.errors };
      delete errors['passwordMismatch'];
      // Оновлюємо помилки: якщо залишилися інші (наприклад, required), залишаємо їх, інакше null
      confirmPasswordControl.setErrors(Object.keys(errors).length ? errors : null);
    }
    return null;
  }
}

export function complexPasswordValidator(control: AbstractControl): ValidationErrors | null {
  const value = control.value;

  // Якщо поле порожнє, не перевіряємо (для цього є Validators.required)
  if (!value) {
    return null;
  }

  const hasUpperCase = /[A-Z]/.test(value);
  const hasLowerCase = /[a-z]/.test(value);
  const hasNumeric = /[0-9]/.test(value);
  const isLengthValid = value.length >= 8;

  const passwordValid = hasUpperCase && hasLowerCase && hasNumeric && isLengthValid;

  // Якщо пароль не відповідає вимогам, повертаємо об'єкт з деталями помилки
  if (!passwordValid) {
    return {
      passwordStrength: {
        hasUpperCase,
        hasLowerCase,
        hasNumeric,
        isLengthValid
      }
    };
  }

  // Якщо все добре, повертаємо null (помилок немає)
  return null;
}
