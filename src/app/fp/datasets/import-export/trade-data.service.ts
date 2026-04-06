import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

export type TradeDatasetId = 'export-data' | 'import-data';

interface TradeDatasetRaw {
  id: string;
  name: string;
  shortName: string;
  country: string;
  source: string;
  description: string;
  commodities: string[];
  monthly: Array<{ month: string; data: Record<string, string | number> }>;
}

export interface TradeMonthlyPoint {
  period: string;
  label: string;
  data: Record<string, number>;
}

export interface TradeDataset {
  id: string;
  name: string;
  shortName: string;
  country: string;
  source: string;
  description: string;
  commodities: string[];
  monthly: TradeMonthlyPoint[];
}

export interface TradeCountryOption {
  id: string;
  name: string;
}

const MONTH_MAP: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const COUNTRY_OPTIONS: TradeCountryOption[] = [
  { id: 'india', name: 'India' },
  { id: 'usa', name: 'United States' },
  { id: 'uk', name: 'United Kingdom' },
  { id: 'canada', name: 'Canada' },
  { id: 'australia', name: 'Australia' },
  { id: 'germany', name: 'Germany' },
  { id: 'france', name: 'France' },
  { id: 'japan', name: 'Japan' },
  { id: 'china', name: 'China' },
  { id: 'brazil', name: 'Brazil' },
  { id: 'singapore', name: 'Singapore' },
  { id: 'south-korea', name: 'South Korea' },
  { id: 'south-africa', name: 'South Africa' },
  { id: 'mexico', name: 'Mexico' },
  { id: 'russia', name: 'Russia' },
  { id: 'italy', name: 'Italy' },
  { id: 'spain', name: 'Spain' },
  { id: 'netherlands', name: 'Netherlands' },
  { id: 'sweden', name: 'Sweden' },
  { id: 'switzerland', name: 'Switzerland' },
];

@Injectable({ providedIn: 'root' })
export class TradeDataService {
  private http = inject(HttpClient);

  getCountryOptions(baseCountry: string): TradeCountryOption[] {
    const options = COUNTRY_OPTIONS.filter((country) => country.id !== baseCountry);
    const base = COUNTRY_OPTIONS.find((country) => country.id === baseCountry);
    return base ? [base, ...options] : options;
  }

  getDataset(country: string, datasetId: TradeDatasetId): Observable<TradeDataset> {
    return this.http
      .get<TradeDatasetRaw>(`assets/data/${country}/${datasetId}.json`)
      .pipe(map((raw) => this.normalizeDataset(raw)));
  }

  getDatasetOrNull(country: string, datasetId: TradeDatasetId): Observable<TradeDataset | null> {
    return this.getDataset(country, datasetId).pipe(catchError(() => of(null)));
  }

  private normalizeDataset(raw: TradeDatasetRaw): TradeDataset {
    const monthly = (raw.monthly ?? [])
      .map((entry) => {
        const normalizedPeriod = this.toPeriodKey(entry.month);
        const normalizedValues: Record<string, number> = {};

        Object.entries(entry.data ?? {}).forEach(([commodity, value]) => {
          const numberValue = Number(value);
          normalizedValues[commodity] = Number.isFinite(numberValue) ? numberValue : 0;
        });

        return {
          period: normalizedPeriod,
          label: this.toDisplayLabel(normalizedPeriod),
          data: normalizedValues,
        };
      })
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      id: raw.id,
      name: raw.name,
      shortName: raw.shortName,
      country: raw.country,
      source: raw.source,
      description: raw.description,
      commodities: raw.commodities ?? [],
      monthly,
    };
  }

  private toPeriodKey(monthCode: string): string {
    const [monthPart = '', yearPart = ''] = monthCode.toLowerCase().split('-');
    const monthNumber = MONTH_MAP[monthPart] ?? 1;
    const twoDigitYear = Number(yearPart);
    const fullYear = twoDigitYear >= 70 ? 1900 + twoDigitYear : 2000 + twoDigitYear;
    return `${fullYear}-${String(monthNumber).padStart(2, '0')}`;
  }

  private toDisplayLabel(period: string): string {
    const [yearRaw, monthRaw] = period.split('-');
    const year = Number(yearRaw);
    const month = Number(monthRaw);
    const date = new Date(year, Math.max(0, month - 1), 1);
    return date.toLocaleString('en-US', { month: 'short', year: 'numeric' });
  }
}
