import { HttpEventType } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CampaignArt, extensaoAceita } from './campaign.models';
import { CampaignArtComponent } from './campaign-art.component';
import { CampaignsService } from './campaigns.service';

// Formato do GET /api/wl/app/campaigns/{code}/arte-final do BFF (VEI-RD-166a).
const arte = (parcial: Partial<CampaignArt> = {}): CampaignArt => ({
  podeEditar: true, tamanhoMaximo: 25 * 1024 * 1024,
  motivos: [{ id: 1, codigo: 'A', nome: 'Verão', descricao: null }],
  formatos: [{ id: 7, nome: '9 x 3 m', midia: 'impressa', dimensao: '9 x 3', resolucao: null, duracao: null,
    extensoes: ['pdf', 'jpg'], especificacaoCriacao: null, especificacaoArquivo: null }],
  layouts: [], ...parcial,
});

function montar(service: Partial<Record<keyof CampaignsService, unknown>>) {
  TestBed.configureTestingModule({ imports: [CampaignArtComponent], providers: [{ provide: CampaignsService, useValue: service }] });
  const fixture = TestBed.createComponent(CampaignArtComponent);
  fixture.componentRef.setInput('codigo', 'W2A2KA');
  fixture.detectChanges();
  TestBed.tick();
  fixture.detectChanges();
  return fixture;
}

const evento = (file: File) => ({ target: { files: [file], value: 'x' } }) as unknown as Event;

describe('Aba Arte Final (VEI-RD-166b)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('lista motivos e cria um novo', () => {
    const createMotivo = vi.fn().mockReturnValue(of({ id: 2, codigo: 'B', nome: 'Inverno', descricao: '' }));
    const fixture = montar({ art: () => of(arte()), createMotivo });
    expect(fixture.nativeElement.textContent).toContain('Verão');
    const page = fixture.componentInstance;
    page.nome = ' Inverno ';
    page.criarMotivo();
    expect(createMotivo).toHaveBeenCalledWith('W2A2KA', 'Inverno', '');
    expect(page.dados()!.motivos.map(m => m.codigo)).toEqual(['A', 'B']);
  });

  it('excluir pede confirmação antes de chamar o BFF', () => {
    const deleteMotivo = vi.fn().mockReturnValue(of(undefined));
    const fixture = montar({ art: () => of(arte()), deleteMotivo });
    const page = fixture.componentInstance;
    page.pendente.set({ tipo: 'motivo', id: 1 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Excluir o motivo A?');
    expect(deleteMotivo).not.toHaveBeenCalled();
    page.excluirMotivo(page.dados()!.motivos[0]);
    expect(deleteMotivo).toHaveBeenCalledWith('W2A2KA', 1);
    expect(page.dados()!.motivos).toEqual([]);
  });

  it('upload recusa extensão fora do formato e mostra o layout enviado', () => {
    const uploadLayout = vi.fn().mockReturnValue(of(
      { type: HttpEventType.UploadProgress, loaded: 50, total: 100 },
      { type: HttpEventType.Response, body: { id: 9, idMotivo: 1, idFormato: 7, arquivo: 'motivo-a.pdf', enviadoEm: '2026-11-11T10:00:00', formatoNaCampanha: true } },
    ));
    const fixture = montar({ art: () => of(arte()), uploadLayout });
    const page = fixture.componentInstance;
    const [m, f] = [page.dados()!.motivos[0], page.dados()!.formatos[0]];
    page.enviar(m, f, evento(new File(['x'], 'arte.exe')));
    expect(uploadLayout).not.toHaveBeenCalled();
    expect(page.erros()['1-7']).toContain('PDF, JPG');
    page.enviar(m, f, evento(new File(['x'], 'arte.PDF')));
    expect(uploadLayout).toHaveBeenCalled();
    expect(page.layoutDe(1, 7)?.id).toBe(9);
    expect(page.progresso()['1-7']).toBeUndefined();
  });

  it('sem permissão não mostra formulário nem envio', () => {
    const fixture = montar({ art: () => of(arte({ podeEditar: false })) });
    expect(fixture.nativeElement.querySelector('form')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('só quem criou a campanha altera');
  });

  it('erro do servidor no upload aparece na célula', () => {
    const fixture = montar({ art: () => of(arte()), uploadLayout: () => throwError(() => ({ status: 502, error: { message: 'Recusado.' } })) });
    const page = fixture.componentInstance;
    page.enviar(page.dados()!.motivos[0], page.dados()!.formatos[0], evento(new File(['x'], 'a.pdf')));
    expect(page.erros()['1-7']).toBeTruthy();
  });

  it('extensão aceita ignora maiúsculas', () => {
    expect(extensaoAceita('A.PDF', ['pdf'])).toBe(true);
    expect(extensaoAceita('sem-extensao', ['pdf'])).toBe(false);
  });
});
