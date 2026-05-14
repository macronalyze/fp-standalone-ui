import { Component, Input, computed, signal, HostListener } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ChartConfiguration } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import iipItems from './iip-items.json';

interface IipItem {
  'NIC 5 digit': string | number | null;
  'NIC 2 Digit': string | null;
  'Item groups 2011-12': string | null;
  'Unit': string | null;
  [period: string]: string | number | null;
}

const MIN_PERIOD = '2012-04';
const MAX_PERIOD = '2026-03';
const COLORS = [
  '#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
  '#b07aa1','#ff9da7','#9c755f','#bab0ac','#edc948'
];

const ITEMS = iipItems.items as IipItem[];

const ALL_GROUPS: string[] = [...new Set(
  ITEMS
    .map(i => i['Item groups 2011-12'])
    .filter((g): g is string => g !== null && g !== undefined)
)].sort((a, b) => a.localeCompare(b));

function getPeriodsBetween(from: string, to: string): string[] {
  const periods: string[] = [];
  const [fromY, fromM] = from.split('-').map(Number);
  const [toY, toM] = to.split('-').map(Number);
  let y = fromY, m = fromM;
  while (y < toY || (y === toY && m <= toM)) {
    periods.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return periods;
}

@Component({
  selector: 'app-iip-item-charts',
  standalone: true,
  imports: [NgChartsModule, RouterLink, FormsModule],
  templateUrl: './iip-item-charts.component.html',
  styleUrl: './iip-item-charts.component.css'
})
export class IipItemChartsComponent {
  @Input() country: string = '';

  readonly allGroups = ALL_GROUPS;
  readonly minPeriod = MIN_PERIOD;
  readonly maxPeriod = MAX_PERIOD;

  selectedGroups = signal<string[]>([ALL_GROUPS[0]]);
  searchQuery = signal<string>('');
  dropdownOpen = signal<boolean>(false);
  fromPeriod = signal<string>(MIN_PERIOD);
  toPeriod = signal<string>(MAX_PERIOD);

  readonly filteredGroups = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return q ? ALL_GROUPS.filter(g => g.toLowerCase().includes(q)) : ALL_GROUPS;
  });

  private readonly filteredPeriods = computed(() =>
    getPeriodsBetween(this.fromPeriod(), this.toPeriod())
  );

  readonly effectiveGroups = computed<string[]>(() => {
    const n = this.topN();
    if (n === null) return this.selectedGroups();
    const from = this.fromPeriod();
    const to = this.toPeriod();
    return ALL_GROUPS
      .map(group => {
        const item = ITEMS.find(it => it['Item groups 2011-12'] === group);
        const fv = item && item[from] != null ? Number(item[from]) : null;
        const tv = item && item[to]   != null ? Number(item[to])   : null;
        const pct = (fv != null && tv != null && fv !== 0) ? (tv - fv) / fv * 100 : null;
        return { group, pct };
      })
      .sort((a, b) => {
        if (a.pct === null && b.pct === null) return 0;
        if (a.pct === null) return 1;
        if (b.pct === null) return -1;
        return b.pct - a.pct;
      })
      .slice(0, n)
      .map(r => r.group);
  });

  readonly groupStats = computed<{
    group: string;
    fromVal: number | null;
    toVal: number | null;
    pct: number | null;
    color: string;
    monthlyData: { period: string; value: number | null }[];
    yoyData: { period: string; prevYearPeriod: string; value: number | null; prevYearVal: number | null; yoy: number | null }[];
    momData: { period: string; prevPeriod: string; value: number | null; prevVal: number | null; mom: number | null }[];
  }[]>(() => {
    const groups = this.effectiveGroups();
    const from = this.fromPeriod();
    const to = this.toPeriod();
    const periods = getPeriodsBetween(from, to);
    return groups.map((group, i) => {
      const item = ITEMS.find(it => it['Item groups 2011-12'] === group);
      const fromVal = item && item[from] != null ? Number(item[from]) : null;
      const toVal   = item && item[to]   != null ? Number(item[to])   : null;
      const pct = (fromVal != null && toVal != null && fromVal !== 0)
        ? parseFloat(((toVal - fromVal) / fromVal * 100).toFixed(2))
        : null;

      const monthlyData = periods.map(p => ({
        period: p,
        value: item && item[p] != null ? Number(item[p]) : null
      }));

      const yoyData = periods.map(p => {
        const [y, m] = p.split('-').map(Number);
        const prevYear = `${y - 1}-${String(m).padStart(2, '0')}`;
        const curVal  = item && item[p]        != null ? Number(item[p])        : null;
        const prevVal = item && item[prevYear] != null ? Number(item[prevYear]) : null;
        const yoy = (curVal != null && prevVal != null && prevVal !== 0)
          ? parseFloat(((curVal - prevVal) / prevVal * 100).toFixed(2))
          : null;
        return { period: p, prevYearPeriod: prevYear, value: curVal, prevYearVal: prevVal, yoy };
      });

      const momData = periods.map(p => {
        const [y, m] = p.split('-').map(Number);
        const pm = m === 1 ? 12 : m - 1;
        const py = m === 1 ? y - 1 : y;
        const prevPeriod = `${py}-${String(pm).padStart(2, '0')}`;
        const curVal  = item && item[p]          != null ? Number(item[p])          : null;
        const prevVal = item && item[prevPeriod] != null ? Number(item[prevPeriod]) : null;
        const mom = (curVal != null && prevVal != null && prevVal !== 0)
          ? parseFloat(((curVal - prevVal) / prevVal * 100).toFixed(2))
          : null;
        return { period: p, prevPeriod, value: curVal, prevVal, mom };
      });

      return { group, fromVal, toVal, pct, color: COLORS[i % COLORS.length], monthlyData, yoyData, momData };
    }).sort((a, b) => {
      if (a.pct === null && b.pct === null) return 0;
      if (a.pct === null) return 1;
      if (b.pct === null) return -1;
      return b.pct - a.pct;
    });
  });

  lineChartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const groups = this.effectiveGroups();
    const periods = this.filteredPeriods();
    return {
      labels: periods,
      datasets: groups.map((group, i) => {
        const item = ITEMS.find(it => it['Item groups 2011-12'] === group);
        return {
          label: group,
          data: periods.map(p => (item && item[p] != null ? Number(item[p]) : null)) as number[],
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length] + '22',
          tension: 0.4,
          fill: false,
          pointRadius: 3,
          spanGaps: true
        };
      })
    };
  });

  lineChartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'top' },
      title: { display: true, text: 'Item Index — Line Chart' }
    },
    scales: {
      y: { title: { display: true, text: 'Index Value' } },
      x: { ticks: { maxRotation: 60, font: { size: 10 } } }
    }
  };

  barChartData = computed<ChartConfiguration<'bar'>['data']>(() => {
    const groups = this.effectiveGroups();
    const periods = this.filteredPeriods();
    return {
      labels: periods,
      datasets: groups.map((group, i) => {
        const item = ITEMS.find(it => it['Item groups 2011-12'] === group);
        return {
          label: group,
          data: periods.map(p => (item && item[p] != null ? Number(item[p]) : null)) as number[],
          backgroundColor: COLORS[i % COLORS.length] + 'bb',
          borderColor: COLORS[i % COLORS.length],
          borderWidth: 1
        };
      })
    };
  });

  barChartOptions: ChartConfiguration<'bar'>['options'] = {
    responsive: true,
    plugins: {
      legend: { display: true, position: 'top' },
      title: { display: true, text: 'Item Index — Bar Chart' }
    },
    scales: {
      y: { title: { display: true, text: 'Index Value' } },
      x: { ticks: { maxRotation: 60, font: { size: 10 } } }
    }
  };

  readonly topNOptions = [10, 20, 30];
  topN = signal<number | null>(null);

  toggleGroup(group: string): void {
    this.topN.set(null);
    const current = this.selectedGroups();
    if (current.includes(group)) {
      if (current.length > 1) {
        this.selectedGroups.set(current.filter(g => g !== group));
      }
    } else {
      this.selectedGroups.set([...current, group]);
    }
  }

  isSelected(group: string): boolean {
    return this.effectiveGroups().includes(group);
  }

  readonly isAllSelected = computed(() =>
    ALL_GROUPS.every(g => this.effectiveGroups().includes(g))
  );

  readonly isAllFilteredSelected = computed(() => {
    const filtered = this.filteredGroups();
    return filtered.length > 0 && filtered.every(g => this.effectiveGroups().includes(g));
  });

  selectAll(): void {
    this.topN.set(null);
    const filtered = this.filteredGroups();
    const current = this.selectedGroups();
    const toAdd = filtered.filter(g => !current.includes(g));
    if (toAdd.length > 0) {
      this.selectedGroups.set([...current, ...toAdd]);
    } else {
      const remaining = current.filter(g => !filtered.includes(g));
      this.selectedGroups.set(remaining.length > 0 ? remaining : [ALL_GROUPS[0]]);
    }
  }

  selectTopN(n: number): void {
    if (this.topN() === n) {
      this.topN.set(null);
    } else {
      this.topN.set(n);
    }
  }

  removeGroup(group: string): void {
    const current = this.selectedGroups();
    if (current.length > 1) {
      this.selectedGroups.set(current.filter(g => g !== group));
    }
  }

  clearAll(): void {
    this.topN.set(null);
    this.selectedGroups.set([ALL_GROUPS[0]]);
    this.searchQuery.set('');
  }

  toggleDropdown(): void {
    this.dropdownOpen.update(v => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.multi-select-wrapper')) {
      this.dropdownOpen.set(false);
    }
  }

  setFromPeriod(value: string): void {
    this.fromPeriod.set(value);
    if (value > this.toPeriod()) {
      this.toPeriod.set(value);
    }
  }

  setToPeriod(value: string): void {
    this.toPeriod.set(value);
    if (value < this.fromPeriod()) {
      this.fromPeriod.set(value);
    }
  }
}
