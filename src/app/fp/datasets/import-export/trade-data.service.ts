import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { DataService, DatasetDetail } from '../../../services/data.service';

export type TradeDatasetId = 'export-data' | 'import-data';

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
  private dataService = inject(DataService);

  getCountryOptions(baseCountry: string): TradeCountryOption[] {
    const options = COUNTRY_OPTIONS.filter((country) => country.id !== baseCountry);
    const base = COUNTRY_OPTIONS.find((country) => country.id === baseCountry);
    return base ? [base, ...options] : options;
  }

  getDataset(country: string, datasetId: TradeDatasetId): Observable<TradeDataset> {
    return this.dataService
      .getDatasetDetail(country, datasetId)
      .pipe(map((detail) => this.toTradeDataset(detail)));
  }

  getDatasetOrNull(country: string, datasetId: TradeDatasetId): Observable<TradeDataset | null> {
    return this.getDataset(country, datasetId).pipe(catchError(() => of(null)));
  }

  private toTradeDataset(detail: DatasetDetail): TradeDataset {
    const monthly: TradeMonthlyPoint[] = (detail.monthly ?? [])
      .map((entry) => ({
        period: entry.period,
        label: entry.label,
        data: { ...(entry.values ?? {}) },
      }))
      .sort((a, b) => a.period.localeCompare(b.period));

    return {
      id: detail.id,
      name: detail.name,
      shortName: detail.shortName,
      country: detail.country,
      source: detail.source ?? '',
      description: detail.description ?? '',
      commodities: detail.commodities ?? [],
      monthly,
    };
  }
}
