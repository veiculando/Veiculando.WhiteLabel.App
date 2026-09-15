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

  it('envia apenas IDs ao cotar; preço e disponibilidade vêm do servidor', () => {
    service.quote([point]).subscribe();
    const request = http.expectOne('/api/wl/app/checkout/quote');
    expect(request.request.body).toEqual({ pieceIds: [17] });
    expect(request.request.body).not.toHaveProperty('price');
    request.flush({ quoteId: 'Q1', items: [], total: 550, expiresAt: new Date().toISOString() });
  });

  it('envia a chave idempotente ao confirmar pedido', () => {
    service.placeOrder({ quoteId: 'Q1', items: [], total: 550, expiresAt: new Date().toISOString() }, 'key-1').subscribe();
    const request = http.expectOne('/api/wl/app/checkout/orders');
    expect(request.request.body).toEqual({ quoteId: 'Q1' });
    expect(request.request.headers.get('Idempotency-Key')).toBe('key-1');
    request.flush({ orderCode: 'O1', total: 550, createdAt: new Date().toISOString() });
  });
});
