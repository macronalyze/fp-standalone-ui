import { Component, ElementRef, HostListener, Input, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { combineLatest, of, Subscription } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ChartConfiguration, ChartData } from 'chart.js';
import { BaseChartDirective, NgChartsModule } from 'ng2-charts';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { ThemeService } from '../../../services/theme.service';
import { TradeDataService, TradeDataset, TradeDatasetId, TradeCountryOption } from './trade-data.service';

const MAX_COMPARE_COUNTRIES = 5;

@Component({
  selector: 'app-trade-data-view',
  standalone: true,
  imports: [
    NgChartsModule,
    MatCardModule,
    MatProgressSpinnerModule,
    MatButtonToggleModule,
    MatButtonModule,
    MatChipsModule,
  ],
  template: `
    @if (loading()) {
      <div class="loading"><mat-spinner diameter="44"></mat-spinner></div>
    } @else if (errorMessage()) {
      <mat-card>
        <mat-card-header>
          <mat-card-title>{{ title }}</mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <p>{{ errorMessage() }}</p>
        </mat-card-content>
      </mat-card>
    } @else if (detail()) {
      <div class="detail-header">
        <div>
          <h3>{{ detail()!.name }}</h3>
          <p class="meta">Source: {{ detail()!.source }}</p>
          <p class="description">{{ detail()!.description }}</p>
        </div>
      </div>

      <section #fullscreenShell class="fullscreen-shell" [class.fullscreen-active]="isFullscreen()">
        <div class="control-row">
          <mat-button-toggle-group
            [value]="viewMode()"
            (change)="onModeChange($event.value)"
            hideSingleSelectionIndicator>
            <mat-button-toggle value="country">All Commodities</mat-button-toggle>
            <mat-button-toggle value="compare">Compare Countries</mat-button-toggle>
          </mat-button-toggle-group>
          <button mat-stroked-button type="button" (click)="toggleFullscreen()">
            {{ isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen' }}
          </button>
        </div>

      @if (viewMode() === 'country') {
        <mat-card class="control-card">
          <mat-card-header>
            <mat-card-title>Commodity Selection</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="commodity-actions">
              <button mat-button type="button" (click)="selectAllCommodities()">Select all</button>
              <button mat-button type="button" (click)="clearCommodities()">Clear all</button>
              <span class="selection-count">{{ selectedCommodities().length }} selected</span>
              <button mat-button type="button" class="panel-toggle" (click)="toggleCommodityPanel()">
                {{ commodityPanelExpanded() ? 'Collapse list' : 'Expand list' }}
              </button>
            </div>
            @if (commodityPanelExpanded()) {
              <div class="commodity-grid">
                @for (commodity of detail()!.commodities; track commodity) {
                  <label class="selection-item">
                    <input
                      type="checkbox"
                      [checked]="isCommoditySelected(commodity)"
                      (change)="toggleCommodity(commodity, $any($event.target).checked)" />
                    <span class="series-swatch" [style.background]="getCommodityColor(commodity)"></span>
                    <span>{{ commodity }}</span>
                  </label>
                }
              </div>
            }
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="control-card compare-controls">
          <mat-card-header>
            <mat-card-title>Compare Setup</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <div class="compare-layout">
              <label class="select-field">
                <span>Commodity</span>
                <select
                  #compareCommoditySelect
                  [value]="compareCommodity() ?? ''"
                  (change)="onCompareCommodityChange(compareCommoditySelect.value)">
                  @for (commodity of detail()!.commodities; track commodity) {
                    <option [value]="commodity">{{ commodity }}</option>
                  }
                </select>
              </label>

              <div class="country-select-block">
                <div class="country-select-header">
                  <span>Countries (max {{ MAX_COMPARE_COUNTRIES }} including {{ countryName(country) }})</span>
                  <span>{{ selectedCompareCountries().length + 1 }}/{{ MAX_COMPARE_COUNTRIES }}</span>
                  <button mat-button type="button" class="panel-toggle" (click)="toggleCompareCountriesPanel()">
                    {{ compareCountriesPanelExpanded() ? 'Collapse list' : 'Expand list' }}
                  </button>
                </div>
                @if (compareCountriesPanelExpanded()) {
                  <div class="country-grid">
                    @for (option of compareCountryOptions(); track option.id) {
                      <label class="selection-item">
                        <input
                          type="checkbox"
                          [checked]="isCountrySelected(option.id)"
                          [disabled]="isCountryDisabled(option.id)"
                          (change)="toggleCompareCountry(option.id, $any($event.target).checked)" />
                        <span class="series-swatch" [style.background]="getCountrySwatchColor(option.id)"></span>
                        <span>{{ option.name }}</span>
                      </label>
                    }
                  </div>
                }
              </div>
            </div>

            @if (missingCountries().length) {
              <div class="legend-note">
                <span>No data:</span>
                <mat-chip-set>
                  @for (countryId of missingCountries(); track countryId) {
                    <mat-chip>{{ countryName(countryId) }}</mat-chip>
                  }
                </mat-chip-set>
              </div>
            }
          </mat-card-content>
        </mat-card>
      }

      <mat-card>
        <mat-card-header>
          <mat-card-title>
            @if (viewMode() === 'country') {
              {{ title }} by Commodity
            } @else {
              {{ compareCommodity() }}: Country Comparison
            }
          </mat-card-title>
        </mat-card-header>
        <mat-card-content>
          <div class="range-controls chart-range-controls">
            <label class="range-field">
              <span>From</span>
              <select #startSelect [value]="effectiveRangeStart() ?? ''" (change)="onRangeStartChange(startSelect.value)">
                @for (option of rangeOptions(); track option.period) {
                  <option [value]="option.period">{{ option.label }}</option>
                }
              </select>
            </label>

            <label class="range-field">
              <span>To</span>
              <select #endSelect [value]="effectiveRangeEnd() ?? ''" (change)="onRangeEndChange(endSelect.value)">
                @for (option of reverseRangeOptions(); track option.period) {
                  <option [value]="option.period">{{ option.label }}</option>
                }
              </select>
            </label>

            <button mat-stroked-button type="button" (click)="resetRange()">Reset</button>

            <div class="range-presets">
              <button mat-stroked-button type="button" (click)="applyRecentRange(1)">1M</button>
              <button mat-stroked-button type="button" (click)="applyRecentRange(3)">3M</button>
              <button mat-stroked-button type="button" (click)="applyRecentRange(6)">6M</button>
              <button mat-stroked-button type="button" (click)="applyRecentRange(12)">1Y</button>
            </div>

          </div>

          <div class="chart-host" [class.filters-collapsed]="isFilterPanelCollapsed()">
            <canvas
              baseChart
              [type]="'line'"
              [data]="lineChartData()"
              [options]="lineChartOptions()">
            </canvas>
          </div>
        </mat-card-content>
      </mat-card>
      </section>
    }
  `,
  styles: [`
    .loading {
      display: flex;
      justify-content: center;
      padding: 48px;
    }

    .detail-header {
      margin: 16px 0;
    }

    .detail-header h3 {
      margin: 0;
    }

    .meta {
      opacity: 0.7;
      font-size: 0.85rem;
      margin-top: 4px;
    }

    .description {
      opacity: 0.85;
      font-size: 0.95rem;
      margin-top: 8px;
    }

    .control-row {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .range-controls {
      display: flex;
      align-items: flex-end;
      gap: 10px;
      flex-wrap: wrap;
    }

    .chart-range-controls {
      margin-bottom: 10px;
    }

    .chart-host {
      position: relative;
      min-height: 420px;
      height: 52vh;
      max-height: 760px;
      transition: min-height 220ms ease, height 220ms ease, max-height 220ms ease;
    }

    .chart-host.filters-collapsed {
      min-height: 560px;
      height: 70vh;
      max-height: 920px;
    }

    .fullscreen-shell.fullscreen-active {
      width: 100%;
      height: 100%;
      padding: 12px;
      overflow: auto;
      background: var(--mat-app-background-color, #1e1e1e);
    }

    .fullscreen-shell.fullscreen-active .chart-host {
      min-height: 70vh;
      height: 74vh;
      max-height: none;
    }

    .range-presets {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-right: 8px;
    }

    .range-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.8rem;
      opacity: 0.85;
    }

    .range-field select,
    .select-field select {
      min-width: 150px;
      padding: 6px 8px;
      border-radius: 6px;
      border: 1px solid rgba(128, 128, 128, 0.4);
      background: transparent;
      color: inherit;
    }

    .control-card {
      margin-bottom: 14px;
    }

    .commodity-actions {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .selection-count {
      font-size: 0.85rem;
      opacity: 0.75;
    }

    .panel-toggle {
      margin-left: auto;
    }

    .commodity-grid,
    .country-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 8px;
      max-height: 220px;
      overflow: auto;
      padding-right: 4px;
    }

    .selection-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.88rem;
      opacity: 0.95;
    }

    .series-swatch {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.35);
      flex-shrink: 0;
    }

    .compare-layout {
      display: grid;
      grid-template-columns: 280px 1fr;
      gap: 16px;
    }

    .select-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 0.8rem;
      opacity: 0.85;
    }

    .country-select-header {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 0.8rem;
      opacity: 0.8;
      margin-bottom: 8px;
    }

    .legend-note {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 12px;
      font-size: 0.85rem;
      opacity: 0.85;
      flex-wrap: wrap;
    }

    @media (max-width: 840px) {
      .compare-layout {
        grid-template-columns: 1fr;
      }

      .chart-host {
        min-height: 360px;
        height: 48vh;
      }

      .chart-host.filters-collapsed {
        min-height: 460px;
        height: 62vh;
      }
    }
  `],
})
export class TradeDataViewComponent implements OnInit, OnDestroy {
  @Input({ required: true }) country = 'india';
  @Input({ required: true }) datasetId!: TradeDatasetId;
  @Input({ required: true }) title = '';

