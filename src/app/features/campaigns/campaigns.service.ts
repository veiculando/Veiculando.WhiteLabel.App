import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AppClients, CampaignDetail, CampaignInput, CampaignSummary, ProductionFilter, ProductionRow, ArtMotivo, ArtLayout, CampaignArt } from './campaign.models';

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

  /** Aba Produção (VEI-RD-165): só peças desta exibidora. */
  production(codigo: string, filtro: ProductionFilter) {
    return this.http.get<ProductionRow[]>(`${this.base}/${encodeURIComponent(codigo)}/producao`,
      { params: new HttpParams().set('filtro', filtro) });
  }

  /** PDF gerado no BFF; vem como blob porque a chamada leva o token da sessão. */
  productionPdf(codigo: string, filtro: ProductionFilter) {
    return this.http.get(`${this.base}/${encodeURIComponent(codigo)}/producao/pdf`,
      { params: new HttpParams().set('filtro', filtro), responseType: 'blob' });
  }

  /** Aba Arte Final (VEI-RD-166). */
  art(codigo: string) {
    return this.http.get<CampaignArt>(this.artUrl(codigo));
  }

  createMotivo(codigo: string, nome: string, descricao: string) {
    return this.http.post<ArtMotivo>(`${this.artUrl(codigo)}/motivos`, { nome, descricao });
  }

  deleteMotivo(codigo: string, id: number) {
    return this.http.delete<void>(`${this.artUrl(codigo)}/motivos/${id}`);
  }

  /** Eventos de progresso para a barra do upload. */
  uploadLayout(codigo: string, idMotivo: number, idFormato: number, file: File) {
    const form = new FormData();
    form.append('idMotivo', String(idMotivo));
    form.append('idFormato', String(idFormato));
    form.append('file', file, file.name);
    return this.http.post<ArtLayout>(`${this.artUrl(codigo)}/layouts`, form, { reportProgress: true, observe: 'events' });
  }

  deleteLayout(codigo: string, id: number) {
    return this.http.delete<void>(`${this.artUrl(codigo)}/layouts/${id}`);
  }

  downloadLayout(codigo: string, id: number) {
    return this.http.get(`${this.artUrl(codigo)}/layouts/${id}/arquivo`, { responseType: 'blob' });
  }

  private artUrl(codigo: string) {
    return `${this.base}/${encodeURIComponent(codigo)}/arte-final`;
  }
}
