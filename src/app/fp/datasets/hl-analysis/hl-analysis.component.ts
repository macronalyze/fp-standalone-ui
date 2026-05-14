import { Component, Input, computed, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import rawData from './importExport.json';
import { CommodityMap, IMPORT_COMMODITY_MAP, EXPORT_COMMODITY_MAP } from './commodity-maps';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

interface NormRecord {
  commodity: string;
  country: string;
  usd: number;
  isImport: boolean;
  isExport: boolean;
  period: string;
  periodLabel: string;
}

interface CountryRow {
  country: string;
  toUsd:   number;
  prevUsd: number;
  pct:     number | null;
}

interface SubRow {
  rawKey:      string;
  country:     string;
  toUsd:       number;
  prevUsd:     number;
  pct:         number | null;
  countryRows: CountryRow[];
}

interface TableRow {
  label:   string;
  country: string;
  toUsd:   number;
  prevUsd: number;
  pct:     number | null;
  subRows: SubRow[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Module-level constants — parsed once at app startup
// ═══════════════════════════════════════════════════════════════════════════

const MONTH_NUM: Record<string, number> = {
  Jan: 1, January: 1, Feb: 2, Mar: 3, March: 3,
  Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8,
  Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

const MONTH_ABBR: Record<number, string> = {
  1: 'Jan', 2: 'Feb', 3: 'Mar', 4: 'Apr',  5: 'May', 6: 'Jun',
  7: 'Jul', 8: 'Aug', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dec',
};

function toPeriodKey(month: string, year: number): string {
  const m = MONTH_NUM[month] ?? 1;
  return `${year}-${String(m).padStart(2, '0')}`;
}

export function labelFromPeriod(period: string): string {
  if (!period) return '';
  const [y, m] = period.split('-').map(Number);
  return `${MONTH_ABBR[m] ?? ''} ${y}`;
}

const ALL_RECORDS: NormRecord[] = (rawData as any[]).map(r => {
  const period = toPeriodKey(r.Month as string, r.Year as number);
  return {
    commodity: r.Commodity as string,
    country:   (r['Country of Destination'] ?? r['Country of Consignment'] ?? '') as string,
    usd:       typeof r.USD === 'number' ? r.USD : 0,
    isImport:  r.Imported === true,
    isExport:  r.Exported === true,
    period,
    periodLabel: labelFromPeriod(period),
  };
});

const ALL_DATA_PERIODS: string[] =
  [...new Set(ALL_RECORDS.map(r => r.period))].sort();

const MIN_PERIOD = ALL_DATA_PERIODS[0];
const MAX_PERIOD = ALL_DATA_PERIODS[ALL_DATA_PERIODS.length - 1];

function buildKeyIndex(maps: CommodityMap[]): Map<string, CommodityMap> {
  const idx = new Map<string, CommodityMap>();
  for (const entry of maps) {
    for (const k of entry.keys) idx.set(k, entry);
  }
  return idx;
}

const IMPORT_KEY_INDEX = buildKeyIndex(IMPORT_COMMODITY_MAP);
const EXPORT_KEY_INDEX = buildKeyIndex(EXPORT_COMMODITY_MAP);

function countriesForSide(isImport: boolean): string[] {
  const keyIndex = isImport ? IMPORT_KEY_INDEX : EXPORT_KEY_INDEX;
  const set = new Set<string>();
  for (const r of ALL_RECORDS) {
    if (isImport ? r.isImport : r.isExport) {
      if (keyIndex.has(r.commodity) && r.country) set.add(r.country);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

const IMPORT_COUNTRIES = countriesForSide(true);
const EXPORT_COUNTRIES = countriesForSide(false);

function generatePeriodRange(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const periods: string[] = [];
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    periods.push(`${y}-${String(m).padStart(2, '0')}`);
    m++; if (m > 12) { m = 1; y++; }
  }
  return periods;
}

function calcMom(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return parseFloat(((current - previous) / previous * 100).toFixed(2));
}

// ═══════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════

@Component({
  selector: 'app-hl-analysis',
  standalone: true,
  imports: [NgChartsModule, RouterLink, FormsModule],
  templateUrl: './hl-analysis.component.html',
  styleUrl:    './hl-analysis.component.css',
})
export class HlAnalysisComponent {
  @Input() country: string = '';

  readonly minPeriod        = MIN_PERIOD;
  readonly maxPeriod        = MAX_PERIOD;
  readonly importCommodities = IMPORT_COMMODITY_MAP;
  readonly exportCommodities = EXPORT_COMMODITY_MAP;
  readonly importCountries  = IMPORT_COUNTRIES;
  readonly exportCountries  = EXPORT_COUNTRIES;
  readonly labelFromPeriod  = labelFromPeriod;

  fromPeriod = signal<string>(MIN_PERIOD);
  toPeriod   = signal<string>(MAX_PERIOD);

  impSelectedComms   = signal<string[]>([]);
  impSelectedCountry = signal<string>('');
  impCommSearch      = signal('');
  impDropOpen        = signal(false);
  impExpandedRows    = signal<Set<string>>(new Set());
  impExpandedSubRows = signal<Set<string>>(new Set());

  expSelectedComms   = signal<string[]>([]);
  expSelectedCountry = signal<string>('');
  expCommSearch      = signal('');
  expDropOpen        = signal(false);
  expExpandedRows    = signal<Set<string>>(new Set());
  expExpandedSubRows = signal<Set<string>>(new Set());

  readonly periodRange = computed<string[]>(() =>
    generatePeriodRange(this.fromPeriod(), this.toPeriod())
  );

  readonly comparisonPeriods = computed(() => {
    const from = this.fromPeriod();
    const to   = this.toPeriod();
    const toDataPeriod   = ALL_DATA_PERIODS.filter(p => p <= to).at(-1)  ?? '';
    const prevDataPeriod = ALL_DATA_PERIODS.filter(p => p >= from).at(0) ?? '';
    if (!prevDataPeriod || !toDataPeriod || prevDataPeriod === toDataPeriod) {
      return { toDataPeriod, prevDataPeriod: '' };
    }
    return { toDataPeriod, prevDataPeriod };
  });

  get comparisonLabel(): string {
    const { prevDataPeriod, toDataPeriod } = this.comparisonPeriods();
    if (!prevDataPeriod || !toDataPeriod) return '';
    return `${labelFromPeriod(prevDataPeriod)} → ${labelFromPeriod(toDataPeriod)}`;
  }

  readonly impFilteredCommList = computed(() => {
    const q = this.impCommSearch().toLowerCase().trim();
    return q
      ? IMPORT_COMMODITY_MAP.filter(c => c.label.toLowerCase().includes(q))
      : IMPORT_COMMODITY_MAP;
  });

  readonly impIsAllFiltered = computed(() => {
    const filtered = this.impFilteredCommList();
    return filtered.length > 0 && filtered.every(c => this.impSelectedComms().includes(c.label));
  });

  readonly impFilteredRecords = computed((): NormRecord[] => {
    const from    = this.fromPeriod();
    const to      = this.toPeriod();
    const country = this.impSelectedCountry();
    const selComms = this.impSelectedComms();

    const allowedKeys: Set<string> = selComms.length === 0
      ? new Set(IMPORT_KEY_INDEX.keys())
      : new Set(
          IMPORT_COMMODITY_MAP
            .filter(m => selComms.includes(m.label))
            .flatMap(m => m.keys)
        );

    return ALL_RECORDS.filter(r =>
      r.isImport &&
      r.period >= from && r.period <= to &&
      allowedKeys.has(r.commodity) &&
      (!country || r.country === country)
    );
  });

  readonly impLineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const periods = this.periodRange();
    const records = this.impFilteredRecords();

    const totals: Record<string, number> = {};
    for (const p of periods) totals[p] = 0;
    for (const r of records) {
      if (IMPORT_KEY_INDEX.has(r.commodity)) {
        totals[r.period] = (totals[r.period] ?? 0) + r.usd;
      }
    }

    const toM = (v: number) => parseFloat((v / 1_000_000).toFixed(3));
    return {
      labels: periods.map(labelFromPeriod),
      datasets: [{
        label:           'Total Imports',
        data:            periods.map(p => toM(totals[p] ?? 0)),
        borderColor:     '#4e79a7',
        backgroundColor: '#4e79a733',
        tension:         0.3,
        fill:            true,
        pointRadius:     4,
        spanGaps:        true,
      }],
    };
  });

  readonly impChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      title:  { display: true, text: 'Total Import Value (USD Millions)' },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y != null ? ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : 'N/A'} M`,
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'USD Millions' },
        ticks: { callback: v => '$' + Number(v).toLocaleString('en-IN') + ' M' },
      },
      x: { title: { display: true, text: 'Period' } },
    },
  };

  readonly impTableData = computed((): TableRow[] => {
    const { toDataPeriod, prevDataPeriod } = this.comparisonPeriods();
    if (!toDataPeriod) return [];

    const records   = this.impFilteredRecords();
    const byCountry = !!this.impSelectedCountry();

    const toMap:             Record<string, number>      = {};
    const prevMap:           Record<string, number>      = {};
    const subToMap:          Record<string, number>      = {};
    const subPrevMap:        Record<string, number>      = {};
    const cToMap:            Record<string, number>      = {};
    const cPrevMap:          Record<string, number>      = {};
    const subCountries:      Record<string, Set<string>> = {};

    for (const r of records) {
      const entry = IMPORT_KEY_INDEX.get(r.commodity);
      if (!entry) continue;
      const parentKey   = byCountry ? `${entry.label}|${r.country}` : entry.label;
      const subKey      = byCountry
        ? `${entry.label}|${r.commodity}|${r.country}`
        : `${entry.label}|${r.commodity}`;
      const countryKey  = `${entry.label}|${r.commodity}|${r.country}`;
      const baseSubKey  = `${entry.label}|${r.commodity}`;

      if (r.period === toDataPeriod) {
        toMap[parentKey]    = (toMap[parentKey]    ?? 0) + r.usd;
        subToMap[subKey]    = (subToMap[subKey]    ?? 0) + r.usd;
        if (!byCountry) cToMap[countryKey]   = (cToMap[countryKey]   ?? 0) + r.usd;
      }
      if (r.period === prevDataPeriod) {
        prevMap[parentKey]  = (prevMap[parentKey]  ?? 0) + r.usd;
        subPrevMap[subKey]  = (subPrevMap[subKey]  ?? 0) + r.usd;
        if (!byCountry) cPrevMap[countryKey] = (cPrevMap[countryKey] ?? 0) + r.usd;
      }
      if (!byCountry && r.country) {
        if (!subCountries[baseSubKey]) subCountries[baseSubKey] = new Set();
        subCountries[baseSubKey].add(r.country);
      }
    }

    const toM = (v: number) => parseFloat((v / 1_000_000).toFixed(3));

    return Object.keys(toMap).map(parentKey => {
      const sepIdx  = parentKey.indexOf('|');
      const label   = sepIdx === -1 ? parentKey : parentKey.slice(0, sepIdx);
      const country = sepIdx === -1 ? 'All Countries' : parentKey.slice(sepIdx + 1);
      const toUsd   = toM(toMap[parentKey]);
      const prevUsd = toM(prevMap[parentKey] ?? 0);

      const entry = IMPORT_COMMODITY_MAP.find(m => m.label === label);
      const subRows: SubRow[] = (entry?.keys ?? []).map(rawKey => {
        const subKey  = byCountry ? `${label}|${rawKey}|${country}` : `${label}|${rawKey}`;
        const subTo   = toM(subToMap[subKey]   ?? 0);
        const subPrev = toM(subPrevMap[subKey] ?? 0);

        const countryRows: CountryRow[] = byCountry ? [] :
          [...(subCountries[`${label}|${rawKey}`] ?? [])].map(c => {
            const cKey  = `${label}|${rawKey}|${c}`;
            const cTo   = toM(cToMap[cKey]   ?? 0);
            const cPrev = toM(cPrevMap[cKey] ?? 0);
            return { country: c, toUsd: cTo, prevUsd: cPrev, pct: calcMom(cTo, cPrev) };
          }).filter(c => c.toUsd > 0 || c.prevUsd > 0)
            .sort((a, b) => b.toUsd - a.toUsd);

        return { rawKey, country: byCountry ? country : 'All Countries',
                 toUsd: subTo, prevUsd: subPrev, pct: calcMom(subTo, subPrev), countryRows };
      }).filter(s => s.toUsd > 0 || s.prevUsd > 0);

      return { label, country, toUsd, prevUsd, pct: calcMom(toUsd, prevUsd), subRows };
    }).sort((a, b) => {
      if (a.pct === null && b.pct === null) return b.toUsd - a.toUsd;
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
  });

  readonly expFilteredCommList = computed(() => {
    const q = this.expCommSearch().toLowerCase().trim();
    return q
      ? EXPORT_COMMODITY_MAP.filter(c => c.label.toLowerCase().includes(q))
      : EXPORT_COMMODITY_MAP;
  });

  readonly expIsAllFiltered = computed(() => {
    const filtered = this.expFilteredCommList();
    return filtered.length > 0 && filtered.every(c => this.expSelectedComms().includes(c.label));
  });

  readonly expFilteredRecords = computed((): NormRecord[] => {
    const from    = this.fromPeriod();
    const to      = this.toPeriod();
    const country = this.expSelectedCountry();
    const selComms = this.expSelectedComms();

    const allowedKeys: Set<string> = selComms.length === 0
      ? new Set(EXPORT_KEY_INDEX.keys())
      : new Set(
          EXPORT_COMMODITY_MAP
            .filter(m => selComms.includes(m.label))
            .flatMap(m => m.keys)
        );

    return ALL_RECORDS.filter(r =>
      r.isExport &&
      r.period >= from && r.period <= to &&
      allowedKeys.has(r.commodity) &&
      (!country || r.country === country)
    );
  });

  readonly expLineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const periods = this.periodRange();
    const records = this.expFilteredRecords();

    const totals: Record<string, number> = {};
    for (const p of periods) totals[p] = 0;
    for (const r of records) {
      if (EXPORT_KEY_INDEX.has(r.commodity)) {
        totals[r.period] = (totals[r.period] ?? 0) + r.usd;
      }
    }

    const toM = (v: number) => parseFloat((v / 1_000_000).toFixed(3));
    return {
      labels: periods.map(labelFromPeriod),
      datasets: [{
        label:           'Total Exports',
        data:            periods.map(p => toM(totals[p] ?? 0)),
        borderColor:     '#59a14f',
        backgroundColor: '#59a14f33',
        tension:         0.3,
        fill:            true,
        pointRadius:     4,
        spanGaps:        true,
      }],
    };
  });

  readonly expChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      title:  { display: true, text: 'Total Export Value (USD Millions)' },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: $${ctx.parsed.y != null ? ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 3 }) : 'N/A'} M`,
        },
      },
    },
    scales: {
      y: {
        title: { display: true, text: 'USD Millions' },
        ticks: { callback: v => '$' + Number(v).toLocaleString('en-IN') + ' M' },
      },
      x: { title: { display: true, text: 'Period' } },
    },
  };

  readonly expTableData = computed((): TableRow[] => {
    const { toDataPeriod, prevDataPeriod } = this.comparisonPeriods();
    if (!toDataPeriod) return [];

    const records   = this.expFilteredRecords();
    const byCountry = !!this.expSelectedCountry();

    const toMap:        Record<string, number>      = {};
    const prevMap:      Record<string, number>      = {};
    const subToMap:     Record<string, number>      = {};
    const subPrevMap:   Record<string, number>      = {};
    const cToMap:       Record<string, number>      = {};
    const cPrevMap:     Record<string, number>      = {};
    const subCountries: Record<string, Set<string>> = {};

    for (const r of records) {
      const entry = EXPORT_KEY_INDEX.get(r.commodity);
      if (!entry) continue;
      const parentKey  = byCountry ? `${entry.label}|${r.country}` : entry.label;
      const subKey     = byCountry
        ? `${entry.label}|${r.commodity}|${r.country}`
        : `${entry.label}|${r.commodity}`;
      const countryKey = `${entry.label}|${r.commodity}|${r.country}`;
      const baseSubKey = `${entry.label}|${r.commodity}`;

      if (r.period === toDataPeriod) {
        toMap[parentKey]   = (toMap[parentKey]   ?? 0) + r.usd;
        subToMap[subKey]   = (subToMap[subKey]   ?? 0) + r.usd;
        if (!byCountry) cToMap[countryKey]   = (cToMap[countryKey]   ?? 0) + r.usd;
      }
      if (r.period === prevDataPeriod) {
        prevMap[parentKey]  = (prevMap[parentKey]  ?? 0) + r.usd;
        subPrevMap[subKey]  = (subPrevMap[subKey]  ?? 0) + r.usd;
        if (!byCountry) cPrevMap[countryKey] = (cPrevMap[countryKey] ?? 0) + r.usd;
      }
      if (!byCountry && r.country) {
        if (!subCountries[baseSubKey]) subCountries[baseSubKey] = new Set();
        subCountries[baseSubKey].add(r.country);
      }
    }

    const toM = (v: number) => parseFloat((v / 1_000_000).toFixed(3));

    return Object.keys(toMap).map(parentKey => {
      const sepIdx  = parentKey.indexOf('|');
      const label   = sepIdx === -1 ? parentKey : parentKey.slice(0, sepIdx);
      const country = sepIdx === -1 ? 'All Countries' : parentKey.slice(sepIdx + 1);
      const toUsd   = toM(toMap[parentKey]);
      const prevUsd = toM(prevMap[parentKey] ?? 0);

      const entry = EXPORT_COMMODITY_MAP.find(m => m.label === label);
      const subRows: SubRow[] = (entry?.keys ?? []).map(rawKey => {
        const subKey  = byCountry ? `${label}|${rawKey}|${country}` : `${label}|${rawKey}`;
        const subTo   = toM(subToMap[subKey]   ?? 0);
        const subPrev = toM(subPrevMap[subKey] ?? 0);

        const countryRows: CountryRow[] = byCountry ? [] :
          [...(subCountries[`${label}|${rawKey}`] ?? [])].map(c => {
            const cKey  = `${label}|${rawKey}|${c}`;
            const cTo   = toM(cToMap[cKey]   ?? 0);
            const cPrev = toM(cPrevMap[cKey] ?? 0);
            return { country: c, toUsd: cTo, prevUsd: cPrev, pct: calcMom(cTo, cPrev) };
          }).filter(c => c.toUsd > 0 || c.prevUsd > 0)
            .sort((a, b) => b.toUsd - a.toUsd);

        return { rawKey, country: byCountry ? country : 'All Countries',
                 toUsd: subTo, prevUsd: subPrev, pct: calcMom(subTo, subPrev), countryRows };
      }).filter(s => s.toUsd > 0 || s.prevUsd > 0);

      return { label, country, toUsd, prevUsd, pct: calcMom(toUsd, prevUsd), subRows };
    }).sort((a, b) => {
      if (a.pct === null && b.pct === null) return b.toUsd - a.toUsd;
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
  });

  setFromPeriod(value: string): void {
    this.fromPeriod.set(value);
    if (value > this.toPeriod()) this.toPeriod.set(value);
  }

  setToPeriod(value: string): void {
    this.toPeriod.set(value);
    if (value < this.fromPeriod()) this.fromPeriod.set(value);
  }

  isImpCommSelected(label: string): boolean {
    return this.impSelectedComms().includes(label);
  }

  toggleImpComm(label: string): void {
    const cur = this.impSelectedComms();
    this.impSelectedComms.set(
      cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label]
    );
  }

  toggleAllImpFiltered(): void {
    const filtered = this.impFilteredCommList().map(c => c.label);
    const cur = this.impSelectedComms();
    if (this.impIsAllFiltered()) {
      this.impSelectedComms.set(cur.filter(c => !filtered.includes(c)));
    } else {
      const toAdd = filtered.filter(c => !cur.includes(c));
      this.impSelectedComms.set([...cur, ...toAdd]);
    }
  }

  clearImpComms(): void {
    this.impSelectedComms.set([]);
    this.impCommSearch.set('');
  }

  removeImpComm(label: string): void {
    this.impSelectedComms.update(cur => cur.filter(x => x !== label));
  }

  toggleImpDrop(): void {
    this.impDropOpen.update(v => !v);
    if (this.impDropOpen()) this.expDropOpen.set(false);
  }

  isExpCommSelected(label: string): boolean {
    return this.expSelectedComms().includes(label);
  }

  toggleExpComm(label: string): void {
    const cur = this.expSelectedComms();
    this.expSelectedComms.set(
      cur.includes(label) ? cur.filter(x => x !== label) : [...cur, label]
    );
  }

  toggleAllExpFiltered(): void {
    const filtered = this.expFilteredCommList().map(c => c.label);
    const cur = this.expSelectedComms();
    if (this.expIsAllFiltered()) {
      this.expSelectedComms.set(cur.filter(c => !filtered.includes(c)));
    } else {
      const toAdd = filtered.filter(c => !cur.includes(c));
      this.expSelectedComms.set([...cur, ...toAdd]);
    }
  }

  clearExpComms(): void {
    this.expSelectedComms.set([]);
    this.expCommSearch.set('');
  }

  removeExpComm(label: string): void {
    this.expSelectedComms.update(cur => cur.filter(x => x !== label));
  }

  toggleExpDrop(): void {
    this.expDropOpen.update(v => !v);
    if (this.expDropOpen()) this.impDropOpen.set(false);
  }

  isImpRowExpanded(key: string): boolean {
    return this.impExpandedRows().has(key);
  }

  toggleImpRow(key: string): void {
    this.impExpandedRows.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isImpSubRowExpanded(key: string): boolean {
    return this.impExpandedSubRows().has(key);
  }

  toggleImpSubRow(key: string, event: MouseEvent): void {
    event.stopPropagation();
    this.impExpandedSubRows.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isExpRowExpanded(key: string): boolean {
    return this.expExpandedRows().has(key);
  }

  toggleExpRow(key: string): void {
    this.expExpandedRows.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  isExpSubRowExpanded(key: string): boolean {
    return this.expExpandedSubRows().has(key);
  }

  toggleExpSubRow(key: string, event: MouseEvent): void {
    event.stopPropagation();
    this.expExpandedSubRows.update(s => {
      const next = new Set(s);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const t = e.target as HTMLElement;
    if (!t.closest('.hl-imp-comm-wrapper')) this.impDropOpen.set(false);
    if (!t.closest('.hl-exp-comm-wrapper')) this.expDropOpen.set(false);
  }
}
