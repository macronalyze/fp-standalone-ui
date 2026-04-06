import { Component, Input } from '@angular/core';
import { TradeDataViewComponent } from './trade-data-view.component';


@Component({
  selector: 'app-import-data',
  standalone: true,
  imports: [TradeDataViewComponent],
  template: `
    <app-trade-data-view
      [country]="country"
      datasetId="import-data"
      title="Import Data in USD">
    </app-trade-data-view>
  `,
})
export class ImportDataComponent {
  @Input({ required: true }) country = 'india';
}
