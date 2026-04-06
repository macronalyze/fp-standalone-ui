import { Type } from '@angular/core';
import { EightCoreIndustriesComponent } from './eight-core-industries/eight-core-industries.component';
import { ImportExportComponent } from './import-export/import-export.component';

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
};

export function getDatasetComponent(datasetId: string): Type<unknown> | null {
  return DATASET_EXPERIENCES[datasetId]?.component ?? null;
}

export function isDatasetImplemented(datasetId: string): boolean {
  return Boolean(DATASET_EXPERIENCES[datasetId]?.component);
}
