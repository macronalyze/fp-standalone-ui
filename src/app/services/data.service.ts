import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Sector {
  id: string;
  name: string;
  weight: number;
}

export interface MonthlyEntry {
  period: string;
  label: string;
  provisional?: boolean;
  index?: Record<string, number>;
  growth?: Record<string, number>;
  values?: Record<string, number>;
}

export interface YearlyEntry {
  year: string;
  index?: Record<string, number>;
  growth?: Record<string, number>;
  values?: Record<string, number>;
}

export interface DatasetDetail {
  id: string;
  name: string;
  shortName: string;
  country: string;
  baseYear?: string;
  baseValue?: number;
  source?: string;
  releaseDate?: string;
  nextRelease?: string;
  description?: string;
  sectors: Sector[];
  commodities: string[];
  monthly: MonthlyEntry[];
  yearly: YearlyEntry[];
}

export interface DatasetSummary {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  latestPeriod: string;
  latestGrowth: number | null;
  cumulativeGrowth?: number;
  cumulativePeriod?: string;
  status: string;
  releaseDate?: string;
  file?: string;
}

export interface CountryDatasets {
  country: string;
  countryName: string;
  datasets: DatasetSummary[];
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private http = inject(HttpClient);
  private basePath = `${environment.apiUrl}/datasets`;

  getCountryDatasets(country: string): Observable<CountryDatasets> {
    return this.http.get<CountryDatasets>(`${this.basePath}/${country}`);
  }

  getDatasetDetail(country: string, datasetId: string): Observable<DatasetDetail> {
    return this.http.get<DatasetDetail>(`${this.basePath}/${country}/${datasetId}`);
  }
}
