import { CartService } from './cart.service';
import { InventoryPoint } from '../api/app-api.models';

const point: InventoryPoint = {
  id: 17, code: 'P-17', name: 'Peça', address: 'Rua A', city: 'São Paulo', state: 'SP',
  latitude: -23.5, longitude: -46.6, mediaType: 'Outdoor', format: '9 x 3 m',
  price: 500, available: true,
};

describe('CartService', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('preserva a seleção e impede peça duplicada', () => {
    const cart = new CartService();
    cart.add(point);
    cart.add(point);
    expect(cart.count()).toBe(1);
    expect(new CartService().items()).toEqual([point]);
    cart.remove(point.id);
    expect(cart.count()).toBe(0);
  });

  it('descarta estado persistido inválido', () => {
    sessionStorage.setItem('veiculando-wl.cart', JSON.stringify([{ id: '17', price: '500' }]));
    expect(new CartService().items()).toEqual([]);
  });
});
