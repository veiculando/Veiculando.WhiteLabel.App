import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  it('carrega opções de filtros independentes da lista de resultados', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withXhr()), provideHttpClientTesting()] });
    const service = TestBed.inject(InventoryService);
    const http = TestBed.inject(HttpTestingController);
    service.filters().subscribe(filters => expect(filters.mediaTypes).toEqual(['Outdoor', 'LED']));
    http.expectOne('/api/wl/app/inventory/filters').flush({ mediaTypes: ['Outdoor', 'LED'], cities: [], periods: [], audience: { ageRanges: [], incomeRanges: [], psychographicProfiles: [] } });
    http.verify();
  });
  it('envia verba total e categorias POI sem transformar a verba em preço por peça', () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(withXhr()), provideHttpClientTesting()] });
    const service = TestBed.inject(InventoryService);
    const http = TestBed.inject(HttpTestingController);
    service.search({ totalBudget: 30000, poiCategoryIds: '2,4' }).subscribe();
    const request = http.expectOne(r => r.url === '/api/wl/app/inventory');
    expect(request.request.params.get('totalBudget')).toBe('30000');
    expect(request.request.params.get('poiCategoryIds')).toBe('2,4');
    expect(request.request.params.has('maxPrice')).toBe(false);
    request.flush([]);
    http.verify();
  });
});
