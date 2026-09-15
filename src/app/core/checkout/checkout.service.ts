import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { delay, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CheckoutQuote, InventoryPoint, OrderConfirmation } from '../api/app-api.models';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  private readonly http = inject(HttpClient);

  quote(items: InventoryPoint[]) {
    if (environment.usePrototypeFixtures) {
      const quote: CheckoutQuote = {
        quoteId: `preview-${Date.now()}`,
        items: items.map((item) => ({ ...item, serverPrice: item.price })),
        total: items.reduce((sum, item) => sum + item.price, 0),
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
        prototype: true,
      };
      return of(quote).pipe(delay(250));
    }
    return this.http.post<CheckoutQuote>(`${environment.bffUrl}/app/checkout/quote`, { pieceIds: items.map((item) => item.id) });
  }

  placeOrder(quote: CheckoutQuote, idempotencyKey: string) {
    if (environment.usePrototypeFixtures) {
      return of<OrderConfirmation>({
        orderCode: `PREVIEW-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        total: quote.total,
        createdAt: new Date().toISOString(),
        prototype: true,
      }).pipe(delay(500));
    }
    return this.http.post<OrderConfirmation>(`${environment.bffUrl}/app/checkout/orders`, { quoteId: quote.quoteId }, { headers: { 'Idempotency-Key': idempotencyKey } });
  }
}
