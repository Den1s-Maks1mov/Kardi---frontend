import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TodayMeasurementComponent } from '../../components/today-measurement/today-measurement';
import { WeeklyStatsComponent } from '../../components/weekly-stats/weekly-stats';
import { HistoryListComponent } from '../../components/history-list/history-list';
import { RevealDirective } from '../../shared/directives/reveal';


@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, TodayMeasurementComponent, WeeklyStatsComponent, HistoryListComponent, RevealDirective],
  templateUrl: './history.html',
  styleUrls: ['./history.scss']
})
export class HistoryComponent {
}
