import { HttpClient, provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CheckoutService } from './checkout.service';
import { InventoryPoint } from '../api/app-api.models';

const point: InventoryPoint = {
  id: 17, code: 'P-17', name: 'Peça', address: 'Rua A', city: 'São Paulo', state: 'SP',
  latitude: -23.5, longitude: -46.6, mediaType: 'Outdoor', format: '9 x 3 m',
  price: 500, available: true,
};

describe('CheckoutService', () => {
  let service: CheckoutService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });
    service = TestBed.inject(CheckoutService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('carrega campanhas e períodos elegíveis do BFF', () => {
    service.context().subscribe((context) => expect(context.campaigns[0].periods[0].codigo).toBe('P-1'));
    const request = http.expectOne('/api/wl/app/checkout/context');
    request.flush({ campaigns: [{ id: 10, code: 'C-10', name: 'Campanha', periods: [
      { codigo: 'P-1', nome: 'Bissemanal', dataInicio: '2026-10-01', dataFim: '2026-10-15' },
    ] }] });
  });

  it('envia IDs, campanha e período ao cotar; preço e disponibilidade vêm do servidor', () => {
    service.quote([point], 10, 'P-1').subscribe();
    const request = http.expectOne('/api/wl/app/checkout/quote');
    expect(request.request.body).toEqual({ pieceIds: [17], campaignId: 10, periodCode: 'P-1' });
    expect(request.request.body).not.toHaveProperty('price');
    request.flush({ quoteId: 'Q1', items: [], total: 550, expiresAt: new Date().toISOString() });
  });

  it('envia a chave idempotente ao confirmar pedido', () => {
    service.placeOrder({ quoteId: 'Q1', items: [], total: 550, expiresAt: new Date().toISOString() }, 'key-1')
      .subscribe((confirmation) => expect(confirmation.orderCode).toBe('O1'));
    const request = http.expectOne('/api/wl/app/checkout/orders');
    expect(request.request.body).toEqual({ quoteId: 'Q1', termsAccepted: true, termsVersion: 'aurum-v1' });
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    request.flush({ orders: [{ code: 'O1', city: 'São Paulo', period: 'P-1' }], total: 550, acceptedAt: new Date().toISOString() });
  });
});
