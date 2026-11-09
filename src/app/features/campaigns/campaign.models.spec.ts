import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AppClients, CampaignDetail, destinoMinhasCampanhas, filtrarClientes, mensagensDoServidor } from './campaign.models';
import { CampaignsService } from './campaigns.service';
import { CampaignFormComponent, verbaValida } from './campaign-form.component';
import { agruparPedidos } from './campaign-detail.page';
import { filtrarCampanhas } from './campaigns.page';
import { FormControl } from '@angular/forms';

const clients = (perfil: AppClients['perfil'], n: number): AppClients => ({
  perfil, podeAdicionarAnunciante: false,
  clientes: Array.from({ length: n }, (_, i) => ({ id: i + 1, nome: `Cliente ${i + 1}`, cnpj: `11.222.333/0001-8${i}` })),
});

describe('Minhas Campanhas — roteamento (VEI-RD-67a)', () => {
  it('anunciante direto e carteira com 1 cliente vão ao painel com o cliente', () => {
    expect(destinoMinhasCampanhas(clients('anunciante_direto', 1), null)).toEqual({ tipo: 'painel', clienteId: 1 });
    expect(destinoMinhasCampanhas(clients('agencia', 1), null)).toEqual({ tipo: 'painel', clienteId: 1 });
  });
  it('agência sem cliente abre o painel vazio; com vários, o gateway', () => {
    expect(destinoMinhasCampanhas(clients('agencia', 0), null)).toEqual({ tipo: 'painel', clienteId: null });
    expect(destinoMinhasCampanhas(clients('carteira', 3), null)).toEqual({ tipo: 'gateway' });
  });
  it('mantém o cliente da URL só se ele estiver na carteira', () => {
    expect(destinoMinhasCampanhas(clients('agencia', 3), 2)).toEqual({ tipo: 'painel', clienteId: 2 });
    expect(destinoMinhasCampanhas(clients('agencia', 3), 99)).toEqual({ tipo: 'gateway' });
  });
});

describe('Gateway e painel — buscas locais', () => {
  it('busca cliente por nome ou CNPJ com ou sem máscara', () => {
    const lista = clients('agencia', 3).clientes;
    expect(filtrarClientes(lista, 'cliente 2').map(c => c.id)).toEqual([2]);
    expect(filtrarClientes(lista, '11222333000182').map(c => c.id)).toEqual([3]);
    expect(filtrarClientes(lista, '  ')).toHaveLength(3);
  });
  it('filtra campanhas por status e texto', () => {
    const base = { anunciante: { id: 1, nome: 'A', cnpj: '' }, dataInicio: null, dataFim: null, budgetTotal: 0, pedidosConfirmados: 0, pedidosPendentes: 0 };
    const items = [{ ...base, codigo: 'C1', nome: 'Verão', status: 'rascunho' as const }, { ...base, codigo: 'C2', nome: 'Natal', status: 'cancelada' as const }];
    expect(filtrarCampanhas(items, '', 'cancelada').map(i => i.codigo)).toEqual(['C2']);
    expect(filtrarCampanhas(items, 'c1', null).map(i => i.codigo)).toEqual(['C1']);
  });
});

describe('Erros do servidor e validação do modal (VEI-RD-68c)', () => {
  it('mostra details[] do 400 e cai na message nos demais', () => {
    expect(mensagensDoServidor({ error: { message: 'x', details: ['Verba abaixo do comprometido.'] } }, 'f')).toEqual(['Verba abaixo do comprometido.']);
    expect(mensagensDoServidor({ error: { message: 'Só é possível editar campanha em rascunho.' } }, 'f')).toEqual(['Só é possível editar campanha em rascunho.']);
    expect(mensagensDoServidor(null, 'f')).toEqual(['f']);
  });
  it('verba opcional, de 1.000 a 100.000.000 de mil em mil', () => {
    expect(verbaValida(new FormControl(null))).toBeNull();
    expect(verbaValida(new FormControl(5000))).toBeNull();
    expect(verbaValida(new FormControl(500))).toEqual({ faixa: true });
    expect(verbaValida(new FormControl(1500))).toEqual({ passo: true });
    expect(verbaValida(new FormControl(100_001_000))).toEqual({ faixa: true });
  });
  it('agrupa pedidos por estado e cidade sem somar nada', () => {
    const row = (estado: string, cidade: string, codigo: string) => ({ estado, cidade, codigo, periodo: { codigo: 'P', dataInicio: '', dataFim: '' }, status: 'Confirmado', simulacao: false, pecas: 1, valor: 10 });
    const grupos = agruparPedidos([row('SP', 'Campinas', '1'), row('SP', 'Campinas', '2'), row('RJ', 'Niterói', '3')]);
    expect(grupos.map(g => [g.estado, g.cidades.map(c => [c.cidade, c.pedidos.length])])).toEqual([['SP', [['Campinas', 2]]], ['RJ', [['Niterói', 1]]]]);
  });
});

describe('CampaignsService e modal contra o contrato do BFF', () => {
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); TestBed.resetTestingModule(); });

  it('lista em /app/campaigns com ?clienteId= e detalhe por código', () => {
    const api = TestBed.inject(CampaignsService);
    api.list(7).subscribe();
    http.expectOne(`${environment.bffUrl}/app/campaigns?clienteId=7`).flush([]);
    api.list(null).subscribe();
    http.expectOne(`${environment.bffUrl}/app/campaigns`).flush([]);
    api.detail('CAMP 1').subscribe();
    http.expectOne(`${environment.bffUrl}/app/campaigns/CAMP%201`).flush({});
  });

  it('agência com um cliente cria pelo POST do checkout mandando o clientId travado', () => {
    const fixture = TestBed.createComponent(CampaignFormComponent);
    fixture.componentRef.setInput('clients', clients('agencia', 1).clientes);
    fixture.componentRef.setInput('perfil', 'agencia');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('select')).toBeNull();
    fixture.componentInstance.form.patchValue({ name: 'Verão', product: 'Sorvete', budget: 2000, startDate: '2026-12-01', endDate: '2026-12-31' });
    fixture.componentInstance.salvar();
    const req = http.expectOne(`${environment.bffUrl}/app/checkout/context/campaigns`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(expect.objectContaining({ name: 'Verão', budget: 2000, clientId: 1 }));
    req.flush({ id: 1, code: 'C1', name: 'Verão' });
  });

  it('editar faz PUT e mostra os details[] do 400 no rodapé', () => {
    const fixture = TestBed.createComponent(CampaignFormComponent);
    fixture.componentRef.setInput('campaign', { codigo: 'C1', nome: 'Verão', produto: 'Sorvete', job: null, budgetTotal: 3000,
      dataInicio: '2026-12-01T00:00:00', dataFim: '2026-12-31T00:00:00', anunciante: { id: 1, nome: 'A', cnpj: '' } } as unknown as CampaignDetail);
    fixture.detectChanges();
    fixture.componentInstance.salvar();
    const req = http.expectOne(`${environment.bffUrl}/app/campaigns/C1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(expect.objectContaining({ startDate: '2026-12-01', budget: 3000 }));
    req.flush({ message: 'Não foi possível salvar a campanha.', details: ['A verba não pode ficar abaixo do comprometido.'] }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.server-errors').textContent).toContain('abaixo do comprometido');
  });
});
