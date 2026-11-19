import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdvertiserAuthService } from '../../core/auth/advertiser-auth.service';
import { CartService } from '../../core/cart/cart.service';
import { CheckoutService } from '../../core/checkout/checkout.service';
import { AurumCheckoutPage } from './aurum-checkout.page';

// VEI-SUP-48: sessão aberta com KYC pendente; a exibidora aprova depois e o checkout precisa enxergar a aprovação.
function setup(meStatus: 'approved' | 'pending', campaigns: unknown[] = [], opts: { contextFails?: boolean; createFails?: unknown } = {}) {
  const user = signal<{ name: string; email: string; kycStatus: string } | null>({ name: 'Cliente', email: 'c@x.com', kycStatus: 'pending' });
  const loadMe = vi.fn(() => { user.set({ ...user()!, kycStatus: meStatus }); return of(user()!); });
  const context = vi.fn(() => opts.contextFails ? throwError(() => new Error('rede')) : of({ campaigns }));
  const createCampaign = vi.fn(() => opts.createFails ? throwError(() => opts.createFails) : of({ id: 77, code: 'C77', name: 'Verão' }));
  TestBed.configureTestingModule({
    imports: [AurumCheckoutPage],
    providers: [provideRouter([]),
      { provide: AdvertiserAuthService, useValue: { user, loadMe, isAuthenticated: signal(true), logout: vi.fn() } },
      { provide: CheckoutService, useValue: { context, createCampaign, quote: vi.fn(), placeOrder: vi.fn() } },
      { provide: CartService, useValue: { count: () => 1, items: () => [{ id: 1, city: 'Ubatuba', state: 'SP', price: 600 }], subtotal: () => 600 } }],
  });
  const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  const page = TestBed.createComponent(AurumCheckoutPage).componentInstance;
  return { page, loadMe, context, createCampaign, navigate };
}

describe('checkout com KYC aprovado depois do login', () => {
  it('reconsulta o cadastro e carrega as campanhas mesmo com a sessão dizendo pendente', () => {
    const { page, loadMe, context } = setup('approved');
    expect(loadMe).toHaveBeenCalled();
    expect(context).toHaveBeenCalled();
    expect(page.context()?.campaigns).toEqual([]);
  });

  it('não manda para o KYC ao cotar quando o cadastro já foi aprovado', () => {
    const { page, navigate } = setup('approved');
    page.getQuote();
    expect(navigate).not.toHaveBeenCalledWith(['/kyc-status']);
  });

  it('cria a campanha no próprio checkout e recarrega o contexto', () => {
    const { page, createCampaign, context } = setup('approved');
    page.newName.set('Verão'); page.newProduct.set('Sorvete'); page.newStart.set('2026-12-01'); page.newEnd.set('2026-12-31');
    page.createCampaign();
    expect(createCampaign).toHaveBeenCalledWith(expect.objectContaining({ name: 'Verão', product: 'Sorvete', startDate: '2026-12-01', endDate: '2026-12-31' }));
    expect(context).toHaveBeenCalledTimes(2);
  });

  it('continua mandando para o KYC quando o cadastro segue pendente', () => {
    const { page, navigate, context } = setup('pending');
    expect(context).not.toHaveBeenCalled();
    page.getQuote();
    expect(navigate).toHaveBeenCalledWith(['/kyc-status']);
  });

  it('mostra o motivo devolvido pelo BFF quando a criação da campanha é recusada', () => {
    const { page } = setup('approved', [], { createFails: { status: 409, error: { message: 'O contrato com este anunciante não está vigente.' } } });
    page.newName.set('Verão'); page.newProduct.set('Sorvete'); page.newStart.set('2026-12-01'); page.newEnd.set('2026-12-31');
    page.createCampaign();
    expect(page.campaignError()).toBe('O contrato com este anunciante não está vigente.');
  });

  it('sinaliza falha ao carregar as campanhas em vez de ficar carregando', () => {
    const { page } = setup('approved', [], { contextFails: true });
    expect(page.contextFailed()).toBe(true);
  });
});
