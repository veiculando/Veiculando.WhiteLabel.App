import { Injectable, signal } from '@angular/core';

/** Seleção da busca compartilhada com o checkout, sem expor gestão de campanhas. */
@Injectable({ providedIn: 'root' })
export class CampaignSelectionService {
  readonly campaignId = signal<number | null>(null);
  readonly periodCode = signal('');

  selectCampaign(id: number | null) {
    this.campaignId.set(id);
    this.periodCode.set('');
  }
}
