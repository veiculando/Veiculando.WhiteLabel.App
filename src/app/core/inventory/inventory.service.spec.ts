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
    http.expectOne('/api/wl/app/inventory/filters').flush({ mediaTypes: ['Outdoor', 'LED'], cities: [] });
    http.verify();
  });
});
