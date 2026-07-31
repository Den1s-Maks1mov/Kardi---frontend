import { Injectable } from '@angular/core';
import { FaceLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';
import { QC_CONFIG, FACE_LANDMARKS } from '../config/qc.config';

interface FrameQC {
  timestamp: number;
  faceNotFound: boolean;
  faceTooSmall: boolean;
  faceTurned: boolean;
  talking: boolean;
  excessiveMotion: boolean;
  faceNotCentered: boolean;

  overexposed: boolean;
  lowLight: boolean;
  backlit: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class QcEngineService {
  private history: FrameQC[] = [];
  private prevSmoothedHead: { x: number, y: number } | null = null;

  // Віртуальний канвас для швидкого читання пікселів без втручання в UI
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;

  constructor() {
    // Ініціалізуємо віртуальний канвас при створенні сервісу
    this.offscreenCanvas = typeof document !== 'undefined' ? document.createElement('canvas') : {} as HTMLCanvasElement;
    this.offscreenCtx = this.offscreenCanvas.getContext?.('2d', { willReadFrequently: true }) as CanvasRenderingContext2D;
  }

  /**
   * Головний метод аналізу. Тепер приймає сам video елемент для доступу до пікселів.
   */
  public processFrame(results: FaceLandmarkerResult, video: HTMLVideoElement, timestamp: number): string | null {
    // 1. Геометрія
    const frameQc = this.analyzeGeometry(results, timestamp, video.videoWidth, video.videoHeight);

    // 2. Світло (тільки якщо знайдено обличчя)
    if (!frameQc.faceNotFound) {
      this.analyzeLight(results.faceLandmarks[0], video, frameQc);
    }

    // 3. Зберігаємо в історію
    this.history.push(frameQc);

    // 4. Очищення старих кадрів
    const fiveSecondsAgo = timestamp - (QC_CONFIG.motionWindow.seconds * 1000);
    this.history = this.history.filter(f => f.timestamp >= fiveSecondsAgo);

    // 5. Отримання пріоритетного результату
    return this.getPriorityWarning(timestamp);
  }

  /**
   * МАТЕМАТИКА ГЕОМЕТРІЇ ТА РУХУ
   */
  private analyzeGeometry(results: FaceLandmarkerResult, timestamp: number, w: number, h: number): FrameQC {
    const qc: FrameQC = {
      timestamp, faceNotFound: true, faceTooSmall: false, faceTurned: false,
      talking: false, excessiveMotion: false, overexposed: false, lowLight: false, backlit: false,
      faceNotCentered: false // Ініціалізація
    };

    if (!results.faceLandmarks || results.faceLandmarks.length === 0) {
      this.prevSmoothedHead = null;
      return qc;
    }

    qc.faceNotFound = false;
    const landmarks = results.faceLandmarks[0];

    // Розраховуємо межі обличчя
    let minX = 1, minY = 1, maxX = 0, maxY = 0;
    for (const lm of landmarks) {
      if (lm.x < minX) minX = lm.x;
      if (lm.x > maxX) maxX = lm.x;
      if (lm.y < minY) minY = lm.y;
      if (lm.y > maxY) maxY = lm.y;
    }

    if ((maxX - minX) * (maxY - minY) < QC_CONFIG.face.minAreaRatio) qc.faceTooSmall = true;

    // Знаходимо центр обличчя (значення від 0.0 до 1.0)
    const faceCenterX = (minX + maxX) / 2;
    const faceCenterY = (minY + maxY) / 2;

    // Задаємо "безпечну зону" (наприклад, центр обличчя має бути між 35% і 65% ширини екрану)
    const isCenteredX = faceCenterX > 0.35 && faceCenterX < 0.65;
    const isCenteredY = faceCenterY > 0.30 && faceCenterY < 0.70;

    if (!isCenteredX || !isCenteredY) {
      qc.faceNotCentered = true;
    }
    // Поворот та нахил голови (Yaw, Pitch, Roll)
    if (results.facialTransformationMatrixes?.length) {
      const m = results.facialTransformationMatrixes[0].data;

      // Витягуємо всі три кути в радіанах
      const yawRads = Math.atan2(m[8], m[10]);
      const pitchRads = Math.atan2(-m[9], Math.sqrt(m[8] ** 2 + m[10] ** 2));
      const rollRads = Math.atan2(m[4], m[5]);

      // Переводимо у градуси
      const yawDeg = yawRads * (180 / Math.PI);
      const pitchDeg = pitchRads * (180 / Math.PI);
      const rollDeg = rollRads * (180 / Math.PI);

      // Якщо хоча б один з кутів (вліво-вправо, вгору-вниз, до плеча) перевищує ліміт
      if (Math.abs(yawDeg) > QC_CONFIG.face.yawDeg ||
        Math.abs(pitchDeg) > QC_CONFIG.face.yawDeg ||
        Math.abs(rollDeg) > QC_CONFIG.face.yawDeg) {
        qc.faceTurned = true;
      }
    }

    // Розмова
    if (results.faceBlendshapes?.length) {
      const jawOpen = results.faceBlendshapes[0].categories.find(c => c.categoryName === 'jawOpen')?.score || 0;
      if (jawOpen > QC_CONFIG.motion.jawOpen) qc.talking = true;
    }

    // Рух голови
    const iodPx = Math.abs(landmarks[263].x - landmarks[33].x) * w;
    let sumX = 0, sumY = 0;
    for (const idx of FACE_LANDMARKS.motionForehead) {
      sumX += landmarks[idx].x * w; sumY += landmarks[idx].y * h;
    }
    const headX = sumX / FACE_LANDMARKS.motionForehead.length;
    const headY = sumY / FACE_LANDMARKS.motionForehead.length;

    if (!this.prevSmoothedHead) {
      this.prevSmoothedHead = { x: headX, y: headY };
    } else {
      const a = QC_CONFIG.motion.smoothingAlpha;
      const sx = a * headX + (1 - a) * this.prevSmoothedHead.x;
      const sy = a * headY + (1 - a) * this.prevSmoothedHead.y;
      const dispPx = Math.sqrt((sx - this.prevSmoothedHead.x)**2 + (sy - this.prevSmoothedHead.y)**2);

      if (dispPx / iodPx > QC_CONFIG.motion.headDispNorm) qc.excessiveMotion = true;
      this.prevSmoothedHead = { x: sx, y: sy };
    }

    return qc;
  }

  /**
   * МАТЕМАТИКА СВІТЛА (Аналіз пікселів кадру)
   */
  private analyzeLight(landmarks: NormalizedLandmark[], video: HTMLVideoElement, qc: FrameQC): void {
    if (!this.offscreenCtx) return;

    // Формула перетворення RGB у яскравість (Luma Rec.601)
    const getLuma = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

    // --- 1. Аналіз сцени (Фон) ---
    this.offscreenCanvas.width = 64;
    this.offscreenCanvas.height = 64;
    this.offscreenCtx.drawImage(video, 0, 0, 64, 64);
    const sceneData = this.offscreenCtx.getImageData(0, 0, 64, 64).data;

    let sceneLumaSum = 0;
    for (let i = 0; i < sceneData.length; i += 4) {
      sceneLumaSum += getLuma(sceneData[i], sceneData[i+1], sceneData[i+2]);
    }
    const yScene = sceneLumaSum / (64 * 64);

    // --- 2. Аналіз обличчя та пересвіту ---
    const scale = 0.25;
    const w = Math.floor(video.videoWidth * scale);
    const h = Math.floor(video.videoHeight * scale);
    this.offscreenCanvas.width = w;
    this.offscreenCanvas.height = h;

    this.offscreenCtx.clearRect(0, 0, w, h);
    this.offscreenCtx.beginPath();
    const roiPoints = [...FACE_LANDMARKS.roi.forehead, ...FACE_LANDMARKS.roi.rightCheek, ...FACE_LANDMARKS.roi.leftCheek];

    roiPoints.forEach((idx, i) => {
      const px = landmarks[idx].x * w;
      const py = landmarks[idx].y * h;
      i === 0 ? this.offscreenCtx.moveTo(px, py) : this.offscreenCtx.lineTo(px, py);
    });
    this.offscreenCtx.closePath();

    this.offscreenCtx.save();
    this.offscreenCtx.clip();
    this.offscreenCtx.drawImage(video, 0, 0, w, h);
    this.offscreenCtx.restore();

    const faceData = this.offscreenCtx.getImageData(0, 0, w, h).data;
    let faceLumaSum = 0, facePixels = 0, overexposedG = 0;

    for (let i = 0; i < faceData.length; i += 4) {
      if (faceData[i+3] > 0) {
        faceLumaSum += getLuma(faceData[i], faceData[i+1], faceData[i+2]);
        facePixels++;
        if (faceData[i+1] >= QC_CONFIG.light.clipGreen) overexposedG++;
      }
    }
    const yFace = facePixels > 0 ? faceLumaSum / facePixels : 0;
    const clipGFrac = facePixels > 0 ? overexposedG / facePixels : 0;

    // --- 3. Аналіз Склери (Білків очей) ---
    const getEyeLumas = (indices: number[]) => {
      let minX = w, maxX = 0, minY = h, maxY = 0;
      indices.forEach(idx => {
        const px = landmarks[idx].x * w;
        const py = landmarks[idx].y * h;
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      });

      const ew = Math.ceil(maxX - minX);
      const eh = Math.ceil(maxY - minY);
      if (ew <= 0 || eh <= 0) return [];

      const eyeData = this.offscreenCtx.getImageData(minX, minY, ew, eh).data;
      const lumas: number[] = [];
      for (let i = 0; i < eyeData.length; i += 4) {
        lumas.push(getLuma(eyeData[i], eyeData[i+1], eyeData[i+2]));
      }
      return lumas;
    };

    const lumasLeft = getEyeLumas(FACE_LANDMARKS.sclera.leftEye);
    const lumasRight = getEyeLumas(FACE_LANDMARKS.sclera.rightEye);
    const allScleraLumas = [...lumasLeft, ...lumasRight].sort((a, b) => a - b);

    const p60Index = Math.floor(allScleraLumas.length * (QC_CONFIG.light.scleraPercentile / 100));
    const brightSclera = allScleraLumas.slice(p60Index);
    const ySclera = brightSclera.length ? brightSclera.reduce((a,b) => a+b, 0) / brightSclera.length : 0;

    // --- 4. Логіка визначення проблеми ---
    if (clipGFrac > QC_CONFIG.light.clipFrac) {
      qc.overexposed = true;
    } else if (yScene < QC_CONFIG.light.sceneLow) {
      qc.lowLight = true;
    } else if ((yFace / yScene < QC_CONFIG.light.faceSceneRatio) && (yFace < QC_CONFIG.light.faceDark) && (ySclera < QC_CONFIG.light.scleraLow)) {
      qc.backlit = true;
    } else if (ySclera < QC_CONFIG.light.scleraLow) {
      qc.lowLight = true;
    }
  }

  /**
   * Визначає, яку помилку показати користувачу, базуючись на історії вікон
   */
  private getPriorityWarning(currentTimestamp: number): string | null {
    if (this.history.length === 0) return null;

    const window = this.history.slice(-QC_CONFIG.window.frames);
    const motionWindow = this.history.filter(f => f.timestamp >= currentTimestamp - (QC_CONFIG.motionWindow.seconds * 1000));

    const getRatio = (arr: FrameQC[], key: keyof FrameQC) => arr.filter(f => f[key]).length / arr.length;

    // МЕХАНІЗМ ШВИДКОГО СКИДАННЯ (Quick Release):
    // Перевіряє, чи були останні 750 мілісекунд абсолютно "чистими" від цієї помилки.
    const isRecentlyClean = (key: keyof FrameQC) => {
      const recent = this.history.filter(f => f.timestamp >= currentTimestamp - 750);
      return recent.length > 0 && recent.every(f => !f[key]);
    };

    // Оновлена перевірка: Помилка є, ТІЛЬКИ ЯКЩО перевищено ліміт вікна І користувач не виправився щойно
    const check = (arr: FrameQC[], key: keyof FrameQC, badRatio: number) => {
      return getRatio(arr, key) > badRatio && !isRecentlyClean(key);
    };

    // 1. Рівень "СТОП"
    if (check(window, 'faceNotFound', QC_CONFIG.window.badRatio)) return "Покажіть обличчя";
    if (check(window, 'faceTooSmall', QC_CONFIG.window.badRatio)) return "Сядьте ближче";
    if (check(window, 'faceTurned', QC_CONFIG.window.badRatio))   return "Дивіться в камеру";
    if (check(window, 'overexposed', QC_CONFIG.window.badRatio))  return "Приберіть яскраве світло";
    if (check(window, 'faceNotCentered', QC_CONFIG.window.badRatio)) return "Тримайте обличчя по центру";
    if (check(motionWindow, 'excessiveMotion', QC_CONFIG.motionWindow.badRatio)) return "Не рухайтесь";

    // 2. Рівень "ПІДКАЗКА"
    if (check(window, 'lowLight', QC_CONFIG.window.badRatio)) return "Додайте світла";
    if (check(window, 'backlit', QC_CONFIG.window.badRatio))  return "Поверніться до світла";
    if (check(motionWindow, 'talking', QC_CONFIG.motionWindow.badRatio)) return "Не говоріть під час заміру";

    return null;
  }

  public reset() {
    this.history = [];
    this.prevSmoothedHead = null;
  }
}
