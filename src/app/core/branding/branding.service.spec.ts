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

  afterEach(() => {
    http.verify();
    document.querySelectorAll('link[rel~="icon"]').forEach(link => link.remove());
  });

  it('mantem um favicon distinto da logo, removendo icones residuais', async () => {
    for (let i = 0; i < 2; i++) {
      const link = document.createElement('link');
      link.rel = 'icon';
      link.href = '/marca-anterior.ico';
      document.head.appendChild(link);
    }
    const load = service.load();
    http.expectOne('/api/wl/config/branding').flush({
      nomeExibicao: 'Aurum', logoUrl: '/logo.png',
      faviconUrl: 'https://assets.example.com/favicon-v2.png', primaryColor: '#A80009',
    });
    await load;
    const icons = document.querySelectorAll('link[rel~="icon"]');
    expect(icons.length).toBe(1);
    expect(icons[0].getAttribute('href')).toBe('https://assets.example.com/favicon-v2.png');
    expect(service.branding()?.logoUrl).toBe('/logo.png');
  });

  it('favicon invalido ou indisponivel usa fallback neutro, nunca a logo', async () => {
    for (const faviconUrl of ['javascript:alert(1)', 'https://assets.example.com/ausente.png']) {
      const load = service.load();
      http.expectOne('/api/wl/config/branding').flush({
        nomeExibicao: 'Marca', logoUrl: '/logo.png', faviconUrl, primaryColor: '#112233',
      });
      await load;
      const icon = document.querySelector('link[rel~="icon"]')!;
      if (faviconUrl.startsWith('https:')) icon.dispatchEvent(new Event('error'));
      expect(icon.getAttribute('href')).toBe('/favicon-neutral.svg');
    }
  });

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
