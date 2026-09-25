import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { delay, map, Observable, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckoutCampaign, CheckoutContext, CheckoutQuote, InventoryPoint, OrderConfirmation } from '../api/app-api.models';

interface OrderReceipt {
  orders: Array<{ code: string; city: string; period: string }>;
  total: number;
  acceptedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);

  context() {
    if (environment.usePrototypeFixtures) {
      return of<CheckoutContext>({ campaigns: [{ id: 1, code: 'DEMO', name: 'Campanha de demonstração', periods: [{
        codigo: 'DEMO-P1', nome: 'Período demonstrativo', dataInicio: new Date().toISOString(), dataFim: new Date(Date.now() + 14 * 86_400_000).toISOString(),
      }] }] });
    }
    return this.http.get<CheckoutContext>(`${environment.bffUrl}/app/checkout/context`);
  }

  createCampaign(payload: { name: string; product: string; job?: string; startDate: string; endDate: string; budget: number | null }) {
    if (environment.usePrototypeFixtures) {
      return of<Pick<CheckoutCampaign, 'id' | 'code' | 'name'>>({ id: Date.now(), code: 'DEMO', name: payload.name });
    }
    return this.http.post<Pick<CheckoutCampaign, 'id' | 'code' | 'name'>>(`${environment.bffUrl}/app/checkout/context/campaigns`, payload);
  }

  quote(items: InventoryPoint[], campaignId: number, periodCode: string) {
    if (environment.usePrototypeFixtures) {
      const quote: CheckoutQuote = {
        quoteId: `preview-${Date.now()}`,
        items: items.map((item) => ({ id: item.id, code: item.code, serverPrice: item.price })),
        total: items.reduce((sum, item) => sum + item.price, 0),
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        prototype: true,
      };
      return of(quote).pipe(delay(250));
    }
    return this.http.post<CheckoutQuote>(`${environment.bffUrl}/app/checkout/quote`, { pieceIds: items.map((item) => item.id), campaignId, periodCode });
  }

  placeOrder(quote: CheckoutQuote, idempotencyKey: string): Observable<OrderConfirmation> {
    if (environment.usePrototypeFixtures) {
      return of<OrderConfirmation>({
        orderCode: `PREVIEW-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        total: quote.total,
        createdAt: new Date().toISOString(),
        prototype: true,
      }).pipe(delay(500));
    }
    return this.http.post<OrderReceipt>(`${environment.bffUrl}/app/checkout/orders`, {
      quoteId: quote.quoteId, termsAccepted: true, termsVersion: 'aurum-v1',
    }, { headers: { 'Idempotency-Key': idempotencyKey } }).pipe(map((receipt) => ({
      orderCode: receipt.orders.map((order) => order.code).join(', '),
      orderCodes: receipt.orders.map((order) => order.code),
      total: receipt.total,
      createdAt: receipt.acceptedAt,
    })));
  }
}
