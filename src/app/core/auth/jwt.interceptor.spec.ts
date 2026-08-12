import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { jwtInterceptor } from './jwt.interceptor';
import { SecureStorage } from './secure-storage';

describe('jwtInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([jwtInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('envia somente o bearer e nunca envia identificador de tenant', () => {
    spyOn(SecureStorage, 'getToken').and.returnValue('token-cliente');

    http.get('/api/wl/teste').subscribe();

    const req = controller.expectOne('/api/wl/teste');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-cliente');
    expect(req.request.headers.has('X-Tenant-AfiliadaId')).toBeFalse();
    req.flush({});
  });
});
