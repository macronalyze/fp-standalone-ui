import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataService, DatasetDetail } from '../../../services/data.service';

@Injectable({ providedIn: 'root' })
export class CoreIndustriesDataService {
  private dataService = inject(DataService);

  getDetail(country: string, datasetId: string): Observable<DatasetDetail> {
    return this.dataService.getDatasetDetail(country, datasetId);
  }
}
