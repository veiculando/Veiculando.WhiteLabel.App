import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
import { CadastroCliente, CarteiraStatus } from '../carteira/carteira.service';

export type RepresentacaoDocumentoTipo = 'corporate' | 'representative' | 'representation-letter';

/** Pedido da agência para representar um anunciante, no formato do BFF (VEI-RD-67g). */
export interface Representacao {
  id: string;
  clienteId: number;
  status: CarteiraStatus;
  origem: 'Cadastro' | 'Solicitacao';
  motivo: string | null;
  /** Percentual inteiro (12 = 12%). */
  comissaoAgencia: number;
  inicioContrato: string;
  fimContrato: string;
  atualizadoEm: string;
  nome: string | null;
  razaoSocial: string | null;
  cnpj: string | null;
  documentos: Array<{ id: string; tipo: RepresentacaoDocumentoTipo; nome: string }>;
}

/** O que acontece se a agência seguir com o CNPJ. */
export type ConsultaCnpj =
  | { situacao: 'novo' }
  | { situacao: 'existente'; nome: string | null; documentosDispensaveis: boolean }
  | { situacao: 'pedido'; representacaoId: string; status: CarteiraStatus }
  | { situacao: 'representado' };

export interface Condicoes {
  comissaoAgencia: number;
  /** yyyy-MM-dd; vazio = hoje. */
  inicioContrato?: string | null;
  /** yyyy-MM-dd; vazio = 2 anos depois do início. */
  fimContrato?: string | null;
}

export interface NovaRepresentacao extends CadastroCliente, Condicoes {}

export interface RepresentacaoCriada {
  id: string;
  clienteId: number;
  status: CarteiraStatus;
  origem: 'Cadastro' | 'Solicitacao';
  comissaoAgencia: number;
  inicioContrato: string;
  fimContrato: string;
  documentosDispensaveis: boolean;
}

/** "Adicionar anunciante" da agência (VEI-RD-67j); só sessão de agência. */
@Injectable({ providedIn: 'root' })
export class AnunciantesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.bffUrl}/app/anunciantes`;

  listar() { return this.http.get<Representacao[]>(this.base); }
  consultarCnpj(cnpj: string) { return this.http.get<ConsultaCnpj>(`${this.base}/cnpj/${encodeURIComponent(cnpj)}`); }
  criar(dados: NovaRepresentacao) { return this.http.post<RepresentacaoCriada>(this.base, dados); }
  alterarCondicoes(id: string, condicoes: Condicoes) { return this.http.put(`${this.base}/${id}/condicoes`, condicoes); }
  anexar(id: string, tipo: RepresentacaoDocumentoTipo, arquivo: File) {
    const body = new FormData();
    body.append('type', tipo);
    body.append('file', arquivo, arquivo.name);
    return this.http.post(`${this.base}/${id}/documentos`, body);
  }
  enviar(id: string) { return this.http.post<{ id: string; status: CarteiraStatus }>(`${this.base}/${id}/enviar`, {}); }
}
