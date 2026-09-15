import { Injectable, computed, signal } from '@angular/core';
import { InventoryPoint } from '../api/app-api.models';

const CART_KEY = 'veiculando-wl.cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly state = signal<InventoryPoint[]>(this.restore());
  readonly items = this.state.asReadonly();
  readonly count = computed(() => this.state().length);
  readonly subtotal = computed(() => this.state().reduce((sum, item) => sum + item.price, 0));

  add(item: InventoryPoint) {
    if (this.state().some((current) => current.id === item.id)) return;
    this.commit([...this.state(), item]);
  }

  remove(id: number) { this.commit(this.state().filter((item) => item.id !== id)); }
  clear() { this.commit([]); }
  contains(id: number) { return this.state().some((item) => item.id === id); }

  private commit(items: InventoryPoint[]) {
    this.state.set(items);
    sessionStorage.setItem(CART_KEY, JSON.stringify(items));
  }

  private restore(): InventoryPoint[] {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(CART_KEY) ?? '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is InventoryPoint =>
        item !== null && typeof item === 'object' &&
        Number.isInteger(item.id) && typeof item.code === 'string' &&
        typeof item.name === 'string' && Number.isFinite(item.price)
      );
    }
    catch { return []; }
  }
}
