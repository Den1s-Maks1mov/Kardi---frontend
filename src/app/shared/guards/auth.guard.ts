import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Впроваджуємо токен для перевірки платформи (сервер чи браузер)
  const platformId = inject(PLATFORM_ID);

  // 1. Якщо ми на сервері (SSR), ми не маємо доступу до localStorage.
  // Тому ми просто дозволяємо маршрутизацію (true), щоб не зламати початкове завантаження.
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  // 2. Якщо ми в браузері, перевіряємо реальну наявність токена
  if (authService.isLoggedIn()) {
    return true;
  }

  // 3. Якщо ми в браузері і токена немає — кидаємо на логін
  router.navigate(['/login']);
  return false;
};
