import { Component, Input, computed, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';

// ── API interfaces ──────────────────────────────────────────────────────────

interface SearchResult {
  isin: string;
  name: string;
  nse_symbol: string;
  bse_code: number;
}

interface SearchResponse {
  results: SearchResult[];
  count: number;
}

interface ApiDataPoint {
  date: string;
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  last: number;
  prev_close: number;
  total_traded_qty: number;
  total_traded_val: number;
  total_trades: number;
}

interface ApiStockResponse {
  isin: string;
  nse: { count: number; data: ApiDataPoint[] };
}

interface AddedStock {
  isin: string;
  symbol: string;
  name: string;
  data: ApiDataPoint[];
}

// ── Constants ───────────────────────────────────────────────────────────────

export type RangeKey = '7d' | '15d' | '21d' | '1m' | '2m' | '3m' | '6m' | '1y' | 'custom';

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 Day',   days: 7   },
  { key: '15d', label: '15 Day',  days: 15  },
  { key: '21d', label: '21 Day',  days: 21  },
  { key: '1m',  label: '1 Month', days: 30  },
  { key: '2m',  label: '2 Month', days: 60  },
  { key: '3m',  label: '3 Month', days: 90  },
  { key: '6m',  label: '6 Month', days: 180 },
  { key: '1y',  label: '1 Year',  days: 365 },
  { key: 'custom', label: 'Custom', days: 0 },
];

const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#edc948',
];

const API_BASE = 'https://fp-backend-eu.onrender.com/fp/api/v1';

// ── Utilities ────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function filterByRange(data: ApiDataPoint[], days: number, customFrom?: string, customTo?: string): ApiDataPoint[] {
  if (data.length === 0) return [];
  if (customFrom && customTo) {
    const from = new Date(customFrom);
    const to = new Date(customTo);
    return data.filter(d => { const dt = new Date(d.date); return dt >= from && dt <= to; });
  }
  const latest = new Date(data[data.length - 1].date);
  const cutoff = new Date(latest);
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter(d => new Date(d.date) >= cutoff);
}

function fmtLabel(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (days <= 90) {
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

// ── Component ────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-stock-comparison',
  standalone: true,
  imports: [NgChartsModule, RouterLink, FormsModule],
  templateUrl: './stock-comparison.component.html',
  styleUrl: './stock-comparison.component.css',
})
export class StockComparisonComponent {
  @Input() country: string = '';

  private readonly http = inject(HttpClient);

  readonly rangeOptions = RANGE_OPTIONS;

  // ── State signals ───────────────────────────────────────────────────

  searchQuery   = signal<string>('');
  searchResults = signal<SearchResult[]>([]);
  searchLoading = signal<boolean>(false);
  searchError   = signal<string>('');

  addedStocks  = signal<AddedStock[]>([]);
  loadingIsins = signal<Set<string>>(new Set());

  selectedRange   = signal<RangeKey>('7d');
  compareMode      = signal<'price' | 'growth'>('price');
  chartMode        = signal<'line' | 'area'>('line');
  customFrom       = signal<string>('');
  customEndMode    = signal<'days' | 'date'>('days');
  customDaysOffset = signal<number>(7);
  customToDate     = signal<string>('');
  showDatePicker   = signal<boolean>(false);
  addError         = signal<string>('');

  readonly customTo = computed(() => {
    if (this.customEndMode() === 'date') return this.customToDate();
    const from = this.customFrom();
    if (!from) return '';
    const d = new Date(from);
    d.setDate(d.getDate() + this.customDaysOffset());
    return toDateStr(d);
  });

  private errorTimer:     ReturnType<typeof setTimeout> | null = null;
  private searchDebounce: ReturnType<typeof setTimeout> | null = null;

  // ── Derived computeds ───────────────────────────────────────────────

  private readonly rangeDays = computed(
    () => RANGE_OPTIONS.find(r => r.key === this.selectedRange())!.days,
  );

  readonly colorMap = computed<Map<string, string>>(() =>
    new Map(this.addedStocks().map((s, i) => [s.isin, COLORS[i % COLORS.length]]))
  );

  readonly tickerDatasets = computed(() => {
    const days   = this.rangeDays();
    const colors = this.colorMap();
    const isCustom = this.selectedRange() === 'custom';
    const from = isCustom ? this.customFrom() : undefined;
    const to   = isCustom ? this.customTo() : undefined;
    return this.addedStocks().map(stock => {
      const color    = colors.get(stock.isin) ?? COLORS[0];
      const filtered = filterByRange(stock.data, days, from, to);
      const base     = filtered.length > 0 ? filtered[0].close : null;
      const points   = base != null && base !== 0
        ? filtered.map(d => ({
            date:  d.date,
            close: d.close,
            pct:   parseFloat(((d.close - base) / base * 100).toFixed(2)),
          }))
        : filtered.map(d => ({ date: d.date, close: d.close, pct: 0 }));
      return { isin: stock.isin, symbol: stock.symbol, color, points };
    });
  });

