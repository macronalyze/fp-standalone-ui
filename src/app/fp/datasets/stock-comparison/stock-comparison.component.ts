import { Component, Input, computed, effect, signal, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { environment } from '../../../../environments/environment';

// ── API interfaces ──────────────────────────────────────────────────────────

interface SearchResult {
  isin: string;
  name: string;
  // Either may be missing: a stock can be listed only on NSE or only on BSE.
  nse_symbol?: string | null;
  bse_code?: number | null;
  industry?: string | null;
  sector?: string | null;
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
  // Either exchange may be absent depending on where the stock is listed.
  nse?: { count: number; data: ApiDataPoint[] } | null;
  bse?: { count: number; data: ApiDataPoint[] } | null;
}

type Exchange = 'nse' | 'bse';

interface AddedStock {
  isin: string;
  symbol: string;
  name: string;
  /** Exchange whose price series backs this stock (NSE preferred, BSE fallback). */
  exchange: Exchange;
  data: ApiDataPoint[];
  mcap?: McapDataPoint[];
  mcapLoaded?: boolean;
}

interface McapDataPoint {
  date: string;
  face_value: number | null;
  issue_size: number | null;
  market_cap: number | null;
}

interface McapApiResponse {
  isin: string;
  source: string;
  count: number;
  data: McapDataPoint[];
}

// ── Constants ───────────────────────────────────────────────────────────────

export type RangeKey = '7d' | '15d' | '21d' | '1m' | '2m' | '3m' | '6m' | '1y' | 'custom';

export const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d',  label: '7D',   days: 7   },
  { key: '15d', label: '15D',  days: 15  },
  { key: '21d', label: '21D',  days: 21  },
  { key: '1m',  label: '1M', days: 30  },
  { key: '2m',  label: '2M', days: 60  },
  { key: '3m',  label: '3M', days: 90  },
  { key: '6m',  label: '6M', days: 180 },
  { key: '1y',  label: '1Y',  days: 365 },
  { key: 'custom', label: 'Custom', days: 0 },
];

const COLORS = [
  '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f',
  '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#edc948',
];

const API_BASE = environment.apiUrl;

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
  // Predefined ranges (7D / 21D / 1M / ...) are anchored to today's date
  // so price and mcap series always share the same window, regardless of
  // when the most recent data point was ingested.
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  return data.filter(d => {
    const dt = new Date(d.date);
    return dt >= cutoff && dt <= today;
  });
}

