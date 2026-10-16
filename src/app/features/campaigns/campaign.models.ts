export type CampaignStatus = 'rascunho' | 'aguardando_producao' | 'em_exibicao' | 'concluida';
export type CheckingState = 'indisponivel' | 'parcial' | 'concluido';

export interface CampaignAdvertiser {
  nome: string;
  cnpj: string;
  logoUrl?: string;
}

export interface CampaignSummary {
  codigo: string;
  nome: string;
  status: CampaignStatus;
  anunciante?: CampaignAdvertiser;
}

export interface CampaignOrderRow {
  estado: string;
  cidade: string;
  codigo: string;
  local: string;
  periodo: string;
  status: string;
}

export interface CampaignFile {
  nome: string;
  url?: string;
}

export interface ProductionSpec {
  peca: string;
  formato: string;
  medida: string;
  material: string;
}

export interface CampaignDetail extends CampaignSummary {
  budgetTotal: number;
  pedidosConfirmados: number;
  pedidosPendentes: number;
  totalPecas: number;
  pecasConfirmadas: number;
  pecasPendentes: number;
  pecasPublicadas: number;
  podeVerRelatorio: boolean;
  pedidos: CampaignOrderRow[];
  motivos: CampaignFile[];
  layouts: CampaignFile[];
  producao: ProductionSpec[];
  checking: { estado: CheckingState; pdfUrl?: string };
}

export function verbaDisponivel(campaign: Pick<CampaignDetail, 'budgetTotal' | 'pedidosConfirmados' | 'pedidosPendentes'>): number {
  return campaign.budgetTotal - campaign.pedidosConfirmados - campaign.pedidosPendentes;
}

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  rascunho: 'Rascunho',
  aguardando_producao: 'Aguardando Produção',
  em_exibicao: 'Em Exibição',
  concluida: 'Concluída',
};
