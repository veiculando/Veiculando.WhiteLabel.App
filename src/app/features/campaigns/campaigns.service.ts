import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CampaignDetail, CampaignSummary } from './campaign.models';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.bffUrl}/app/anunciante/campanhas`;

  list() {
    return this.http.get<CampaignSummary[]>(this.base);
  }

  detail(codigo: string) {
    return this.http.get<CampaignDetail>(`${this.base}/${encodeURIComponent(codigo)}`);
  }
}