  protected readonly MAX_COMPARE_COUNTRIES = MAX_COMPARE_COUNTRIES;

  @ViewChild('fullscreenShell', { static: false }) fullscreenShell?: ElementRef<HTMLElement>;
  @ViewChild(BaseChartDirective) chart?: BaseChartDirective;

  private tradeDataService = inject(TradeDataService);
  private themeService = inject(ThemeService);

  private compareSubscription: Subscription | null = null;

  loading = signal(true);
  errorMessage = signal<string | null>(null);
  detail = signal<TradeDataset | null>(null);

  viewMode = signal<'country' | 'compare'>('country');
  rangeStart = signal<string | null>(null);
  rangeEnd = signal<string | null>(null);

  selectedCommodities = signal<string[]>([]);
  compareCommodity = signal<string | null>(null);
  selectedCompareCountries = signal<string[]>([]);
  compareDatasets = signal<Array<{ country: string; dataset: TradeDataset }>>([]);
  missingCountries = signal<string[]>([]);
  commodityPanelExpanded = signal(true);
  compareCountriesPanelExpanded = signal(true);
  isFullscreen = signal(false);

  toggleCommodityPanel(): void {
    this.commodityPanelExpanded.update((expanded) => !expanded);
    this.scheduleChartResize();
  }

  toggleCompareCountriesPanel(): void {
    this.compareCountriesPanelExpanded.update((expanded) => !expanded);
    this.scheduleChartResize();
  }

