import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CampaignDetail, CampaignOrderRow } from './campaign.models';
import { CampaignDetailPage } from './campaign-detail.page';
import { CampaignsService } from './campaigns.service';

registerLocaleData(localePt, 'pt-BR');

const pedido = (parcial: Partial<CampaignOrderRow> = {}): CampaignOrderRow => ({
  estado: 'SP', cidade: 'MOGI DAS CRUZES', codigo: 'UMC-5DFE-F39C',
  periodo: { codigo: 'B-50-2026', dataInicio: '2026-11-30', dataFim: '2026-12-13' },
  status: 'Confirmado', simulacao: false, podeAprovar: true, pecas: 2, valor: 8575.06, ...parcial,
});

const campanha = (pedidos: CampaignOrderRow[]) => ({
  codigo: 'UMC-5DFE', nome: 'UMC 2027', status: 'rascunho',
  anunciante: { id: 1, nome: 'UNIVERSIDADE', cnpj: '00000000000191' },
  dataInicio: '2026-11-30', dataFim: '2026-12-13', budgetTotal: 0, pedidosConfirmados: 8575.06, pedidosPendentes: 0,
  verbaDisponivel: null, totalPecas: 2, pecasConfirmadas: 0, pecasPendentes: 2, pecasPublicadas: 0,
  podeEditar: false, podeVerRelatorio: false, pedidos, motivos: [], layouts: [], producao: [],
  checking: { estado: 'indisponivel' },
}) as unknown as CampaignDetail;

function montar(service: Partial<Record<keyof CampaignsService, unknown>>) {
  TestBed.configureTestingModule({
    imports: [CampaignDetailPage],
    providers: [
      provideRouter([]),
      { provide: CampaignsService, useValue: service },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ codigo: 'UMC-5DFE' }) } } },
    ],
  });
  const fixture = TestBed.createComponent(CampaignDetailPage);
  fixture.detectChanges();
  return fixture;
}

const botaoAprovar = (el: HTMLElement) =>
  [...el.querySelectorAll('button')].find(b => b.textContent?.includes('Aprovar pedido')) as HTMLButtonElement | undefined;

describe('Detalhe da campanha: aprovar pedido (VEI-SUP-60)', () => {
  afterEach(() => { TestBed.resetTestingModule(); vi.restoreAllMocks(); });

  it('aprova o pedido confirmado e recarrega a campanha', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const detail = vi.fn()
      .mockReturnValueOnce(of(campanha([pedido()])))
      .mockReturnValueOnce(of(campanha([pedido({ status: 'Aprovado', podeAprovar: false })])));
    const approveOrder = vi.fn().mockReturnValue(of({ codigo: 'UMC-5DFE-F39C', status: 'Aprovado', pedidosInsercao: ['PI-1'] }));
    const fixture = montar({ detail, approveOrder });
    const el: HTMLElement = fixture.nativeElement;

    botaoAprovar(el)!.click();
    fixture.detectChanges();

    expect(approveOrder).toHaveBeenCalledWith('UMC-5DFE', 'UMC-5DFE-F39C');
    expect(detail).toHaveBeenCalledTimes(2);
    expect(botaoAprovar(el)).toBeUndefined();
    expect(el.textContent).toContain('pedido de inserção');
  });

  it('não mostra o botão quando o pedido ainda não foi confirmado', () => {
    const fixture = montar({ detail: vi.fn().mockReturnValue(of(campanha([pedido({ status: 'Solicitado', podeAprovar: false })]))) });
    expect(botaoAprovar(fixture.nativeElement)).toBeUndefined();
  });

  it('mostra a mensagem do servidor quando a aprovação é recusada', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const approveOrder = vi.fn().mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Este pedido não pode mais ser aprovado.' } })));
    const fixture = montar({ detail: vi.fn().mockReturnValue(of(campanha([pedido()]))), approveOrder });
    const el: HTMLElement = fixture.nativeElement;

    botaoAprovar(el)!.click();
    fixture.detectChanges();

    expect(el.textContent).toContain('Este pedido não pode mais ser aprovado.');
  });
});
