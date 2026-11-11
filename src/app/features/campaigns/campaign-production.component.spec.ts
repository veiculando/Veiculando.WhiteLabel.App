import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { ProductionRow, extensoes } from './campaign.models';
import { CampaignProductionComponent } from './campaign-production.component';
import { CampaignsService } from './campaigns.service';

// Formato do GET /api/wl/app/campaigns/{code}/producao do BFF (VEI-RD-165a), em camelCase.
const linha = (parcial: Partial<ProductionRow> = {}): ProductionRow => ({
  suporte: 'Outdoor', midia: 'impressa', formato: '9 x 3 m', dimensao: '9 x 3', resolucao: null, duracao: null,
  extensoesAceitas: 'pdf;ai', especificacaoCriacao: null, especificacaoArquivo: null, quantidade: 2, ...parcial,
});

function montar(service: Partial<Record<keyof CampaignsService, unknown>>) {
  TestBed.configureTestingModule({
    imports: [CampaignProductionComponent],
    providers: [{ provide: CampaignsService, useValue: service }],
  });
  const fixture = TestBed.createComponent(CampaignProductionComponent);
  fixture.componentRef.setInput('codigo', 'W2A2KA');
  fixture.detectChanges();
  TestBed.tick();
  fixture.detectChanges();
  return fixture;
}

registerLocaleData(localePt, 'pt-BR');

describe('Aba Produção (VEI-RD-165b)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('carrega com o filtro de aprovados e mostra a tabela com o total de peças', () => {
    const production = vi.fn().mockReturnValue(of([
      linha({ midia: 'digital', suporte: 'Painel LED', duracao: 15, resolucao: '1920 x 1080', quantidade: 1, extensoesAceitas: 'mp4' }),
      linha(),
    ]));
    const fixture = montar({ production });
    expect(production).toHaveBeenCalledWith('W2A2KA', 1);
    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.querySelector('.production__total')?.textContent).toContain('3');
    expect(el.textContent).toContain('15 seg');
    expect(el.textContent).toContain('PDF, AI');
  });

  it('trocar o filtro consulta de novo com o status escolhido', () => {
    const production = vi.fn().mockReturnValue(of([]));
    const fixture = montar({ production });
    fixture.componentInstance.filtro.set(3);
    TestBed.tick();
    expect(production).toHaveBeenLastCalledWith('W2A2KA', 3);
  });

  it('sem peças mostra o vazio do Veiculando.Web', () => {
    const fixture = montar({ production: () => of([]) });
    expect(fixture.nativeElement.textContent).toContain('Não existe nenhuma peça para produção nesta campanha.');
  });

  it('erro do servidor aparece no lugar da tabela', () => {
    const fixture = montar({ production: () => throwError(() => ({ status: 500, error: { message: 'Falhou.' } })) });
    expect(fixture.nativeElement.querySelector('[role=alert]')?.textContent).toBeTruthy();
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('Exportar PDF baixa o blob do BFF com o filtro atual', () => {
    const productionPdf = vi.fn().mockReturnValue(of(new Blob(['%PDF-'], { type: 'application/pdf' })));
    const fixture = montar({ production: () => of([linha()]), productionPdf });
    URL.createObjectURL = vi.fn().mockReturnValue('blob:x');
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fixture.componentInstance.filtro.set(2);
    fixture.componentInstance.exportar();
    expect(productionPdf).toHaveBeenCalledWith('W2A2KA', 2);
    expect(click).toHaveBeenCalled();
    expect(fixture.componentInstance.exportando()).toBe(false);
  });

  it('extensões do Core viram lista legível', () => {
    expect(extensoes('pdf;ai')).toBe('PDF, AI');
    expect(extensoes('.jpg, png')).toBe('JPG, PNG');
    expect(extensoes(null)).toBe('—');
  });
});
