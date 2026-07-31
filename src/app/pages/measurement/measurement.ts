import { Component, ViewChild, ChangeDetectorRef, inject, NgZone, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { CameraViewComponent } from '../../components/camera-view/camera-view';
import { InstructionSlider } from '../../components/instruction-slider/instruction-slider';
import { ResultScreenComponent } from '../../components/result-screen/result-screen';
import { RevealDirective } from '../../shared/directives/reveal';
import { VideoService } from '../../services/video.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { AuthService } from '../../services/auth.service';
import { HistoryRecord } from '../../components/history-list/history-list';
import { WeeklyStatsData } from '../../components/weekly-stats/weekly-stats';

/**
 * MeasurementComponent керує життєвим циклом вимірювання пульсу:
 * 1. Запит доступу до камери (або автоматичний пропуск, якщо дозвіл є).
 * 2. rPPG-сканування (запис відео).
 * 3. Відправка даних на сервер та відображення результатів.
 */
@Component({
  selector: 'app-measure',
  standalone: true,
  imports: [CommonModule, RouterModule, CameraViewComponent, RevealDirective, InstructionSlider, ResultScreenComponent],
  templateUrl: './measurement.html',
  styleUrls: ['./measurement.scss']
})
export class MeasurementComponent implements OnInit {
  @ViewChild('cameraApp') cameraComponent!: CameraViewComponent;
  private cdr = inject(ChangeDetectorRef);
  private videoService = inject(VideoService);
  private ngZone = inject(NgZone);

  private pdfService = inject(PdfExportService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  // Стан процесу
  finalBpm: number | "error" = 118;
  currentStep: number = 1; // Поточний крок біометричного пайплайну
  cameraAccessGranted: boolean = false;
  showDeniedModal: boolean = false;

  // Реактивні параметри для Етапу 2 (сканування)
  isRecording = false;
  isLoading = false;
  currentTimer = 30;
  showError: string | null = null;
  hasActiveWarning = false;

  constructor() {}

  ngOnInit() {
    this.checkCameraPermission();
  }

  /**
   * Метод перевіряє, чи користувач вже давав дозвіл на використання камери раніше.
   * Якщо так — автоматично перекидає на крок 2.
   */
  private async checkCameraPermission() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const permissionStatus = await navigator.permissions.query({ name: 'camera' as any });

      if (permissionStatus.state === 'granted') {
        this.cameraAccessGranted = true;
        this.currentStep = 2;
        this.cdr.detectChanges();
      }

      // Відстеження зміни дозволу в реальному часі
      permissionStatus.onchange = () => {
        if (permissionStatus.state !== 'granted' && this.currentStep === 2) {
          this.cameraAccessGranted = false;
          this.currentStep = 1;
          this.cdr.detectChanges();
        }
      };

    } catch (error) {
      console.warn('navigator.permissions API не підтримується у цьому браузері.');
    }
  }

  /**
   * Асинхронний запит дозволу доступу до медіа-пристроїв (викликається вручну кнопкою).
   */
  async requestCameraAccess() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Закриваємо потік одразу після перевірки, оскільки CameraViewComponent ініціалізує власний
      stream.getTracks().forEach(track => track.stop());

      this.showDeniedModal = false;
      this.cameraAccessGranted = true;
      this.currentStep = 2;

      this.cdr.detectChanges();
    } catch (err: any) {
      this.showDeniedModal = true;
      this.cameraAccessGranted = false;
      this.currentStep = 1;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        alert('Доступ до камери заблоковано. Перевірте налаштування браузера.');
      }
      this.cdr.detectChanges();
    }
  }

  denyAccess() {
    this.showDeniedModal = true;
    this.cameraAccessGranted = false;
  }

  onCameraPermissionDenied() {
    this.denyAccess();
  }

  /**
   * Запуск процесу запису через дочірній компонент.
   */
  startMeasurement() {
    this.isRecording = true;
    this.showError = null;
    this.cameraComponent.startRecordingSequence();
  }

  updateTimer(timeLeft: number) {
    this.currentTimer = timeLeft;
  }

  onWarningStateChange(isWarning: boolean) {
    this.hasActiveWarning = isWarning;
  }

  onCriticalFailure(reason: string) {
    this.isRecording = false;
    this.currentTimer = 30;
    this.showError = reason;
    this.hasActiveWarning = false;
  }

  /**
   * Обробка завершеного запису: відправка Blob на бекенд та перехід до результатів.
   */
  onRecordingFinished(videoBlob: Blob) {
    this.ngZone.run(() => {
      this.isRecording = false;
      this.isLoading = true;
      this.cdr.detectChanges();
    });

    this.videoService.processVideo(videoBlob).subscribe({
      next: (response) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.finalBpm = Math.round(response.data.bpm);
          this.currentStep = 3;
          this.cdr.detectChanges();
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          this.isLoading = false;
          this.finalBpm = 'error';
          this.currentStep = 3;
          this.cdr.detectChanges();
          console.error('Помилка обробки відео:', error);
        });
      }
    });
  }

  /**
   * Скидання стану для повторної спроби (retry).
   */
  resetToSlider() {
    this.showError = null;
    this.hasActiveWarning = false;
    this.cameraComponent.resetAndRetry();
  }

  /**
   * Повне скидання стейт-машини компонента.
   */
  resetProcess() {
    this.currentStep = 1;
    this.cameraAccessGranted = false;
    this.showDeniedModal = false;
    this.isRecording = false;
    this.currentTimer = 30;
    this.showError = null;
  }

  goToHome() { /* Логіка навігації */ }

  public async saveData() {
    // 1. Запобіжник на випадок помилки вимірювання
    if (this.finalBpm === 'error' || this.finalBpm === null) return;

    const bpm = this.finalBpm as number;
    const now = new Date();

    // 2. Форматуємо час для PDF (додаємо нулі спереду, наприклад "09:05")
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');

    // 3. Створюємо штучний масив з одним записом (як цього очікує сервіс)
    const singleRecord: HistoryRecord = {
      id: now.getTime(), // Звідси PDF-сервіс візьме точну дату
      dayOfWeek: 'Сьогодні',
      time: `${hours}:${minutes}`,
      bpm: bpm
    };

    // 4. Оскільки це лише один запис, статистика нам не потрібна (передаємо пусті значення)
    const emptyStats: WeeklyStatsData = { min: null, avg: null, max: null };

    // 5. Отримуємо логін користувача (або 'Гість', якщо вимірювання робить неавторизований юзер)
    const userName = this.authService.currentLogin || 'Гість';

    try {
      // 6. Запускаємо генерацію PDF
      await this.pdfService.generateReport([singleRecord], emptyStats, userName);
    } catch (error) {
      console.error('Помилка при генерації PDF-звіту:', error);
    }
  }
}
