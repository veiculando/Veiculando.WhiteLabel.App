import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AppClients, CampaignDetail, CampaignInput, CampaignSummary } from './campaign.models';

@Injectable({ providedIn: 'root' })
export class CampaignsService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.bffUrl}/app/campaigns`;

  /** Carteira autorizada da sessão; o mesmo conjunto que filtra as campanhas. */
  clients() {
    return this.http.get<AppClients>(`${environment.bffUrl}/app/clients`);
  }

  /** O cliente escolhido no gateway vai ao servidor; o front nunca filtra por nome/CNPJ. */
  list(clienteId: number | null) {
    const params = clienteId === null ? undefined : new HttpParams().set('clienteId', clienteId);
    return this.http.get<CampaignSummary[]>(this.base, { params });
  }

  detail(codigo: string) {
    return this.http.get<CampaignDetail>(`${this.base}/${encodeURIComponent(codigo)}`);
  }

  /** Criar reaproveita o POST que o mapa já usa (VEI-RD-68e). */
  create(input: CampaignInput, clientId: number | null) {
    return this.http.post<{ id: number; code: string; name: string }>(`${environment.bffUrl}/app/checkout/context/campaigns`,
      clientId === null ? input : { ...input, clientId });
  }

  update(codigo: string, input: CampaignInput) {
    return this.http.put<{ codigo: string; nome: string }>(`${this.base}/${encodeURIComponent(codigo)}`, input);
  }
}