  async toggleFullscreen(): Promise<void> {
    const host = this.fullscreenShell?.nativeElement;
    if (!host) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await host.requestFullscreen();
  }

  private countryColors = new Map<string, string>();
  private commodityColors = new Map<string, string>();

  compareCountryOptions = computed<TradeCountryOption[]>(() => {
    return this.tradeDataService.getCountryOptions(this.country).filter((option) => option.id !== this.country);
  });

  isFilterPanelCollapsed = computed(() => {
    if (this.viewMode() === 'country') {
      return !this.commodityPanelExpanded();
    }
    return !this.compareCountriesPanelExpanded();
  });

  rangeOptions = computed(() => {
    const d = this.detail();
    if (!d) return [] as Array<{ period: string; label: string }>;
    return d.monthly.map((entry) => ({ period: entry.period, label: entry.label }));
  });

  reverseRangeOptions = computed(() => [...this.rangeOptions()].reverse());

  effectiveRangeStart = computed(() => {
    const options = this.rangeOptions();
    if (!options.length) return null;
    const selected = this.rangeStart();
    if (selected && options.some((option) => option.period === selected)) return selected;
    return options[0].period;
  });

  effectiveRangeEnd = computed(() => {
    const options = this.rangeOptions();
    if (!options.length) return null;
    const selected = this.rangeEnd();
    if (selected && options.some((option) => option.period === selected)) return selected;
    return options[options.length - 1].period;
  });

  filteredMonthly = computed(() => {
    const d = this.detail();
    if (!d) return [];
    const start = this.effectiveRangeStart();
    const end = this.effectiveRangeEnd();
    if (!start || !end) return d.monthly;
    return d.monthly.filter((entry) => entry.period >= start && entry.period <= end);
  });

