import { Component, Input } from '@angular/core';
import { TradeDataViewComponent } from './trade-data-view.component';


@Component({
  selector: 'app-export-data',
  standalone: true,
  imports: [TradeDataViewComponent],
  template: `
    <app-trade-data-view
      [country]="country"
      datasetId="export-data"
      title="Export Data in USD">
    </app-trade-data-view>
  `,
})
export class ExportDataComponent {
  @Input({ required: true }) country = 'india';
}
