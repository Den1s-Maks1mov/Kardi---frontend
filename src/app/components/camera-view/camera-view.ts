import {
  Component,
  ElementRef,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
  OnDestroy,
  ChangeDetectorRef,
  inject
} from '@angular/core';
import { interval, Subscription, take } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { QcEngineService } from '../../services/qc-engine.service';

/**
 * CameraViewComponent забезпечує захоплення відеопотоку, аналіз обличчя в реальному часі
 * за допомогою MediaPipe FaceLandmarker та запис відеорезультатів.
 */
@Component({
  selector: 'app-camera-view',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './camera-view.html',
  styleUrls: ['./camera-view.scss']
})
export class CameraViewComponent implements OnInit, OnDestroy {
  // Посилання на DOM-елемент відео для маніпуляцій з потоком
  @ViewChild('videoElement', { static: true }) videoElement!: ElementRef<HTMLVideoElement>;

  // Події для зовнішньої комунікації (батьківським компонентам)
  @Output() warningState = new EventEmitter<boolean>();
  @Output() onPermissionDenied = new EventEmitter<void>();
  @Output() onFinished = new EventEmitter<Blob>();
  @Output() timeTick = new EventEmitter<number>();
  @Output() onCriticalFailure = new EventEmitter<string>();

  // Стан процесу
  isRecording = false;
  isFailed = false;
  errorMessage = '';
  aiWarningMessage: string | null = null;

  // DI сервісів
  private qcEngine = inject(QcEngineService);
  private faceLandmarker!: FaceLandmarker;

  // Контроль кадрів для запобігання надмірній обробці
  private lastVideoTime = -1;

  private timerSubscription?: Subscription;
  private mediaRecorder?: MediaRecorder;
  private recordedChunks: BlobPart[] = [];
  private animationFrameId?: number;

  constructor(private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    await this.initAI();
    this.startCameraPreview();
  }

  /**
   * Завантаження ресурсів MediaPipe та налаштування моделі FaceLandmarker.
   * Використовує GPU делегат для підвищення продуктивності.
   */
  async initAI() {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
      );
      this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "GPU"
        },
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        runningMode: "VIDEO",
        numFaces: 1
      });
    } catch (e) {
      console.error("Помилка ініціалізації ШІ-моделі:", e);
    }
  }

  /**
   * Запит дозволу доступу до камери та ініціалізація відеопотоку.
   */
  async startCameraPreview() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 60 } },
        audio: false
      });
      const video = this.videoElement.nativeElement;
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video.play();
        this.setupAnalysisLoop();
      };
    } catch (err) {
      this.onPermissionDenied.emit();
    }
  }

  /**
   * Ініціює запис відеопотоку та запускає 30-секундний таймер контролю сесії.
   */
  public startRecordingSequence() {
    this.isRecording = true;
    this.isFailed = false;
    this.recordedChunks = [];
    this.qcEngine.reset();

    const video = this.videoElement.nativeElement;
    const rawCameraStream = video.srcObject as MediaStream;

    let options: MediaRecorderOptions = { videoBitsPerSecond: 2500000 };

    // Вибір підтримуваного формату відео (MP4 або WebM)
    if (MediaRecorder.isTypeSupported('video/mp4')) {
      options.mimeType = 'video/mp4';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options.mimeType = 'video/webm';
    }

    this.mediaRecorder = new MediaRecorder(rawCameraStream, options);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0 && !this.isFailed) this.recordedChunks.push(e.data);
    };

    this.mediaRecorder.onstop = () => {
      if (this.isFailed) return;
      const videoBlob = new Blob(this.recordedChunks, { type: options.mimeType });
      this.onFinished.emit(videoBlob);
    };

    this.mediaRecorder.start();

    // Таймер зворотного відліку сесії запису
    this.timerSubscription = interval(1000).pipe(take(31)).subscribe({
      next: (val) => {
        if (!this.isFailed) {
          this.timeTick.emit(30 - val);
        }
      },
      complete: () => {
        if (!this.isFailed) {
          this.isRecording = false;
          this.mediaRecorder?.stop();
        }
      }
    });
  }

  /**
   * Головний цикл аналізу кадрів за допомогою requestAnimationFrame.
   * Виконує детекцію точок обличчя та передає результат у QcEngineService.
   */
  setupAnalysisLoop() {
    const video = this.videoElement.nativeElement;

    const analyzeFrame = () => {
      if (!this.isFailed) {
        // Перевіряємо, чи змінився час кадру, щоб уникнути зайвих обчислень
        if (this.faceLandmarker && video.currentTime !== this.lastVideoTime) {
          this.lastVideoTime = video.currentTime;

          // 1. Отримуємо точки (Landmarks) за допомогою ШІ
          const results = this.faceLandmarker.detectForVideo(video, performance.now());

          // 2. Ядро аналітики повертає результат (попередження або null)
          const warning = this.qcEngine.processFrame(results, video, performance.now());

          // 3. Оновлення UI при зміні стану попередження
          if (this.aiWarningMessage !== warning) {
            this.aiWarningMessage = warning;
            this.warningState.emit(warning !== null);
          }
        }
        this.cdr.detectChanges();
      }
      this.animationFrameId = requestAnimationFrame(analyzeFrame);
    };
    analyzeFrame();
  }

  public resetAndRetry() {
    this.isFailed = false;
    this.errorMessage = '';
    this.qcEngine.reset();
  }

  /**
   * Примусове зупинення запису, таймерів та звільнення ресурсів камери.
   */
  stopCamera() {
    if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
    if (this.timerSubscription) this.timerSubscription.unsubscribe();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') this.mediaRecorder.stop();

    if (this.videoElement && this.videoElement.nativeElement.srcObject) {
      const stream = this.videoElement.nativeElement.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      this.videoElement.nativeElement.srcObject = null;
    }
  }

  ngOnDestroy() {
    this.stopCamera();
    // Вивільнення пам'яті моделі FaceLandmarker
    if (this.faceLandmarker) this.faceLandmarker.close();
  }
}
