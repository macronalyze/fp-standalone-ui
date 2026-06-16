import { Component, Input, computed, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DatasetDetail, MonthlyEntry } from '../../../services/data.service';
import { ThemeService } from '../../../services/theme.service';
import { EightCoreIndustriesDataService } from './eight-core-industries-data.service';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { DecimalPipe } from '@angular/common';

@Component({
  selector: 'app-eight-core-industries',
  standalone: true,
  imports: [
    MatCardModule, MatIconModule, MatButtonModule, MatTableModule,
    MatTabsModule, MatChipsModule, MatProgressSpinnerModule,
    MatButtonToggleModule, NgChartsModule, RouterLink, DecimalPipe,
  ],
  template: `
    <div class="page-container">
      @if (loading()) {
        <div class="loading"><mat-spinner diameter="48"></mat-spinner></div>
      } @else if (detail()) {

        <!-- ===== TOP HALF ===== -->
        <section class="top-half">
          <!-- Breadcrumb -->
          <div class="breadcrumb">
            <a [routerLink]="['/country', detail()!.country, 'datasets']" class="back-link">
              <mat-icon>arrow_back</mat-icon> {{ formatCountryName(detail()!.country) }} Datasets
            </a>
            <span class="crumb-sep">/</span>
            <span>{{ detail()!.shortName }}</span>
          </div>

          <!-- Header -->
          <div class="detail-header">
            <div>
              <h2>{{ detail()!.name }}</h2>
              <p class="meta">Base Year: {{ detail()!.baseYear }} = {{ detail()!.baseValue }} &middot; Source: {{ detail()!.source }}</p>
              <p class="meta">Released: {{ detail()!.releaseDate }} &middot; Next: {{ detail()!.nextRelease }}</p>
            </div>
            <div class="headline">
              <span class="headline-value" [class]="getOverallTrendClass()">
                {{ formatGrowth(latestOverallGrowth()) }}
              </span>
              <span class="headline-label">{{ latestEntry()?.label }} (Overall)</span>
            </div>
          </div>

          <!-- Sector Breakdown (always visible) -->
          <div class="charts-row">
            <mat-card class="sector-weights-card">
              <mat-card-header>
                <mat-card-title>Sector Weights</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <canvas baseChart
                  [data]="weightChartData()"
                  [options]="doughnutOptions()"
                  [type]="'doughnut'">
                </canvas>
              </mat-card-content>
            </mat-card>

            <mat-card class="sector-growth-card">
              <mat-card-header>
                <mat-card-title>Latest YoY Growth by Sector ({{ latestEntry()?.label }})</mat-card-title>
              </mat-card-header>
              <mat-card-content>
                <canvas baseChart
                  [data]="sectorGrowthChartData()"
                  [options]="sectorGrowthOptions()"
                  [type]="'bar'">
                </canvas>
              </mat-card-content>
            </mat-card>
          </div>
        </section>

        <!-- ===== BOTTOM HALF ===== -->
        <section class="bottom-half">
          <mat-tab-group animationDuration="200ms">

            <!-- Overall Trend Tab -->
            <mat-tab label="Overall Trend">
              <div class="chart-container">
                <mat-card>
                  <mat-card-header>
                    <mat-card-title>Monthly Index & Growth Rate</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <canvas baseChart
                      [data]="overallChartData()"
                      [options]="comboChartOptions()"
                      [type]="'bar'">
                    </canvas>
                  </mat-card-content>
                </mat-card>
              </div>
            </mat-tab>

            <!-- Yearly Trend Tab -->
            <mat-tab label="Yearly Trend">
              <div class="chart-container">
                <mat-card>
                  <mat-card-header>
                    <mat-card-title>Yearly Overall Growth Rate</mat-card-title>
                  </mat-card-header>
                  <mat-card-content>
                    <canvas baseChart
                      [data]="yearlyChartData()"
                      [options]="yearlyChartOptions()"
                      [type]="'bar'">
                    </canvas>
                  </mat-card-content>
                </mat-card>
              </div>
            </mat-tab>

            <!-- Monthly Data Tab (table + chart toggle) -->
            <mat-tab label="Monthly Data">
              <div class="monthly-tab-header">
                <mat-button-toggle-group [value]="monthlyView()" (change)="monthlyView.set($event.value)" hideSingleSelectionIndicator>
                  <mat-button-toggle value="table">
                    <mat-icon>table_chart</mat-icon> Table
                  </mat-button-toggle>
                  <mat-button-toggle value="chart">
                    <mat-icon>show_chart</mat-icon> Chart
                  </mat-button-toggle>
                </mat-button-toggle-group>
              </div>

              @if (monthlyView() === 'table') {
                <div class="table-container">
                  <table mat-table [dataSource]="monthlyReversed()" class="data-table">
                    <ng-container matColumnDef="period">
                      <th mat-header-cell *matHeaderCellDef>Period</th>
                      <td mat-cell *matCellDef="let row">
                        {{ row.label }}
                        @if (row.provisional) { <mat-chip class="prov-chip">P</mat-chip> }
                      </td>
                    </ng-container>

                    <ng-container matColumnDef="overall-index">
                      <th mat-header-cell *matHeaderCellDef>Overall Index</th>
                      <td mat-cell *matCellDef="let row">{{ row.index['overall'] | number:'1.1-1' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="overall-growth">
                      <th mat-header-cell *matHeaderCellDef>Overall Growth</th>
                      <td mat-cell *matCellDef="let row" [class]="getTrendClass(row.growth['overall'])">
                        {{ formatGrowth(row.growth['overall']) }}
                      </td>
                    </ng-container>

                    @for (sector of detail()!.sectors; track sector.id) {
                      <ng-container [matColumnDef]="sector.id">
                        <th mat-header-cell *matHeaderCellDef>{{ sector.name }}</th>
                        <td mat-cell *matCellDef="let row" [class]="getTrendClass(row.growth[sector.id])">
                          {{ formatGrowth(row.growth[sector.id]) }}
                        </td>
                      </ng-container>
                    }

                    <tr mat-header-row *matHeaderRowDef="displayedColumns()"></tr>
                    <tr mat-row *matRowDef="let row; columns: displayedColumns()"></tr>
                  </table>
                </div>
              } @else {
                <div class="chart-container">
                  <div class="line-range-controls">
                    <label class="range-field">
                      <span>From</span>
                      <select #startSelect [value]="effectiveMonthlyRangeStart() ?? ''" (change)="onMonthlyRangeStartChange(startSelect.value)">
                        @for (option of monthlyRangeOptions(); track option.period) {
                          <option [value]="option.period">{{ option.label }}</option>
                        }
                      </select>
                    </label>

                    <label class="range-field">
                      <span>To</span>
                      <select #endSelect [value]="effectiveMonthlyRangeEnd() ?? ''" (change)="onMonthlyRangeEndChange(endSelect.value)">
                        @for (option of monthlyRangeOptions().reverse(); track option.period) {
                          <option [value]="option.period">{{ option.label }}</option>
                        }
                      </select>
                    </label>

                    <button mat-stroked-button type="button" (click)="resetMonthlyRange()">Reset</button>
                  </div>

                  <mat-card>
                    <mat-card-header>
                      <mat-card-title>Monthly YoY Growth by Sector</mat-card-title>
                    </mat-card-header>
                    <mat-card-content>
                      <canvas baseChart
                        [data]="monthlySectorLineData()"
                        [options]="monthlySectorLineOptions()"
                        [type]="'line'">
                      </canvas>
                    </mat-card-content>
                  </mat-card>
                </div>
              }
            </mat-tab>

          </mat-tab-group>
        </section>
      }
    </div>
  `,
  styles: [`
    .loading { display: flex; justify-content: center; padding: 64px; }

    .top-half { margin-bottom: 24px; }

    .breadcrumb {
      display: flex; align-items: center; gap: 8px; margin-bottom: 16px; font-size: 0.9rem; opacity: 0.7;
    }
    .back-link {
      display: flex; align-items: center; gap: 4px; text-decoration: none; color: inherit;
    }
    .back-link:hover { opacity: 1; }
    .crumb-sep { opacity: 0.4; }
    .detail-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 24px; flex-wrap: wrap; gap: 16px;
    }
    .meta { font-size: 0.85rem; opacity: 0.6; margin-top: 4px; }
    .headline { text-align: right; }
    .headline-value { font-size: 2.5rem; font-weight: 700; }
    .headline-label { display: block; font-size: 0.85rem; opacity: 0.6; }

    .charts-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    }
    @media (max-width: 768px) {
      .charts-row { grid-template-columns: 1fr; }
    }

    .bottom-half {
      border-top: 1px solid rgba(128,128,128,0.2);
      padding-top: 16px;
    }

    .chart-container { padding: 16px 0; }

    .monthly-tab-header {
      display: flex; justify-content: flex-end; padding: 16px 0 0;
    }

    .table-container { overflow-x: auto; padding: 16px 0; }
    .data-table { width: 100%; }
    .prov-chip { font-size: 0.7rem; margin-left: 4px; }

    .line-range-controls {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .range-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.8rem;
      opacity: 0.85;
    }
    .range-field select {
      min-width: 140px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(128,128,128,0.4);
      background: transparent;
      color: inherit;
    }
  `]
})
export class EightCoreIndustriesComponent implements OnInit {
  @Input({ required: true }) country = 'india';