  private readonly unionDates = computed<string[]>(() => {
    const all = new Set<string>();
    this.tickerDatasets().forEach(ds => ds.points.forEach(p => all.add(p.date)));
    return [...all].sort();
  });

  readonly lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const dates    = this.unionDates();
    let days = this.rangeDays();
    if (days === 0 && dates.length >= 2) {
      days = Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000);
    }
    const datasets = this.tickerDatasets().map(ds => {
      const closeMap = new Map(ds.points.map(p => [p.date, p.close]));
      const isArea = this.chartMode() === 'area';
      return {
        label:           ds.symbol,
        data:            dates.map(d => closeMap.has(d) ? closeMap.get(d)! : null),
        borderColor:     ds.color,
        backgroundColor: ds.color + (isArea ? '44' : '22'),
        tension:         0.3,
        fill:            isArea,
        pointRadius:     1,
        pointHoverRadius: 5,
        spanGaps:        true,
      };
    });
    return {
      labels: dates.map(d => fmtLabel(d, days)),
      datasets,
    };
  });

  readonly growthChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const dates = this.unionDates();
    let days = this.rangeDays();
    if (days === 0 && dates.length >= 2) {
      days = Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000);
    }
    const datasets = this.tickerDatasets().map(ds => {
      const pctMap = new Map(ds.points.map(p => [p.date, p.pct]));
      return {
        label:           ds.symbol,
        data:            dates.map(d => pctMap.get(d) ?? null),
        borderColor:     ds.color,
        backgroundColor: ds.color + '22',
        tension:         0.3,
        fill:            false,
        pointRadius:     1,
        pointHoverRadius: 5,
        spanGaps:        true,
      };
    });
    return {
      labels: dates.map(d => fmtLabel(d, days)),
      datasets,
    };
  });

  readonly lineChartOptions: ChartOptions<'line'> = {
    responsive: true,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: true, position: 'top' },
      title:  { display: true, text: 'Stock Price Comparison' },
      tooltip: {
        callbacks: {
          title: (items) => {
            const idx = items[0]?.dataIndex;
            const dates = this.unionDates();
            if (idx != null && dates[idx]) {
              return new Date(dates[idx]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
            }
            return '';
          },
          label: ctx => {
            const v = ctx.parsed.y;
            const pct = this.pctChangeData()[ctx.datasetIndex]?.[ctx.dataIndex];
            const pctStr = pct != null ? ` | ${pct >= 0 ? '+' : ''}${pct}%` : '';
            return v != null
              ? `${ctx.dataset.label}: \u20B9${v.toLocaleString('en-IN')}${pctStr}`
              : `${ctx.dataset.label}: N/A`;
          },
          labelColor: ctx => ({
            borderColor: ctx.dataset.borderColor as string,
            backgroundColor: ctx.dataset.borderColor as string,
          }),
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'Price (\u20B9)' },
        ticks: { callback: v => `\u20B9${v}` },
      },
      x: {
        title: { display: true, text: 'Date' },
        ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
      },
    },
  };

  readonly growthChartOptions = computed<ChartOptions<'line'>>(() => {
    const allPcts = this.tickerDatasets().flatMap(ds => ds.points.map(p => p.pct));
    const maxAbs = allPcts.length > 0 ? Math.ceil(Math.max(...allPcts.map(Math.abs))) : 10;
    const bound = Math.max(maxAbs, 1);
    return {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top' },
        title:  { display: true, text: 'Growth % Comparison' },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              const dates = this.unionDates();
              if (idx != null && dates[idx]) {
                return new Date(dates[idx]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              }
              return '';
            },
            label: ctx => {
              const pct = ctx.parsed.y;
              const dates = this.unionDates();
              const ds = this.tickerDatasets()[ctx.datasetIndex];
              const date = dates[ctx.dataIndex];
              const point = ds?.points.find(p => p.date === date);
              const priceStr = point ? ` | \u20B9${point.close.toLocaleString('en-IN')}` : '';
              return pct != null
                ? `${ctx.dataset.label}: ${pct >= 0 ? '+' : ''}${pct}%${priceStr}`
                : `${ctx.dataset.label}: N/A`;
            },
            labelColor: ctx => ({
              borderColor: ctx.dataset.borderColor as string,
              backgroundColor: ctx.dataset.borderColor as string,
            }),
          },
        },
      },
      scales: {
        y: {
          min: -bound,
          max: bound,
          title: { display: true, text: 'Growth (%)' },
          ticks: { callback: v => `${v}%` },
          grid: {
            color: (ctx) => ctx.tick.value === 0 ? '#888' : '#e0e0e0',
            lineWidth: (ctx) => ctx.tick.value === 0 ? 2 : 1,
          },
        },
        x: {
          title: { display: true, text: 'Date' },
          ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
        },
      },
    };
  });

  readonly summaryRows = computed(() => {
    const days   = this.rangeDays();
    const colors = this.colorMap();
    const isCustom = this.selectedRange() === 'custom';
    const from = isCustom ? this.customFrom() : undefined;
    const to   = isCustom ? this.customTo() : undefined;
    return this.addedStocks().map(stock => {
      const color    = colors.get(stock.isin) ?? COLORS[0];
      const filtered = filterByRange(stock.data, days, from, to);
      if (filtered.length === 0) {
        return { isin: stock.isin, symbol: stock.symbol, name: stock.name, color, noData: true, lastClose: null, change: null, pctChange: null, lastDate: null, firstDate: null };
      }
      const first     = filtered[0];
      const last      = filtered[filtered.length - 1];
      const change    = filtered.length > 1 ? parseFloat((last.close - first.close).toFixed(2)) : null;
      const pctChange = filtered.length > 1 && first.close !== 0
        ? parseFloat(((last.close - first.close) / first.close * 100).toFixed(2))
        : null;
      return { isin: stock.isin, symbol: stock.symbol, name: stock.name, color, noData: false, lastClose: last.close, change, pctChange, lastDate: last.date, firstDate: first.date };
    }).sort((a, b) => {
      if (a.pctChange === null && b.pctChange === null) return 0;
      if (a.pctChange === null) return 1;
      if (b.pctChange === null) return -1;
      return b.pctChange - a.pctChange;
    });
  });

  readonly pctChangeData = computed(() => {
    const dates = this.unionDates();
    return this.tickerDatasets().map(ds => {
      const pctMap = new Map(ds.points.map(p => [p.date, p.pct]));
      return dates.map(d => pctMap.get(d) ?? null);
    });
  });

  readonly hasChartData = computed(() =>
    this.tickerDatasets().some(ds => ds.points.length > 0)
  );

  // ── Methods ─────────────────────────────────────────────────────────────

  onSearchInput(q: string): void {
    this.searchQuery.set(q);
    if (this.searchDebounce) clearTimeout(this.searchDebounce);
    const trimmed = q.trim();
    if (!trimmed) {
      this.searchResults.set([]);
      this.searchLoading.set(false);
      this.searchError.set('');
      return;
    }
    this.searchLoading.set(true);
    this.searchDebounce = setTimeout(() => this.fetchSearch(trimmed), 300);
  }

  private fetchSearch(q: string): void {
    if (q.length < 2) {
      this.searchResults.set([]);
      this.searchLoading.set(false);
      return;
    }
    this.http.get<SearchResponse>(`${API_BASE}/search?q=${encodeURIComponent(q)}&limit=10`).subscribe({
      next: res => {
        this.searchResults.set(res.results ?? []);
        this.searchLoading.set(false);
        this.searchError.set('');
      },
      error: () => {
        this.searchLoading.set(false);
        this.searchError.set('Search failed. Please try again.');
      },
    });
  }

  addStock(result: SearchResult): void {
    if (this.addedStocks().some(s => s.isin === result.isin)) {
      this.showError(`${result.nse_symbol} is already in the comparison.`);
      return;
    }
    if (this.loadingIsins().has(result.isin)) return;

    this.loadingIsins.update(s => { const n = new Set(s); n.add(result.isin); return n; });
    this.searchQuery.set('');
    this.searchResults.set([]);

    const endDate   = toDateStr(new Date());
    const startDate = toDateStr(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

    this.http.get<ApiStockResponse>(
      `${API_BASE}/stocks/${result.isin}?start_date=${startDate}&end_date=${endDate}`
    ).subscribe({
      next: res => {
        const data = (res.nse?.data ?? []).sort((a, b) => a.date.localeCompare(b.date));
        this.addedStocks.update(list => [
          ...list,
          { isin: result.isin, symbol: result.nse_symbol, name: result.name, data },
        ]);
        this.loadingIsins.update(s => { const n = new Set(s); n.delete(result.isin); return n; });
      },
      error: () => {
        this.loadingIsins.update(s => { const n = new Set(s); n.delete(result.isin); return n; });
        this.showError(`Failed to load data for ${result.nse_symbol}.`);
      },
    });
  }

  removeStock(isin: string): void {
    this.addedStocks.update(list => list.filter(s => s.isin !== isin));
  }

  clearAll(): void {
    this.addedStocks.set([]);
  }

  setRange(key: RangeKey): void {
    if (key === 'custom') {
      this.showDatePicker.update(v => !v);
      if (this.selectedRange() !== 'custom') {
        this.selectedRange.set(key);
      }
    } else {
      this.selectedRange.set(key);
      this.showDatePicker.set(false);
    }
  }

  isAdded(isin: string): boolean {
    return this.addedStocks().some(s => s.isin === isin);
  }

  isLoading(isin: string): boolean {
    return this.loadingIsins().has(isin);
  }

  tickerColor(isin: string): string {
    return this.colorMap().get(isin) ?? COLORS[0];
  }

  activeRangeLabel(): string {
    if (this.selectedRange() === 'custom' && this.customFrom() && this.customTo()) {
      return `${this.customFrom()} to ${this.customTo()}`;
    }
    return RANGE_OPTIONS.find(r => r.key === this.selectedRange())?.label ?? '';
  }

  private showError(msg: string): void {
    this.addError.set(msg);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.addError.set(''), 3000);
  }
}
