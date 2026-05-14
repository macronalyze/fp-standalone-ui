import { Type } from '@angular/core';
import { EightCoreIndustriesComponent } from './eight-core-industries/eight-core-industries.component';
import { ImportExportComponent } from './import-export/import-export.component';
import { IipItemChartsComponent } from './iip-item-charts/iip-item-charts.component';
import { StockComparisonComponent } from './stock-comparison/stock-comparison.component';
import { HlAnalysisComponent } from './hl-analysis/hl-analysis.component';

interface DatasetExperience {
  component?: Type<unknown>;
}

const DATASET_EXPERIENCES: Record<string, DatasetExperience> = {
  'eight-core-industries': {
    component: EightCoreIndustriesComponent,
  },
  'import-export': {
    component: ImportExportComponent,
  },
  'iip': {
    component: IipItemChartsComponent,
  },
  'stock-comparison': {
    component: StockComparisonComponent,
  },
  'hl-analysis': {
    component: HlAnalysisComponent,
  },
};

export function getDatasetComponent(datasetId: string): Type<unknown> | null {
  return DATASET_EXPERIENCES[datasetId]?.component ?? null;
}

export function isDatasetImplemented(datasetId: string): boolean {
  return Boolean(DATASET_EXPERIENCES[datasetId]?.component);
}
