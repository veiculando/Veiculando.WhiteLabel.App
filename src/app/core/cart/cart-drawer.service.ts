import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class CartDrawerService {
  readonly open = signal(false);
}
