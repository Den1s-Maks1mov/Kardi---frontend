import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../shared/environments/environment';

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/auth`;

  private readonly TOKEN_KEY = 'kardi_access_token';
  // 1. Додаємо новий ключ для збереження імені користувача
  private readonly LOGIN_KEY = 'kardi_current_login';

  /**
   * Реєстрація нового користувача
   */
  register(credentials: any): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.apiUrl}/register`, credentials);
  }

  /**
   * Авторизація
   */
  login(credentials: any): Observable<TokenResponse> {
    const body = new URLSearchParams();
    body.set('username', credentials.login);
    body.set('password', credentials.password);

    const headers = new HttpHeaders({
      'Content-Type': 'application/x-www-form-urlencoded'
    });

    return this.http.post<TokenResponse>(`${this.apiUrl}/login`, body.toString(), { headers }).pipe(
      tap(response => {
        this.saveToken(response.access_token);
        // Зберігаємо логін тільки якщо ми в браузері
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem(this.LOGIN_KEY, credentials.login);
        }
      })
    );
  }

  /**
   * Вихід з аккаунту
   */
  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    // 3. Очищаємо логін під час виходу
    localStorage.removeItem(this.LOGIN_KEY);
  }

  /**
   * Отримання токена
   */
  getToken(): string | null {
    // Безпечне звернення до localStorage
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /**
   * Перевірка чи користувач авторизований
   */
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  /**
   * 4. Геттер для отримання логіну користувача (використовується в header.html)
   */
  get currentLogin(): string | null {
    // Безпечне звернення до localStorage
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(this.LOGIN_KEY);
    }
    return null;
  }

  private saveToken(token: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }
}