  private dataService = inject(EightCoreIndustriesDataService);
  private themeService = inject(ThemeService);

  loading = signal(true);
  detail = signal<DatasetDetail | null>(null);
  monthlyView = signal<'table' | 'chart'>('table');
  monthlyRangeStart = signal<string | null>(null);
  monthlyRangeEnd = signal<string | null>(null);

  latestEntry = computed<MonthlyEntry | undefined>(() => {
    const d = this.detail();
    return d ? d.monthly[d.monthly.length - 1] : undefined;
  });

  latestOverallGrowth = computed(() => this.latestEntry()?.growth?.['overall'] ?? null);

  monthlyReversed = computed(() => {
    const d = this.detail();
    return d ? [...d.monthly].reverse() : [];
  });

  displayedColumns = computed(() => {
    const d = this.detail();
    if (!d) return [];
    return ['period', 'overall-index', 'overall-growth', ...d.sectors.map(s => s.id)];
  });

  monthlyRangeOptions = computed(() => {
    const d = this.detail();
    if (!d) return [] as Array<{ period: string; label: string }>;
    return d.monthly
      .filter((m): m is MonthlyEntry & { period: string; label: string } => Boolean(m.period && m.label))
      .sort((a, b) => a.period.localeCompare(b.period))
      .map(m => ({ period: m.period, label: m.label }));
  });

