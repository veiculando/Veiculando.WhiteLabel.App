import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SecureStorage } from '../../core/auth/secure-storage';
import { CarteiraItem, CarteiraService } from '../../core/carteira/carteira.service';
import { CepService } from '../../core/forms/cep.service';
import { MeusClientesPage, editavel, mensagemErro } from './meus-clientes.page';

const item = (parcial: Partial<CarteiraItem> = {}): CarteiraItem => ({
  id: 'c1', clienteId: 10, status: 'Rascunho', origem: 'Cadastro', atualizadoEm: '2026-11-05T10:00:00Z',
  nome: 'Padaria Sol', cnpj: '11222333000181', documentos: [], ...parcial,
});

function montar(service: Partial<Record<keyof CarteiraService, unknown>>) {
  TestBed.configureTestingModule({
    imports: [MeusClientesPage],
    providers: [provideRouter([]), { provide: CepService, useValue: { lookup: () => of({ erro: true }) } },
      { provide: CarteiraService, useValue: { listar: () => of([]), ...service } }],
  });
  const fixture = TestBed.createComponent(MeusClientesPage);
  fixture.detectChanges();
  return fixture;
}

describe('Meus clientes (VEI-RD-157e)', () => {
  afterEach(() => { localStorage.clear(); TestBed.resetTestingModule(); });

  it('só deixa anexar e enviar no rascunho ou com ajustes pedidos', () => {
    expect(['Rascunho', 'PendenteAnalise', 'AjustesSolicitados', 'Aprovado', 'Reprovado']
      .map(status => editavel(item({ status: status as CarteiraItem['status'] })))).toEqual([true, false, true, false, false]);
  });

  it('mostra quem é a responsável quando o CNPJ é de outra vendedora', () => {
    expect(mensagemErro({ status: 409, error: { message: 'Este cliente já é atendido por ana@aurum.com.' } }, 'x'))
      .toBe('Este cliente já é atendido por ana@aurum.com.');
    expect(mensagemErro({ status: 403, error: {} }, 'x')).toContain('Prospecção');
  });

  it('cadastra com CNPJ, telefone e CEP só com dígitos', () => {
    const cadastrar = vi.fn().mockReturnValue(of({ id: 'c1', clienteId: 1, status: 'Rascunho', origem: 'Cadastro', documentosDispensaveis: false }));
    const page = montar({ cadastrar }).componentInstance;
    page.abrirForm();
    page.form.patchValue({ cnpj: '11.222.333/0001-81', telefone: '(11) 98888-7777', cep: '01310-100', uf: 'sp', nomeFantasia: 'Sol' });
    page.cadastrar();
    expect(cadastrar).toHaveBeenCalledWith(expect.objectContaining({ cnpj: '11222333000181', telefone: '11988887777', cep: '01310100', uf: 'SP' }));
    expect(page.aviso()).toContain('Anexe os documentos');
  });

  it('sobe os arquivos escolhidos antes de enviar para análise', () => {
    const anexar = vi.fn().mockReturnValue(of({ type: 'corporate', documentosCompletos: true }));
    const enviar = vi.fn().mockReturnValue(of({ id: 'c1', status: 'PendenteAnalise' }));
    const page = montar({ listar: () => of([item()]), anexar, enviar }).componentInstance;
    const escolher = (tipo: 'corporate' | 'representative', nome: string) => {
      const input = document.createElement('input');
      Object.defineProperty(input, 'files', { value: [new File(['%PDF'], nome, { type: 'application/pdf' })] });
      page.escolher('c1', tipo, { target: input } as unknown as Event);
    };
    escolher('corporate', 'contrato.pdf');
    escolher('representative', 'rg.pdf');
    expect(page.anexado(item(), 'corporate')).toBe('contrato.pdf');
    page.enviar(item());
    expect(anexar.mock.calls.map(c => c[1])).toEqual(['corporate', 'representative']);
    expect(enviar).toHaveBeenCalledWith('c1');
    expect(page.aviso()).toContain('Enviado');
  });

  it('mostra a recusa do envio sem perder a lista', () => {
    const enviar = vi.fn().mockReturnValue(throwError(() => ({ status: 409, error: { message: 'Anexe o contrato social.' } })));
    const page = montar({ listar: () => of([item()]), enviar }).componentInstance;
    page.enviar(item());
    expect(page.erro()).toBe('Anexe o contrato social.');
    expect(page.itens().length).toBe(1);
  });

  it('a marca de carteira vale só para o token em que foi gravada', () => {
    SecureStorage.setToken(environment.tokenKey, 'token-da-prospeccao-0123456789abcdef');
    CarteiraService.marcarSessao('token-da-prospeccao-0123456789abcdef');
    expect(CarteiraService.sessaoAtiva()).toBe(true);
    SecureStorage.setToken(environment.tokenKey, 'outro-login-normal-fedcba9876543210');
    expect(CarteiraService.sessaoAtiva()).toBe(false);
  });
});