  lineChartData = computed<ChartData<'line'>>(() => {
    return this.viewMode() === 'country'
      ? this.buildCountryCommodityData()
      : this.buildCountryCompareData();
  });

  lineChartOptions = computed<ChartConfiguration<'line'>['options']>(() => {
    const textColor = this.themeService.isDark() ? '#e0e0e0' : '#424242';
    const gridColor = this.themeService.isDark() ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';

    return {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', intersect: false },
      scales: {
        y: {
          title: { display: true, text: 'USD Value', color: textColor },
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
        x: {
          ticks: { color: textColor },
          grid: { color: gridColor },
        },
      },
      plugins: {
        legend: {
          display: false,
          labels: {
            color: textColor,
            usePointStyle: true,
            padding: 14,
          },
        },
        tooltip: {
          mode: 'nearest',
          intersect: false,
          displayColors: true,
        },
      },
    };
  });

  ngOnInit(): void {
    this.loadPrimaryDataset();
  }

  ngOnDestroy(): void {
    this.compareSubscription?.unsubscribe();
  }

  @HostListener('document:fullscreenchange')
  onFullscreenChange(): void {
    this.isFullscreen.set(Boolean(document.fullscreenElement));
    this.scheduleChartResize();
  }

  onModeChange(mode: 'country' | 'compare'): void {
    this.viewMode.set(mode);
    if (mode === 'compare') {
      this.refreshCompareDatasets();
    }
    this.scheduleChartResize();
  }

  onRangeStartChange(period: string): void {
    this.rangeStart.set(period);
    const end = this.effectiveRangeEnd();
    if (end && period > end) {
      this.rangeEnd.set(period);
    }
  }

  onRangeEndChange(period: string): void {
    this.rangeEnd.set(period);
    const start = this.effectiveRangeStart();
    if (start && period < start) {
      this.rangeStart.set(period);
    }
  }

  resetRange(): void {
    const options = this.rangeOptions();
    if (!options.length) return;
    this.rangeStart.set(options[0].period);
    this.rangeEnd.set(options[options.length - 1].period);
  }

  applyRecentRange(monthCount: number): void {
    const options = this.rangeOptions();
    if (!options.length) return;

    const end = options[options.length - 1].period;
    const startIndex = Math.max(0, options.length - monthCount);
    const start = options[startIndex].period;

    this.rangeStart.set(start);
    this.rangeEnd.set(end);
  }

  isCommoditySelected(commodity: string): boolean {
    return this.selectedCommodities().includes(commodity);
  }

  toggleCommodity(commodity: string, checked: boolean): void {
    this.selectedCommodities.update((current) => {
      if (checked) {
        this.ensureCommodityColor(commodity);
        if (current.includes(commodity)) return current;
        return [...current, commodity];
      }

      return current.filter((value) => value !== commodity);
    });
  }

  selectAllCommodities(): void {
    const d = this.detail();
    if (!d) return;
    this.selectedCommodities.set([...d.commodities]);
  }

  clearCommodities(): void {
    this.selectedCommodities.set([]);
  }

  onCompareCommodityChange(commodity: string): void {
    this.compareCommodity.set(commodity || null);
  }

  isCountrySelected(countryId: string): boolean {
    return this.selectedCompareCountries().includes(countryId);
  }

  isCountryDisabled(countryId: string): boolean {
    const selected = this.selectedCompareCountries();
    if (selected.includes(countryId)) return false;
    return selected.length + 1 >= MAX_COMPARE_COUNTRIES;
  }

  toggleCompareCountry(countryId: string, checked: boolean): void {
    this.selectedCompareCountries.update((current) => {
      if (checked) {
        this.ensureCountryColor(countryId);
        if (current.includes(countryId)) return current;
        if (current.length + 1 >= MAX_COMPARE_COUNTRIES) return current;
        return [...current, countryId];
      }
      return current.filter((value) => value !== countryId);
    });

    this.refreshCompareDatasets();
  }

  countryName(countryId: string): string {
    const option = this.tradeDataService.getCountryOptions(this.country).find((item) => item.id === countryId);
    return option?.name ?? this.toTitleCase(countryId);
  }

  private loadPrimaryDataset(): void {
    this.loading.set(true);
    this.errorMessage.set(null);

    this.tradeDataService.getDataset(this.country, this.datasetId).subscribe({
      next: (dataset) => {
        this.detail.set(dataset);
        this.rangeStart.set(dataset.monthly[0]?.period ?? null);
        this.rangeEnd.set(dataset.monthly[dataset.monthly.length - 1]?.period ?? null);
        this.selectedCommodities.set([...dataset.commodities]);
        this.compareCommodity.set(dataset.commodities[0] ?? null);
        this.ensureCountryColor(this.country);
        dataset.commodities.forEach((commodity) => this.ensureCommodityColor(commodity));
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('Unable to load dataset for the selected country.');
        this.loading.set(false);
      },
    });
  }

  private refreshCompareDatasets(): void {
    if (this.viewMode() !== 'compare') return;

    const countries = this.selectedCompareCountries();
    if (!countries.length) {
      this.compareDatasets.set([]);
      this.missingCountries.set([]);
      return;
    }

    this.compareSubscription?.unsubscribe();

    const requests = countries.map((country) =>
      this.tradeDataService.getDataset(country, this.datasetId).pipe(
        map((dataset) => ({ country, dataset })),
        catchError(() => of({ country, dataset: null as TradeDataset | null }))
      )
    );

    this.compareSubscription = combineLatest(requests).subscribe((results) => {
      const available = results.filter((result) => Boolean(result.dataset)) as Array<{ country: string; dataset: TradeDataset }>;
      const missing = results.filter((result) => !result.dataset).map((result) => result.country);

      available.forEach((entry) => this.ensureCountryColor(entry.country));
      this.compareDatasets.set(available);
      this.missingCountries.set(missing);
    });
  }

  private buildCountryCommodityData(): ChartData<'line'> {
    const d = this.detail();
    if (!d) return { labels: [], datasets: [] };

    const months = this.filteredMonthly();
    const selected = this.selectedCommodities();

    return {
      labels: months.map((entry) => entry.label),
      datasets: selected.map((commodity) => {
        const color = this.getCommodityColor(commodity);
        return {
          label: commodity,
          data: months.map((entry) => entry.data[commodity] ?? null),
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointRadius: 2,
          borderWidth: 2,
          tension: 0.25,
          fill: false,
        };
      }),
    };
  }

  private buildCountryCompareData(): ChartData<'line'> {
    const d = this.detail();
    if (!d) return { labels: [], datasets: [] };

    const commodity = this.compareCommodity();
    if (!commodity) return { labels: [], datasets: [] };

    const months = this.filteredMonthly();
    const periods = months.map((entry) => entry.period);

    const countries: Array<{ country: string; dataset: TradeDataset }> = [
      { country: this.country, dataset: d },
      ...this.compareDatasets(),
    ];

    return {
      labels: months.map((entry) => entry.label),
      datasets: countries.map(({ country, dataset }) => {
        const color = this.getCountryColor(country);
        const periodMap = new Map(dataset.monthly.map((entry) => [entry.period, entry.data[commodity] ?? null]));

        return {
          label: this.countryName(country),
          data: periods.map((period) => periodMap.get(period) ?? null),
          borderColor: color,
          backgroundColor: color,
          pointBackgroundColor: color,
          pointRadius: 3,
          borderWidth: 2,
          tension: 0.2,
          fill: false,
        };
      }),
    };
  }

  private ensureCountryColor(country: string): string {
    const existing = this.countryColors.get(country);
    if (existing) return existing;

    const color = this.randomColor();
    this.countryColors.set(country, color);
    return color;
  }

  private ensureCommodityColor(commodity: string): string {
    const existing = this.commodityColors.get(commodity);
    if (existing) return existing;

    const color = this.randomColor();
    this.commodityColors.set(commodity, color);
    return color;
  }

  getCountryColor(country: string): string {
    return this.countryColors.get(country) ?? '#90a4ae';
  }

  getCommodityColor(commodity: string): string {
    return this.commodityColors.get(commodity) ?? '#90a4ae';
  }

  getCountrySwatchColor(country: string): string {
    if (!this.isCountrySelected(country)) {
      return 'rgba(255, 255, 255, 0.15)';
    }
    return this.getCountryColor(country);
  }

  private randomColor(): string {
    const hue = Math.floor(Math.random() * 360);
    const saturation = 62 + Math.floor(Math.random() * 16);
    const lightness = 46 + Math.floor(Math.random() * 10);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  private toTitleCase(value: string): string {
    return value
      .split('-')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ');
  }

  private scheduleChartResize(): void {
    setTimeout(() => {
      this.chart?.chart?.resize();
      this.chart?.chart?.update('none');
    }, 30);
  }
}