  effectiveMonthlyRangeStart = computed(() => {
    const options = this.monthlyRangeOptions();
    if (!options.length) return null;

    const start = this.monthlyRangeStart();
    if (start && options.some(o => o.period === start)) return start;
    return options[0].period;
  });

  effectiveMonthlyRangeEnd = computed(() => {
    const options = this.monthlyRangeOptions();
    if (!options.length) return null;

    const end = this.monthlyRangeEnd();
    if (end && options.some(o => o.period === end)) return end;

    return options[options.length - 1].period;
  });

  filteredMonthly = computed(() => {
    const d = this.detail();
    if (!d) return [] as MonthlyEntry[];

    const start = this.effectiveMonthlyRangeStart();
    const end = this.effectiveMonthlyRangeEnd();

    if (!start || !end) return d.monthly;
    return d.monthly.filter(m => m.period >= start && m.period <= end);
  });

  // -- Chart colors --
  private sectorColors = [
    '#b942f5', '#5072ef', '#74c6af', '#ffa726',
    '#db2b5d', '#26c6da', '#65ea31', '#ffee58',
  ];

  private getSectorColor(index: number): string {
    return this.sectorColors[index % this.sectorColors.length];
  }

  // -- Overall Trend Chart (combo: bar for index, line for growth) --
  overallChartData = computed<ChartData<'bar'>>(() => {
    const d = this.detail();
    if (!d) return { labels: [], datasets: [] };
    const months = d.monthly;
    return {
      labels: months.map(m => m.label),
      datasets: [
        {
          label: 'Overall Index',
          data: months.map(m => m.index?.['overall'] ?? null),
          backgroundColor: 'rgba(66,165,245,0.6)',
          borderColor: '#42a5f5',
          borderWidth: 1,
          order: 2,
        },
        {
          label: 'YoY Growth %',
          data: months.map(m => m.growth?.['overall'] ?? null),
          type: 'line' as any,
          borderColor: '#ffa726',
          backgroundColor: 'rgba(255,167,38,0.1)',
          pointBackgroundColor: '#ffa726',
          pointRadius: 4,
          fill: false,
          yAxisID: 'yGrowth',
          order: 1,
        },
      ],
    };
  });

  comboChartOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const textColor = this.themeService.isDark() ? '#e0e0e0' : '#424242';
    const gridColor = this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    return {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { title: { display: true, text: 'Index', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
        yGrowth: { position: 'right', title: { display: true, text: 'Growth %', color: textColor }, ticks: { color: textColor, callback: (v) => v + '%' }, grid: { drawOnChartArea: false } },
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
      plugins: {
        legend: { labels: { color: textColor } },
        tooltip: { callbacks: { label: (ctx) => {
          const v = ctx.parsed.y;
          return ctx.dataset.yAxisID === 'yGrowth' ? `${ctx.dataset.label}: ${v}%` : `${ctx.dataset.label}: ${v}`;
        }}},
      },
    };
  });

  // -- Sector Weights Doughnut --
  weightChartData = computed<ChartData<'doughnut'>>(() => {
    const d = this.detail();
    if (!d) return { labels: [], datasets: [] };
    return {
      labels: d.sectors.map(s => s.name),
      datasets: [{
        data: d.sectors.map(s => s.weight),
        backgroundColor: d.sectors.map((_, i) => this.getSectorColor(i)),
        borderWidth: 0,
      }],
    };
  });

  doughnutOptions = computed<ChartConfiguration<'doughnut'>['options']>(() => {
    const textColor = this.themeService.isDark() ? '#e0e0e0' : '#424242';
    return {
      responsive: true,
      plugins: {
        legend: { position: 'right', labels: { color: textColor, padding: 12 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}%` } },
      },
    };
  });

  // -- Sector Growth Bar Chart --
  sectorGrowthChartData = computed<ChartData<'bar'>>(() => {
    const d = this.detail();
    const latest = this.latestEntry();
    if (!d || !latest) return { labels: [], datasets: [] };
    const growths = d.sectors.map(s => latest.growth?.[s.id] ?? 0);
    return {
      labels: d.sectors.map(s => s.name),
      datasets: [{
        label: 'YoY Growth %',
        data: growths,
        backgroundColor: growths.map(g => g >= 0 ? 'rgba(76,175,80,0.7)' : 'rgba(244,67,54,0.7)'),
        borderColor: growths.map(g => g >= 0 ? '#4caf50' : '#f44336'),
        borderWidth: 1,
      }],
    };
  });

  sectorGrowthOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const textColor = this.themeService.isDark() ? '#e0e0e0' : '#424242';
    const gridColor = this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    return {
      responsive: true,
      indexAxis: 'y',
      scales: {
        x: { ticks: { color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } },
        y: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.x}%` } },
      },
    };
  });

  // -- Yearly Growth bar chart --
  yearlyChartData = computed<ChartData<'bar'>>(() => {
    const d = this.detail();
    if (!d) return { labels: [], datasets: [] };
    const years = d.yearly;
    const growths = years.map(y => y.growth?.['overall'] ?? null);
    return {
      labels: years.map(y => y.year),
      datasets: [{
        label: 'Overall Growth %',
        data: growths,
        backgroundColor: growths.map(g => (g ?? 0) >= 0 ? 'rgba(66,165,245,0.7)' : 'rgba(244,67,54,0.7)'),
        borderColor: growths.map(g => (g ?? 0) >= 0 ? '#42a5f5' : '#f44336'),
        borderWidth: 1,
      }],
    };
  });

  yearlyChartOptions = computed<ChartConfiguration<'bar'>['options']>(() => {
    const textColor = this.themeService.isDark() ? '#e0e0e0' : '#424242';
    const gridColor = this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    return {
      responsive: true,
      scales: {
        y: { title: { display: true, text: 'Growth %', color: textColor }, ticks: { color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.parsed.y}%` } },
      },
    };
  });

  // -- Monthly Sector Line Chart --
  monthlySectorLineData = computed<ChartData<'line'>>(() => {
    const d = this.detail();
    if (!d) return { labels: [], datasets: [] };
    const months = this.filteredMonthly();
    return {
      labels: months.map(m => m.label),
      datasets: d.sectors.map((s, i) => ({
        label: s.name,
        data: months.map(m => m.growth?.[s.id] ?? null),
        borderColor: this.getSectorColor(i),
        backgroundColor: this.getSectorColor(i),
        pointBackgroundColor: this.getSectorColor(i),
        pointBorderColor: this.getSectorColor(i),
        pointHoverBackgroundColor: this.getSectorColor(i),
        pointHoverBorderColor: this.getSectorColor(i),
        pointRadius: 3,
        tension: 0.3,
        fill: false,
      })),
    };
  });

  monthlySectorLineOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    const textColor = this.themeService.isDark() ? '#e0e0e0' : '#424242';
    const gridColor = this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
    return {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      scales: {
        y: { title: { display: true, text: 'YoY Growth %', color: textColor }, ticks: { color: textColor, callback: (v) => v + '%' }, grid: { color: gridColor } },
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
      },
      plugins: {
        legend: {
          labels: {
            color: textColor,
            usePointStyle: true,
            padding: 16,
            generateLabels: (chart) => {
              return chart.data.datasets.map((dataset, i) => ({
                text: String(dataset.label ?? `Sector ${i + 1}`),
                fillStyle: this.getSectorColor(i),
                strokeStyle: this.getSectorColor(i),
                fontColor: textColor,
                lineWidth: 2,
                pointStyle: 'circle',
                hidden: !chart.isDatasetVisible(i),
                datasetIndex: i,
              }));
            },
          },
        },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}%` } },
      },
    };
  });

  ngOnInit(): void {
    this.dataService.getDetail(this.country).subscribe({
      next: (result) => {
        this.detail.set(result);
        const validMonthly = result.monthly
          .filter((m): m is MonthlyEntry & { period: string; label: string } => Boolean(m.period && m.label))
          .sort((a, b) => a.period.localeCompare(b.period));
        this.monthlyRangeStart.set(validMonthly[0]?.period ?? null);
        this.monthlyRangeEnd.set(validMonthly[validMonthly.length - 1]?.period ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onMonthlyRangeStartChange(period: string): void {
    this.monthlyRangeStart.set(period);

    const end = this.effectiveMonthlyRangeEnd();
    if (!end) return;
    if (period > end) this.monthlyRangeEnd.set(period);
  }

  onMonthlyRangeEndChange(period: string): void {
    this.monthlyRangeEnd.set(period);

    const start = this.effectiveMonthlyRangeStart();
    if (!start) return;
    if (period < start) this.monthlyRangeStart.set(period);
  }

  resetMonthlyRange(): void {
    const options = this.monthlyRangeOptions();
    if (!options.length) return;
    this.monthlyRangeStart.set(options[0].period);
    this.monthlyRangeEnd.set(options[options.length - 1].period);
  }

  getOverallTrendClass(): string {
    return this.getTrendClass(this.latestOverallGrowth());
  }

  getTrendClass(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';
    if (value > 0) return 'trend-up';
    if (value < 0) return 'trend-down';
    return 'trend-flat';
  }

  formatGrowth(value: number | null | undefined): string {
    if (value === null || value === undefined) return '—';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}%`;
  }

  formatCountryName(countryCode: string | null | undefined): string {
    if (!countryCode) return 'Country';

    return countryCode
      .split('-')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ');
  }
}
