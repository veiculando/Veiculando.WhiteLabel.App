import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AnunciantesService, Representacao } from '../../core/anunciantes/anunciantes.service';
import { CepService } from '../../core/forms/cep.service';
import { AdicionarAnunciantePage, comissaoValida, editavel } from './adicionar-anunciante.page';

// Formato do GET /api/wl/app/anunciantes do BFF (VEI-RD-67g), em camelCase.
const item = (parcial: Partial<Representacao> = {}): Representacao => ({
  id: 'r1', clienteId: 10, status: 'Rascunho', origem: 'Cadastro', motivo: null, comissaoAgencia: 12,
  inicioContrato: '2026-11-10T00:00:00', fimContrato: '2028-11-10T00:00:00', atualizadoEm: '2026-11-10T10:00:00',
  nome: 'Padaria Sol', razaoSocial: 'Sol Ltda', cnpj: '11222333000181', documentos: [], ...parcial,
});

const criado = { id: 'r1', clienteId: 10, status: 'Rascunho', origem: 'Cadastro', comissaoAgencia: 12,
  inicioContrato: '2026-11-10T00:00:00', fimContrato: '2028-11-10T00:00:00', documentosDispensaveis: false };

function montar(service: Partial<Record<keyof AnunciantesService, unknown>>) {
  TestBed.configureTestingModule({
    imports: [AdicionarAnunciantePage],
    providers: [provideRouter([]), { provide: CepService, useValue: { lookup: () => of({ erro: true }) } },
      { provide: AnunciantesService, useValue: { listar: () => of([]), ...service } }],
  });
  const fixture = TestBed.createComponent(AdicionarAnunciantePage);
  fixture.detectChanges();
  return fixture;
}

describe('Adicionar anunciante (VEI-RD-67j)', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('comissão só em percentual inteiro de 0 a 30, como o Core guarda', () => {
    expect([0, 12, 30, '15'].map(comissaoValida)).toEqual([true, true, true, true]);
    expect([-1, 31, 12.5, '', null, 'abc'].map(comissaoValida)).toEqual([false, false, false, false, false, false]);
  });

  it('só deixa anexar e enviar no rascunho ou com ajustes pedidos', () => {
    expect(['Rascunho', 'PendenteAnalise', 'AjustesSolicitados', 'Aprovado', 'Reprovado']
      .map(status => editavel(item({ status: status as Representacao['status'] })))).toEqual([true, false, true, false, false]);
  });

  it('CNPJ já representado não segue', () => {
    const consultarCnpj = vi.fn().mockReturnValue(of({ situacao: 'representado' }));
    const page = montar({ consultarCnpj }).componentInstance;
    page.form.patchValue({ cnpj: '11.222.333/0001-81' });
    page.consultar();
    expect(consultarCnpj).toHaveBeenCalledWith('11222333000181');
    expect(page.erro()).toContain('já representa');
    expect(page.etapa()).toBe('cnpj');
  });

  it('cliente existente pede só as condições e cria sem os dados do cliente', () => {
    const criar = vi.fn().mockReturnValue(of({ ...criado, origem: 'Solicitacao', documentosDispensaveis: true }));
    const page = montar({ consultarCnpj: () => of({ situacao: 'existente', nome: 'Padaria Sol', documentosDispensaveis: true }), criar })
      .componentInstance;
    page.form.patchValue({ cnpj: '11.222.333/0001-81' });
    page.consultar();
    expect(page.etapa()).toBe('existente');
    expect(page.nomeExistente()).toBe('Padaria Sol');

    page.form.patchValue({ comissaoAgencia: '12.5' });
    page.criar();
    expect(criar).not.toHaveBeenCalled();
    expect(page.erro()).toContain('inteiro');

    page.form.patchValue({ comissaoAgencia: '12' });
    page.criar();
    expect(criar).toHaveBeenCalledWith({ cnpj: '11222333000181', comissaoAgencia: 12, inicioContrato: null, fimContrato: null });
    expect(page.aviso()).toContain('carta de representação');
  });

  it('cliente novo manda os dados com telefone e CEP só com dígitos', () => {
    const criar = vi.fn().mockReturnValue(of(criado));
    const page = montar({ consultarCnpj: () => of({ situacao: 'novo' }), criar }).componentInstance;
    page.form.patchValue({ cnpj: '11.222.333/0001-81' });
    page.consultar();
    expect(page.etapa()).toBe('novo');
    page.form.patchValue({ nomeFantasia: 'Sol', telefone: '(11) 98888-7777', cep: '01310-100', uf: 'sp',
      comissaoAgencia: '10', fimContrato: '2027-12-31' });
    page.criar();
    expect(criar).toHaveBeenCalledWith(expect.objectContaining({
      cnpj: '11222333000181', telefone: '11988887777', cep: '01310100', uf: 'SP', comissaoAgencia: 10, fimContrato: '2027-12-31',
    }));
  });

  it('sobe a carta e os documentos antes de enviar e mostra a recusa do BFF', () => {
    const anexar = vi.fn().mockReturnValue(of({}));
    const enviar = vi.fn().mockReturnValue(of({ id: 'r1', status: 'PendenteAnalise' }));
    const page = montar({ listar: () => of([item()]), anexar, enviar }).componentInstance;
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [new File(['%PDF'], 'carta.pdf', { type: 'application/pdf' })] });
    page.escolher('r1', 'representation-letter', { target: input } as unknown as Event);
    expect(page.anexado(item(), 'representation-letter')).toBe('carta.pdf');
    page.enviar(item());
    expect(anexar.mock.calls.map(c => c[1])).toEqual(['representation-letter']);
    expect(enviar).toHaveBeenCalledWith('r1');
    expect(page.aviso()).toContain('Enviado');

    enviar.mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Anexe a carta de representação antes de enviar.' } })));
    page.enviar(item());
    expect(page.erro()).toBe('Anexe a carta de representação antes de enviar.');
  });

  it('pedido reprovado mostra o motivo e pede de novo com as mesmas condições', () => {
    const criar = vi.fn().mockReturnValue(of(criado));
    const fixture = montar({ listar: () => of([item({ status: 'Reprovado', motivo: 'Carta sem assinatura' })]), criar });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.textContent).toContain('Carta sem assinatura');
    const botao = [...root.querySelectorAll('button')].find(b => b.textContent?.includes('Pedir de novo'));
    botao!.click();
    expect(criar).toHaveBeenCalledWith({ cnpj: '11222333000181', comissaoAgencia: 12 });
  });
});
