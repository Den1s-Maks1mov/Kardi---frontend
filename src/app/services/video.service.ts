import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../shared/environments/environment';

// Точний опис вкладеного об'єкта data
export interface VideoResultData {
  bpm: number;
  signal_quality: number;
  processing_time_ms: number;
  request_id: string;
  fps?: number;
}

// Точний опис головної відповіді від FastAPI
export interface VideoProcessResponse {
  status: string;
  message: string;
  data: VideoResultData;
}

@Injectable({
  providedIn: 'root'
})
export class VideoService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/video`;

  /**
   * Відправка відео на сервер для аналізу ШІ.
   */
  processVideo(videoBlob: Blob): Observable<VideoProcessResponse> {
    const formData = new FormData();
    formData.append('file', videoBlob, 'measurement.webm');

    return this.http.post<VideoProcessResponse>(`${this.apiUrl}/process`, formData);
  }
}
