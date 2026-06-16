import { Component, Input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { RouterLink } from '@angular/router';
import { DatasetSummary } from '../../services/data.service';

@Component({
  selector: 'app-dataset-card',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatChipsModule, RouterLink],
  template: `
    <mat-card class="dataset-card"
      [class.coming-soon]="dataset.status === 'coming-soon'"
      [routerLink]="dataset.status !== 'coming-soon' ? ['/country', country, 'datasets', dataset.id] : null">

      <mat-card-header>
        <mat-icon mat-card-avatar class="card-icon">{{ dataset.icon }}</mat-icon>
        <mat-card-title>{{ dataset.shortName }}</mat-card-title>
        <mat-card-subtitle>{{ dataset.name }}</mat-card-subtitle>
      </mat-card-header>

      <mat-card-content>
        @if (dataset.status === 'coming-soon') {
          <div class="coming-soon-label">Coming Soon</div>
        } @else {
          <div class="metric-row">
            <span class="metric-label">Latest ({{ dataset.latestPeriod }})</span>
            <span class="metric-value" [class]="getTrendClass(dataset.latestGrowth)">
              {{ formatGrowth(dataset.latestGrowth) }}
              <mat-icon class="trend-icon">{{ getTrendIcon(dataset.latestGrowth) }}</mat-icon>
            </span>
          </div>
          <!-- @if (dataset.cumulativeGrowth !== undefined) {
            <div class="metric-row">
              <span class="metric-label">Cumulative ({{ dataset.cumulativePeriod }})</span>
              <span class="metric-value" [class]="getTrendClass(dataset.cumulativeGrowth)">
                {{ formatGrowth(dataset.cumulativeGrowth) }}
              </span>
            </div>
          } -->
          <!-- @if (dataset.status === 'provisional') {
            <mat-chip-set class="status-chips">
              <mat-chip class="provisional-chip" highlighted>Provisional</mat-chip>
            </mat-chip-set>
          } -->
        }
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .dataset-card {
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      height: 100%;
    }
    .dataset-card:hover:not(.coming-soon) {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    }
    .coming-soon {
      opacity: 0.5;
      cursor: default;
    }
    .card-icon {
      font-size: 28px;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
    }
    .metric-label {
      font-size: 0.85rem;
      opacity: 0.7;
    }
    .metric-value {
      font-size: 1.1rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .trend-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .coming-soon-label {
      text-align: center;
      padding: 24px 0;
      opacity: 0.6;
      font-style: italic;
    }
    .status-chips {
      margin-top: 12px;
    }
  `]
})
export class DatasetCardComponent {
  @Input({ required: true }) dataset!: DatasetSummary;
  @Input({ required: true }) country!: string;

  getTrendClass(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    if (value > 0) return 'trend-up';
    if (value < 0) return 'trend-down';
    return 'trend-flat';
  }

  getTrendIcon(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    if (value > 0) return 'trending_up';
    if (value < 0) return 'trending_down';
    return 'trending_flat';
  }

  formatGrowth(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}%`;
  }
}
