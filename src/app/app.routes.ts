import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home';
import { HistoryComponent } from './pages/history/history';
import { LoginComponent } from './pages/login/login';
import { RegisterComponent } from './pages/register/register';
import { ForgotPasswordComponent } from './pages/forgot-password/forgot-password';
import { MeasurementComponent } from './pages/measurement/measurement';
import { ErrorPageComponent } from './pages/error-page/error-page';
import { authGuard } from './shared/guards/auth.guard'; // Імпортуємо наш Guard
/**
 * Головний декларативний конфігураційний масив маршрутів застосунку (Application Routing Table).
 * Визначає відповідність між поточним URL-шляхом (URI) у браузері та відповідним Angular-компонентом,
 * який Router Outlet повинен монтувати/демонтувати в DOM-дерево.
 */
export const routes: Routes = [

  // ==========================================================================
  // 1. ПУБЛІЧНІ МАРШРУТИ З СИСТЕМНИМ ЛЕЙАУТОМ (Header / Footer Included)
  // ==========================================================================

  /** Головна сторінка (Root Path). Обробляє базовий (пустий) URL-адрес */
  {
    path: '',
    component: HomeComponent
  },

  /** Сторінка персонального журналу та історії rPPG-вимірювань користувача */
  {
    path: 'history',
    component: HistoryComponent,
    canActivate: [authGuard]
  },

  /** Екран інтерактивного інтерфейсу rPPG-сканування та роботи з ШІ-камерою */
  {
    path: 'measurement',
    component: MeasurementComponent
  },

  // ==========================================================================
  // 2. АВТЕНТИФІКАЦІЙНІ МАРШРУТИ З ІЗОЛЬОВАНИМ ЛЕЙАУТОМ (Fullscreen Forms)
  // ==========================================================================

  /** * Сторінка входу до системи (Автентифікація).
   * * Патерн передачі статичних метаданих (`data` property): об'єкт `data: { hideLayout: true }`
   * зчитується кореневим `AppComponent` через підписку на `Router Events` або `ActivatedRoute`
   * для динамічного приховування глобальних елементів інтерфейсу (шапки сайту, футера, бокових панелей).
   */
  {
    path: 'login',
    component: LoginComponent,
    data: { hideLayout: true }
  },

  /** Сторінка створення нового облікового запису (Реєстрація) */
  {
    path: 'register',
    component: RegisterComponent,
    data: { hideLayout: true }
  },

  /** Сторінка ініціалізації процедури скидання облікових даних та відновлення доступу */
  {
    path: 'forgot-password',
    component: ForgotPasswordComponent,
    data: { hideLayout: true }
  },

  // ==========================================================================
  // 3. СИСТЕМНІ ТА ЗАХИСНІ МАРШРУТИ (Fallback / Guard Rails)
  // ==========================================================================

  /**
   * Універсальний підстановочний маршрут перехоплення помилок (Wildcard Route / Catch-All Handler).
   * * Перехоплює будь-які некоректні, неіснуючі або зламані URI, введені користувачем,
   * та монтує натомість ізольовану сторінку помилки 404 (`ErrorPageComponent`).
   */
  {
    path: '**',
    component: ErrorPageComponent
  }
];
