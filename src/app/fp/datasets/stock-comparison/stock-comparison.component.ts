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

export type RangeKey = '7d' | '15d' | '21d' | '1m' | '2m' | '3m' | '6m' | '1y';

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d',  label: '7 Day',   days: 7   },
  { key: '15d', label: '15 Day',  days: 15  },
  { key: '21d', label: '21 Day',  days: 21  },
  { key: '1m',  label: '1 Month', days: 30  },
  { key: '2m',  label: '2 Month', days: 60  },
  { key: '3m',  label: '3 Month', days: 90  },
  { key: '6m',  label: '6 Month', days: 180 },
  { key: '1y',  label: '1 Year',  days: 365 },
];

const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#edc948',
];

const API_BASE = '/fp/api/v1';

// ── Utilities ────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0];
}

function filterByRange(data: ApiDataPoint[], days: number): ApiDataPoint[] {
  if (data.length === 0) return [];
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

  selectedRange = signal<RangeKey>('7d');
  addError      = signal<string>('');

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
    return this.addedStocks().map(stock => {
      const color    = colors.get(stock.isin) ?? COLORS[0];
      const filtered = filterByRange(stock.data, days);
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
    const days     = this.rangeDays();
    const datasets = this.tickerDatasets().map(ds => {
      const pctMap = new Map(ds.points.map(p => [p.date, p.pct]));
      return {
        label:           ds.symbol,
        data:            dates.map(d => pctMap.has(d) ? pctMap.get(d)! : null),
        borderColor:     ds.color,
        backgroundColor: ds.color + '22',
        tension:         0.3,
        fill:            false,
        pointRadius:     4,
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
    interaction: { mode: 'nearest', intersect: true },
    plugins: {
      legend: { display: true, position: 'top' },
      title:  { display: true, text: 'Stock % Growth Comparison (Base = first day of range -> 0%)' },
      tooltip: {
        callbacks: {
          label: ctx => {
            const v = ctx.parsed.y;
            return v != null
              ? `${ctx.dataset.label}: ${v >= 0 ? '+' : ''}${v}%`
              : `${ctx.dataset.label}: N/A`;
          },
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: '% Growth' },
        ticks: { callback: v => `${v}%` },
      },
      x: {
        title: { display: true, text: 'Date' },
        ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
      },
    },
  };

  readonly summaryRows = computed(() => {
    const days   = this.rangeDays();
    const colors = this.colorMap();
    return this.addedStocks().map(stock => {
      const color    = colors.get(stock.isin) ?? COLORS[0];
      const filtered = filterByRange(stock.data, days);
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
    this.selectedRange.set(key);
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
    return RANGE_OPTIONS.find(r => r.key === this.selectedRange())?.label ?? '';
  }

  private showError(msg: string): void {
    this.addError.set(msg);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.addError.set(''), 3000);
  }
}
