import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { SecureStorage } from '../auth/secure-storage';

export type CarteiraStatus = 'Rascunho' | 'PendenteAnalise' | 'AjustesSolicitados' | 'Aprovado' | 'Reprovado';
export type CarteiraDocumentoTipo = 'corporate' | 'representative';

export interface CarteiraItem {
  id: string;
  clienteId: number;
  status: CarteiraStatus;
  origem: 'Cadastro' | 'Solicitacao';
  motivo?: string | null;
  atualizadoEm: string;
  nome?: string | null;
  razaoSocial?: string | null;
  cnpj?: string | null;
  documentos: Array<{ id: string; tipo: CarteiraDocumentoTipo; nome: string }>;
}

export interface CadastroCliente {
  cnpj: string;
  nomeFantasia?: string;
  razaoSocial?: string;
  telefone?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cep?: string;
  cidade?: string;
  uf?: string;
  inscricaoEstadual?: string;
  inscricaoMunicipal?: string;
}

export interface CadastroResposta {
  id: string;
  clienteId: number;
  status: CarteiraStatus;
  origem: 'Cadastro' | 'Solicitacao';
  documentosDispensaveis: boolean;
}

/** Texto curto de cada status para a vendedora. */
export const statusCarteira: Record<CarteiraStatus, string> = {
  Rascunho: 'Rascunho (falta enviar)',
  PendenteAnalise: 'Em análise',
  AjustesSolicitados: 'Ajustes pedidos',
  Aprovado: 'Aprovado',
  Reprovado: 'Reprovado',
};

/** Marca de sessão de carteira, guardada ao lado do token (VEI-RD-157e). */
const marcaKey = `${environment.tokenKey}.carteira`;

/**
 * Carteira da vendedora na Prospecção (VEI-RD-157e). Só existe quando a vendedora entra
 * pela Prospecção sem anunciante; o BFF recusa (403) em qualquer outra sessão.
 *
 * A marca guarda o fim do token da sessão: se outro login trocar o token, a marca deixa
 * de valer sozinha e o menu "Meus clientes" some.
 */
@Injectable({ providedIn: 'root' })
export class CarteiraService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.bffUrl}/app/prospeccao/carteira`;

  static marcarSessao(token: string): void {
    try { localStorage.setItem(marcaKey, token.slice(-24)); } catch { /* sem storage, sem menu */ }
  }

  static limparSessao(): void {
    try { localStorage.removeItem(marcaKey); } catch { /* nada a limpar */ }
  }

  static sessaoAtiva(): boolean {
    const token = SecureStorage.getToken(environment.tokenKey);
    try { return !!token && localStorage.getItem(marcaKey) === token.slice(-24); } catch { return false; }
  }

  listar() { return this.http.get<CarteiraItem[]>(this.base); }

  cadastrar(dados: CadastroCliente) { return this.http.post<CadastroResposta>(this.base, dados); }

  anexar(id: string, tipo: CarteiraDocumentoTipo, arquivo: File) {
    const body = new FormData();
    body.append('type', tipo);
    body.append('file', arquivo, arquivo.name);
    return this.http.post<{ type: string; documentosCompletos: boolean }>(`${this.base}/${id}/documentos`, body);
  }

  enviar(id: string) { return this.http.post<{ id: string; status: CarteiraStatus }>(`${this.base}/${id}/enviar`, {}); }
}
