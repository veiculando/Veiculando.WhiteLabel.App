// Contrato do BFF para Minhas Campanhas (PR #92 do Veiculando.WhiteLabel.Api, TP 4.1).
// O front não calcula autorização nem dinheiro: podeEditar, podeVerRelatorio,
// verbaDisponivel e as somas vêm prontos do servidor.

export type CampaignStatus = 'rascunho' | 'aguardando_producao' | 'em_exibicao' | 'concluida' | 'cancelada';
export type CheckingState = 'indisponivel' | 'parcial' | 'concluido';
export type ClientsProfile = 'agencia' | 'anunciante_direto' | 'carteira';

/** GET /api/wl/app/clients — carteira autorizada da sessão (VEI-RD-67e). */
export interface AppClient { id: number; nome: string; cnpj: string; }
export interface AppClients { perfil: ClientsProfile; podeAdicionarAnunciante: boolean; clientes: AppClient[]; }

/** Item de GET /api/wl/app/campaigns[?clienteId=]. */
export interface CampaignSummary {
  codigo: string;
  nome: string;
  status: CampaignStatus;
  anunciante: AppClient;
  dataInicio: string | null;
  dataFim: string | null;
  budgetTotal: number;
  pedidosConfirmados: number;
  pedidosPendentes: number;
}

export interface CampaignOrderRow {
  estado: string;
  cidade: string;
  codigo: string;
  periodo: { codigo: string; dataInicio: string; dataFim: string };
  status: string;
  simulacao: boolean;
  pecas: number;
  valor: number;
}

/** GET /api/wl/app/campaigns/{codigo}. */
export interface CampaignDetail extends CampaignSummary {
  produto: string | null;
  job: string | null;
  agencia: string | null;
  /** Só desta exibidora; null quando a campanha não tem verba (peer review I1). */
  verbaDisponivel: number | null;
  totalPecas: number;
  pecasConfirmadas: number;
  pecasPendentes: number;
  pecasPublicadas: number;
  podeVerRelatorio: boolean;
  podeEditar: boolean;
  pedidos: CampaignOrderRow[];
  motivos: unknown[];
  layouts: unknown[];
  producao: unknown[];
  checking: { estado: CheckingState };
}

/** Corpo comum do POST checkout/context/campaigns e do PUT campaigns/{codigo}. */
export interface CampaignInput {
  name: string;
  product: string;
  job?: string;
  startDate: string;
  endDate: string;
  budget: number | null;
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_producao: 'Aguardando Produção',
  em_exibicao: 'Em Exibição',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

export const CAMPAIGN_STATUSES = Object.keys(CAMPAIGN_STATUS_LABEL) as CampaignStatus[];

/**
 * Para onde "Minhas Campanhas" leva a sessão (VEI-RD-67a), a partir do que o BFF devolveu.
 * Anunciante direto e carteira com um cliente vão direto ao painel; com mais de um, ao gateway;
 * sem nenhum, o painel mostra o estado vazio (a agência que pode adicionar vai ao gateway).
 */
export function destinoMinhasCampanhas(clients: AppClients, clienteId: number | null):
  { tipo: 'painel'; clienteId: number | null } | { tipo: 'gateway' } {
  const ids = clients.clientes.map(c => c.id);
  if (clienteId !== null && ids.includes(clienteId)) return { tipo: 'painel', clienteId };
  // VEI-RD-67j: agência sem cliente vai ao gateway, onde adiciona anunciante e acompanha os pedidos.
  if (clients.perfil === 'agencia' && !ids.length && clients.podeAdicionarAnunciante) return { tipo: 'gateway' };
  if (clients.perfil === 'anunciante_direto' || ids.length <= 1) return { tipo: 'painel', clienteId: ids[0] ?? null };
  return { tipo: 'gateway' };
}

/** Mensagens de um erro do BFF: `{ message, details[] }` nos 400, `{ message }` nos demais. */
export function mensagensDoServidor(error: unknown, fallback: string): string[] {
  const body = (error as { error?: { message?: unknown; details?: unknown } } | null)?.error;
  const details = Array.isArray(body?.details) ? body.details.filter((d): d is string => typeof d === 'string' && !!d) : [];
  if (details.length) return details;
  return [typeof body?.message === 'string' && body.message ? body.message : fallback];
}

/** Busca do gateway: nome, razão social ou CNPJ (com ou sem máscara). */
export function filtrarClientes(clientes: AppClient[], termo: string): AppClient[] {
  const texto = termo.trim().toLowerCase();
  // Só trata como CNPJ quando o termo é número com ou sem máscara ("cliente 2" é nome).
  const digitos = /^[\d.\/\s-]+$/.test(termo.trim()) ? termo.replace(/\D/g, '') : '';
  if (!texto) return clientes;
  return clientes.filter(c => c.nome.toLowerCase().includes(texto) || (!!digitos && (c.cnpj ?? '').replace(/\D/g, '').includes(digitos)));
}
