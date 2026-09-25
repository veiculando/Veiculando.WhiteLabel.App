import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventoryFilters, InventoryPoint, InventorySearch } from '../api/app-api.models';

const PROTOTYPE_POINTS: InventoryPoint[] = [
  { id: 101, code: 'SP-OU-0142', name: 'Paulista · Consolação', address: 'Av. Paulista, 1.421', city: 'São Paulo', state: 'SP', latitude: -23.5614, longitude: -46.6559, mediaType: 'Outdoor', format: '9 x 3 m', price: 8450, available: true, audience: 380000, illuminated: true },
  { id: 102, code: 'SP-RE-0288', name: 'Faria Lima · Itaim', address: 'Av. Brigadeiro Faria Lima, 3.477', city: 'São Paulo', state: 'SP', latitude: -23.5855, longitude: -46.6828, mediaType: 'Relógio de rua', format: '1,20 x 1,80 m', price: 5250, available: true, audience: 265000, illuminated: true },
  { id: 103, code: 'SP-DO-0081', name: 'Pinheiros · Rebouças', address: 'Av. Rebouças, 2.910', city: 'São Paulo', state: 'SP', latitude: -23.5709, longitude: -46.6913, mediaType: 'Digital OOH', format: 'LED 4K', price: 12700, available: false, audience: 420000, illuminated: true },
  { id: 104, code: 'SP-OU-0320', name: 'Moema · Ibirapuera', address: 'Av. Ibirapuera, 2.121', city: 'São Paulo', state: 'SP', latitude: -23.6014, longitude: -46.6654, mediaType: 'Outdoor', format: '9 x 3 m', price: 7900, available: true, audience: 310000 },
];

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);

  filters(): Observable<InventoryFilters> {
    if (environment.usePrototypeFixtures) {
      return of({
        mediaTypes: [...new Set(PROTOTYPE_POINTS.map(point => point.mediaType))].sort(),
        cities: [...new Map(PROTOTYPE_POINTS.map(point => [`${point.city}/${point.state}`, { name: point.city, state: point.state }])).values()],
        periods: [{ code: 'DEMO-P1', name: 'Próximos 14 dias', periodicity: 'Bissemanal', startDate: new Date().toISOString(), endDate: new Date(Date.now() + 14 * 86_400_000).toISOString() }],
        audience: { ageRanges: [], incomeRanges: [], psychographicProfiles: [], poiCategories: [] },
      });
    }
    return this.http.get<InventoryFilters>(`${environment.bffUrl}/app/inventory/filters`);
  }

  search(filter: InventorySearch): Observable<InventoryPoint[]> {
    if (environment.usePrototypeFixtures) {
      const query = filter.query?.trim().toLocaleLowerCase('pt-BR');
      let invested = 0;
      return of(PROTOTYPE_POINTS.filter((point) =>
        (!query || `${point.name} ${point.address} ${point.mediaType}`.toLocaleLowerCase('pt-BR').includes(query)) &&
        (!filter.city || point.city.toLocaleLowerCase('pt-BR').includes(filter.city.trim().toLocaleLowerCase('pt-BR'))) &&
        (!filter.mediaType || point.mediaType === filter.mediaType) &&
        (filter.minPrice == null || point.price >= filter.minPrice) &&
        (filter.maxPrice == null || point.price <= filter.maxPrice)
      ).map(point => {
        const recommended = filter.totalBudget != null && point.available && invested + point.price <= filter.totalBudget;
        if (recommended) invested += point.price;
        return { ...point, recommended };
      }));
    }

    let params = new HttpParams();
    Object.entries(filter).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') params = params.set(key, String(value));
    });
    return this.http.get<InventoryPoint[]>(`${environment.bffUrl}/app/inventory`, { params });
  }

  getByCode(code: string): Observable<InventoryPoint> {
    if (environment.usePrototypeFixtures) {
      const point = PROTOTYPE_POINTS.find((item) => item.code === code);
      return point ? of(point) : throwError(() => new Error('Peça não encontrada.'));
    }
    return this.http.get<InventoryPoint>(`${environment.bffUrl}/app/inventory/${encodeURIComponent(code)}`);
  }
}
