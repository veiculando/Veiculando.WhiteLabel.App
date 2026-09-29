import { provideHttpClient, withXhr } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SecureStorage } from '../../core/auth/secure-storage';
import { ProspeccaoEntrarPage } from './prospeccao-entrar.page';

describe('entrada de prospecção', () => {
  const origin = 'https://wl-exibidora-preview.veiculando.com.br';
  const token = 'token-temporario-de-teste';
  const originalOpener = Object.getOwnPropertyDescriptor(window, 'opener');
  let opener: { postMessage: ReturnType<typeof vi.fn> };
  let http: HttpTestingController;
  let page: ProspeccaoEntrarPage;

  beforeEach(() => {
    opener = { postMessage: vi.fn() };
    Object.defineProperty(window, 'opener', { configurable: true, value: opener });
    window.__VEICULANDO_RUNTIME_CONFIG__ = { prospeccaoAllowedOrigins: [origin] };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withXhr()), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    page = TestBed.runInInjectionContext(() => new ProspeccaoEntrarPage());
    page.ngOnInit();
  });

  afterEach(() => {
    page.ngOnDestroy();
    http.verify();
    vi.restoreAllMocks();
    if (originalOpener) Object.defineProperty(window, 'opener', originalOpener);
    else Reflect.deleteProperty(window, 'opener');
    Reflect.deleteProperty(window, '__VEICULANDO_RUNTIME_CONFIG__');
  });

  function send(messageOrigin: string, source: MessageEventSource | null = opener as unknown as Window) {
    window.dispatchEvent(new MessageEvent('message', {
      origin: messageOrigin,
      source,
      data: { type: 'prospeccao-token', token, operadorId: 12, anuncianteId: 34 },
    }));
  }

  it('ignora origem não permitida e janela diferente, sem gastar o token', () => {
    expect(opener.postMessage).toHaveBeenCalledWith({ type: 'prospeccao-pronto' }, origin);
    send(`${origin}.evil.example`);
    send(origin, window);
    http.expectNone('/api/wl/app/prospeccao/sessao');
  });

  it('resgata token de origem permitida e abre sessão sem colocá-lo na URL ou no log', () => {
    const save = vi.spyOn(SecureStorage, 'setToken').mockImplementation(() => {});
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const log = vi.spyOn(console, 'log');
    const urlBefore = window.location.href;

    send(origin);
    const request = http.expectOne('/api/wl/app/prospeccao/sessao');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ Token: token, OperadorId: 12, AnuncianteId: 34 });
    request.flush({ token: 'jwt-app-teste', expiresInMinutes: 15, email: 'qa@example.test', prospeccao: true, fonteUsuarioId: 12 });

    expect(save).toHaveBeenCalledWith('veiculando-wl.token', 'jwt-app-teste');
    expect(navigate).toHaveBeenCalledWith(['/mapa'], { replaceUrl: true });
    expect(window.location.href).toBe(urlBefore);
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining(token));
    expect(opener.postMessage).not.toHaveBeenCalledWith(expect.objectContaining({ token }), expect.anything());
  });
});
