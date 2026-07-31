import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { catchError, throwError } from 'rxjs';

export const authErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Якщо сервер повернув 401 Unauthorized (токен сплив або невалідний)
      if (error.status === 401) {

        // 1. Превентивно очищаємо localStorage (видаляємо токен та нікнейм)
        authService.logout();

        // 2. Миттєво перекидаємо користувача на сторінку авторизації
        router.navigate(['/login']);
      }

      // Пропускаємо помилку далі, щоб компоненти теж знали про неї (якщо потрібно)
      return throwError(() => error);
    })
  );
};
