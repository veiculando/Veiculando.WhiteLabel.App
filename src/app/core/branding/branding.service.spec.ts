import { DOCUMENT } from '@angular/common';
import { provideHttpClient, withXhr } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { BrandingService } from './branding.service';

describe('BrandingService', () => {
  let service: BrandingService;
  let http: HttpTestingController;
  let document: Document;
  let title: Title;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting()],
    });

    service = TestBed.inject(BrandingService);
    http = TestBed.inject(HttpTestingController);
    document = TestBed.inject(DOCUMENT);
    title = TestBed.inject(Title);
  });

  afterEach(() => http.verify());

  it('carrega branding same-origin e aplica identidade em runtime', async () => {
    const carregamento = service.load();
    const req = http.expectOne('/api/wl/config/branding');

    req.flush({
      nomeExibicao: 'Marca B',
      logoUrl: '/assets/marca-b.svg',
      faviconUrl: '/assets/marca-b.ico',
      primaryColor: '#112233',
      secondaryColor: '#334455',
      accentColor: '#ffcc00',
      footerText: 'Marca B',
      seoTitle: 'Portal Marca B',
      seoDescription: 'Descricao B',
    });
    await carregamento;

    expect(service.branding()?.nomeExibicao).toBe('Marca B');
    expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('#112233');
    expect(document.documentElement.style.getPropertyValue('--secondary-color')).toBe('#334455');
    expect(document.documentElement.style.getPropertyValue('--primary-light')).toBe('#ffcc00');
    expect(document.documentElement.style.getPropertyValue('--gold-accent')).toBe('#334455');
    expect(title.getTitle()).toBe('Portal Marca B');
  });

  it('limpa a identidade anterior quando o payload obrigatorio e invalido', async () => {
    document.documentElement.style.setProperty('--primary-color', '#abcdef');

    const carregamento = service.load();
    http.expectOne('/api/wl/config/branding').flush({
      nomeExibicao: 'Sem logo',
      primaryColor: '#112233',
    });

    await expect(carregamento).rejects.toThrow('logoUrl');
    expect(service.branding()).toBeNull();
    expect(document.documentElement.style.getPropertyValue('--primary-color')).toBe('');
  });
});