function fmtLabel(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  if (days <= 90) {
    return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

function mergeByDate(a: ApiDataPoint[], b: ApiDataPoint[]): ApiDataPoint[] {
  const map = new Map<string, ApiDataPoint>();
  for (const p of a) map.set(p.date, p);
  for (const p of b) map.set(p.date, p);
  return [...map.values()].sort((x, y) => x.date.localeCompare(y.date));
}

function mergeMcapByDate(a: McapDataPoint[], b: McapDataPoint[]): McapDataPoint[] {
  const map = new Map<string, McapDataPoint>();
  for (const p of a) map.set(p.date, p);
  for (const p of b) map.set(p.date, p);
  return [...map.values()].sort((x, y) => x.date.localeCompare(y.date));
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
  loadingMcapIsins = signal<Set<string>>(new Set());
  showMarketCap = signal<boolean>(false);

  selectedRange   = signal<RangeKey>('7d');
  compareMode      = signal<'price' | 'growth'>('price');
  chartMode        = signal<'line' | 'area'>('line');
  xAxisIntervalDays = signal<number>(1);
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

  private errorTimer:        ReturnType<typeof setTimeout> | null = null;
  private searchDebounce:    ReturnType<typeof setTimeout> | null = null;
  private customFetchTimer:  ReturnType<typeof setTimeout> | null = null;
  private mcapFetchTimer:    ReturnType<typeof setTimeout> | null = null;

  // Per-ISIN cache of already-fetched custom ranges ("from|to") to avoid duplicate calls.
  private readonly customFetchedRanges = new Map<string, Set<string>>();
  private readonly mcapFetchedRanges   = new Map<string, Set<string>>();

  constructor() {
    // When the user picks a custom date range, ensure each added stock has data
    // covering it. The initial fetch in addStock() only loads the last 365 days,
    // so custom ranges outside that window need an additional API call.
    effect(() => {
      if (this.selectedRange() !== 'custom') return;
      const from = this.customFrom();
      const to   = this.customTo();
      // Touch addedStocks so the effect re-runs when stocks are added/removed
      // while the custom range is active.
      this.addedStocks();
      if (!from || !to || from > to) return;

      if (this.customFetchTimer) clearTimeout(this.customFetchTimer);
      this.customFetchTimer = setTimeout(() => this.ensureCustomRangeData(from, to), 400);
    });

    // When the market-cap toggle is on and exactly one stock is added,
    // ensure mcap data is loaded for the active range. Mirrors the price
    // fetch pattern: initial 365-day window, plus on-demand for custom ranges
    // outside that window. Writes are deferred via queueMicrotask to avoid
    // NG0600 (no signal writes inside an effect).
    effect(() => {
      if (!this.showMarketCap()) return;
      const stocks = this.addedStocks();
      if (stocks.length !== 1) return;
      const stock = stocks[0];

      const isCustom = this.selectedRange() === 'custom';
      const from = isCustom ? this.customFrom() : undefined;
      const to   = isCustom ? this.customTo() : undefined;

      // Initial fetch (last 365 days) the first time the toggle is on.
      if (!stock.mcapLoaded) {
        if (this.loadingMcapIsins().has(stock.isin)) return;
        queueMicrotask(() => this.fetchMcap(stock.isin));
        return;
      }

      // Custom range outside what we've fetched -> fetch additional.
      if (isCustom && from && to && from <= to) {
        if (this.mcapFetchTimer) clearTimeout(this.mcapFetchTimer);
        this.mcapFetchTimer = setTimeout(() => this.fetchMcap(stock.isin, from, to), 400);
      }
    });
  }

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
    // When mcap is shown on a single stock, include mcap dates so bars are
    // visible even on dates that have no price entry in the active range.
    if (this.showMarketCap() && this.addedStocks().length === 1) {
      this.mcapFiltered().forEach(p => all.add(p.date));
    }
    return [...all].sort();
  });

  private readonly sampledDates = computed<string[]>(() => {
    const dates = this.unionDates();
    const intervalDays = Math.max(1, Math.floor(Number(this.xAxisIntervalDays()) || 1));

    if (intervalDays <= 1 || dates.length <= 1) {
      return dates;
    }

    const sampled: string[] = [];
    let lastIncludedTime: number | null = null;

    for (const date of dates) {
      const currentTime = new Date(date).getTime();
      if (lastIncludedTime === null || currentTime - lastIncludedTime >= intervalDays * 86400000) {
        sampled.push(date);
        lastIncludedTime = currentTime;
      }
    }

    return sampled;
  });

  readonly lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const dates    = this.sampledDates();
    let days = this.rangeDays();
    if (days === 0 && dates.length >= 2) {
      days = Math.round((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / 86400000);
    }
    const datasets: ChartConfiguration<'line'>['data']['datasets'] = this.tickerDatasets().map(ds => {
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
        yAxisID:         this.canShowMcapChart() ? 'y1' : 'y',
        order:           1,
      };
    });

    // Inject a bar dataset for market cap when applicable. Mixed line/bar chart.
    if (this.canShowMcapChart()) {
      const stock = this.addedStocks()[0];
      const { divisor, unit } = this.mcapScale();
      const color = this.colorMap().get(stock.isin) ?? COLORS[0];
      const mcapByDate = new Map(this.mcapFiltered().map(p => [p.date, p.market_cap ?? 0]));
      const values = dates.map(d => {
        const v = mcapByDate.get(d);
        return v != null && v > 0 ? +(v / divisor).toFixed(2) : null;
      });
      datasets.push({
        type:            'bar',
        label:           `Market Cap (₹ ${unit})`,
        data:            values,
        backgroundColor: color + '55',
        borderColor:     color + '99',
        borderWidth:     1,
        yAxisID:         'y',
        order:           2,
      } as any);
    }

    return {
      labels: dates.map(d => fmtLabel(d, days)),
      datasets,
    };
  });

  readonly growthChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const dates = this.sampledDates();
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

  readonly lineChartOptions = computed<ChartOptions<'line'>>(() => {
    const showMcap = this.canShowMcapChart();
    const { unit } = this.mcapScale();

    const scales: any = {};
    if (showMcap) {
      // Stack the two y-axes. In this Chart.js build, `y1` renders on TOP
      // and `y` on the BOTTOM of the stack. So we put price on `y1` (top, 70%)
      // and market cap on `y` (bottom, 30%).
      scales.y = {
        position: 'left',
        stack: 'main',
        stackWeight: 3,
        offset: true,
        title: { display: true, text: `\u20B9 ${unit}` },
        grid: { drawOnChartArea: true },
        ticks: { callback: (v: any) => `${(+v).toLocaleString('en-IN')}` },
        beginAtZero: true,
      };
      scales.y1 = {
        position: 'left',
        stack: 'main',
        stackWeight: 7,
        offset: true,
        title: { display: true, text: 'Price (\u20B9)' },
        ticks: { callback: (v: any) => `\u20B9${v}` },
      };
    } else {
      scales.y = {
        position: 'left',
        title: { display: true, text: 'Price (\u20B9)' },
        ticks: { callback: (v: any) => `\u20B9${v}` },
      };
    }
    scales.x = {
      title: { display: true, text: 'Date' },
      ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 },
    };

    return {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: true, position: 'top' },
        title:  { display: true, text: showMcap ? 'Stock Price & Market Cap' : 'Stock Price Comparison' },
        tooltip: {
          callbacks: {
            title: (items) => {
              const idx = items[0]?.dataIndex;
              const dates = this.sampledDates();
              if (idx != null && dates[idx]) {
                return new Date(dates[idx]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              }
              return '';
            },
            label: ctx => {
              const v = ctx.parsed.y;
              if ((ctx.dataset as any).type === 'bar') {
                // Market cap dataset
                return v != null
                  ? `${ctx.dataset.label}: ${v.toLocaleString('en-IN')}`
                  : `${ctx.dataset.label}: N/A`;
              }
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
      scales,
    };
  });

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
                const dates = this.sampledDates();
              if (idx != null && dates[idx]) {
                return new Date(dates[idx]).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
              }
              return '';
            },
            label: ctx => {
              const pct = ctx.parsed.y;
                const dates = this.sampledDates();
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
    const dates = this.sampledDates();
    return this.tickerDatasets().map(ds => {
      const pctMap = new Map(ds.points.map(p => [p.date, p.pct]));
      return dates.map(d => pctMap.get(d) ?? null);
    });
  });

  readonly hasChartData = computed(() =>
    this.tickerDatasets().some(ds => ds.points.length > 0)
  );

  // ── Market cap chart ────────────────────────────────────────────────────

  /** Whether mcap can actually be rendered (single stock + toggle on + data in range). */
  readonly canShowMcapChart = computed(() => {
    if (!this.showMarketCap()) return false;
    const stocks = this.addedStocks();
    if (stocks.length !== 1) return false;
    if (!stocks[0].mcapLoaded) return false;
    return this.mcapFiltered().length > 0;
  });

  /** Notice when the toggle is on but mcap can't render. */
  readonly mcapNotice = computed<string>(() => {
    if (!this.showMarketCap()) return '';
    const stocks = this.addedStocks();
    if (stocks.length === 0) return '';
    if (stocks.length > 1) {
      return 'Market cap view is available only when a single stock is selected. Remove other tickers to view it.';
    }
    const s = stocks[0];
    if (this.loadingMcapIsins().has(s.isin)) return 'Loading market cap data…';
    if (s.mcapLoaded && this.mcapFiltered().length === 0) {
      return 'No market cap data available for the selected range.';
    }
    return '';
  });

  /** Auto-scale: divisor + label depending on magnitude in the active range. */
  private readonly mcapScale = computed<{ divisor: number; unit: string }>(() => {
    const series = this.mcapFiltered();
    if (series.length === 0) return { divisor: 1e7, unit: 'Cr' };
    const max = Math.max(0, ...series.map(p => p.market_cap ?? 0));
    if (max >= 1e12) return { divisor: 1e12, unit: 'Lakh Cr' };
    return { divisor: 1e7, unit: 'Cr' };
  });

  /** Mcap series filtered to the active range (drives the bar chart's own x-axis). */
  private readonly mcapFiltered = computed<McapDataPoint[]>(() => {
    const stocks = this.addedStocks();
    if (stocks.length !== 1) return [];
    const stock = stocks[0];
    const days = this.rangeDays();
    const isCustom = this.selectedRange() === 'custom';
    const from = isCustom ? this.customFrom() : undefined;
    const to   = isCustom ? this.customTo() : undefined;

    const series = (stock.mcap ?? []).filter(p => p.market_cap != null && p.market_cap > 0);
    if (series.length === 0) return [];

    if (from && to) {
      return series.filter(p => p.date >= from && p.date <= to);
    }
    // Predefined ranges anchored to today, matching the price series window.
    const todayStr = toDateStr(new Date());
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = toDateStr(cutoff);
    return series.filter(p => p.date >= cutoffStr && p.date <= todayStr);
  });

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
    const fallbackLabel = this.resultLabel(result);
    if (this.addedStocks().some(s => s.isin === result.isin)) {
      this.showError(`${fallbackLabel} is already in the comparison.`);
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
        // Prefer NSE series; fall back to BSE when the stock is listed only on BSE
        // (or NSE returned no rows). Without this, BSE-only stocks render an
        // empty chart because `res.nse` is null.
        const nseData = res.nse?.data ?? [];
        const bseData = res.bse?.data ?? [];
        const useNse  = nseData.length > 0;
        const data    = (useNse ? nseData : bseData).slice().sort((a, b) => a.date.localeCompare(b.date));
        const exchange: Exchange = useNse ? 'nse' : 'bse';
        const symbol = useNse
          ? (result.nse_symbol || data[0]?.symbol || result.isin)
          : (data[0]?.symbol || (result.bse_code != null ? `BSE:${result.bse_code}` : result.isin));

        this.addedStocks.update(list => [
          ...list,
          { isin: result.isin, symbol, name: result.name, exchange, data },
        ]);
        this.loadingIsins.update(s => { const n = new Set(s); n.delete(result.isin); return n; });
      },
      error: () => {
        this.loadingIsins.update(s => { const n = new Set(s); n.delete(result.isin); return n; });
        this.showError(`Failed to load data for ${fallbackLabel}.`);
      },
    });
  }

  /** Best-effort display label for a search result (handles BSE-only listings). */
  resultLabel(result: SearchResult): string {
    if (result.nse_symbol) return result.nse_symbol;
    if (result.bse_code != null) return `BSE:${result.bse_code}`;
    return result.isin;
  }

  removeStock(isin: string): void {
    this.addedStocks.update(list => list.filter(s => s.isin !== isin));
    this.customFetchedRanges.delete(isin);
    this.mcapFetchedRanges.delete(isin);
    this.loadingMcapIsins.update(s => { const n = new Set(s); n.delete(isin); return n; });
  }

  private fetchMcap(isin: string, fromArg?: string, toArg?: string): void {
    const from = fromArg ?? toDateStr(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));
    const to   = toArg   ?? toDateStr(new Date());

    const fetchKey = `${from}|${to}`;
    const fetched  = this.mcapFetchedRanges.get(isin) ?? new Set<string>();
    if (fetched.has(fetchKey)) return;
    fetched.add(fetchKey);
    this.mcapFetchedRanges.set(isin, fetched);

    this.loadingMcapIsins.update(s => { const n = new Set(s); n.add(isin); return n; });
    const url = `${API_BASE}/mcap/${isin}?start_date=${from}&end_date=${to}`;
    this.http.get<McapApiResponse>(url).subscribe({
      next: res => {
        const fresh = (res.data ?? []).sort((a, b) => a.date.localeCompare(b.date));
        this.addedStocks.update(list => list.map(s =>
          s.isin === isin
            ? { ...s, mcap: mergeMcapByDate(s.mcap ?? [], fresh), mcapLoaded: true }
            : s
        ));
        this.loadingMcapIsins.update(s => { const n = new Set(s); n.delete(isin); return n; });
      },
      error: () => {
        // 404 = no mcap data; mark loaded with whatever we already have so we
        // don't keep retrying this exact range. Allow re-trying other ranges.
        this.addedStocks.update(list => list.map(s =>
          s.isin === isin ? { ...s, mcap: s.mcap ?? [], mcapLoaded: true } : s
        ));
        this.loadingMcapIsins.update(s => { const n = new Set(s); n.delete(isin); return n; });
      },
    });
  }

  private ensureCustomRangeData(from: string, to: string): void {
    for (const stock of this.addedStocks()) {
      if (this.loadingIsins().has(stock.isin)) continue;

      const data    = stock.data;
      const minDate = data.length > 0 ? data[0].date : null;
      const maxDate = data.length > 0 ? data[data.length - 1].date : null;

      const needsOlder = minDate === null || minDate > from;
      const needsNewer = maxDate === null || maxDate < to;
      if (!needsOlder && !needsNewer) continue;

      const fetchKey = `${from}|${to}`;
      const fetched  = this.customFetchedRanges.get(stock.isin) ?? new Set<string>();
      if (fetched.has(fetchKey)) continue;
      fetched.add(fetchKey);
      this.customFetchedRanges.set(stock.isin, fetched);

      this.loadingIsins.update(s => { const n = new Set(s); n.add(stock.isin); return n; });
      this.http.get<ApiStockResponse>(
        `${API_BASE}/stocks/${stock.isin}?start_date=${from}&end_date=${to}`
      ).subscribe({
        next: res => {
          // Merge from the same exchange the stock was originally loaded from
          // so BSE-only stocks keep getting BSE data on custom-range expansion.
          const fresh = (stock.exchange === 'bse' ? res.bse?.data : res.nse?.data) ?? [];
          this.addedStocks.update(list => list.map(s =>
            s.isin === stock.isin ? { ...s, data: mergeByDate(s.data, fresh) } : s
          ));
          this.loadingIsins.update(s => { const n = new Set(s); n.delete(stock.isin); return n; });
        },
        error: () => {
          this.loadingIsins.update(s => { const n = new Set(s); n.delete(stock.isin); return n; });
          // Allow a retry on next change.
          fetched.delete(fetchKey);
          this.showError(`Failed to load ${stock.symbol} data for ${from} → ${to}.`);
        },
      });
    }
  }

  clearAll(): void {
    this.addedStocks.set([]);
    this.customFetchedRanges.clear();
    this.mcapFetchedRanges.clear();
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

  onXAxisIntervalChange(value: string | number): void {
    const parsed = Math.max(1, Math.floor(Number(value) || 1));
    this.xAxisIntervalDays.set(parsed);
  }

  private showError(msg: string): void {
    this.addError.set(msg);
    if (this.errorTimer) clearTimeout(this.errorTimer);
    this.errorTimer = setTimeout(() => this.addError.set(''), 3000);
  }
}
