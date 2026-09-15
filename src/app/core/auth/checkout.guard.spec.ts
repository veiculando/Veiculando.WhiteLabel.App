import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of, throwError } from 'rxjs';
import { AdvertiserAuthService } from './advertiser-auth.service';
import { checkoutGuard } from './checkout.guard';

describe('checkoutGuard', () => {
  const loadMe = vi.fn();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AdvertiserAuthService, useValue: { loadMe } }],
    });
    loadMe.mockReset();
  });

  async function activate() {
    const result = TestBed.runInInjectionContext(() => checkoutGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));
    return firstValueFrom(result as Observable<boolean | UrlTree>);
  }

  it('libera somente KYC aprovado obtido novamente do BFF', async () => {
    loadMe.mockReturnValue(of({ kycStatus: 'approved' }));
    expect(await activate()).toBe(true);
    expect(loadMe).toHaveBeenCalledOnce();
  });

  it('redireciona cadastro pendente para o status KYC', async () => {
    loadMe.mockReturnValue(of({ kycStatus: 'pending' }));
    expect((await activate() as UrlTree).toString()).toBe('/kyc-status');
  });

  it('falha fechado quando a sessão não pode ser validada', async () => {
    loadMe.mockReturnValue(throwError(() => new Error('BFF indisponível')));
    expect((await activate() as UrlTree).toString()).toBe('/login');
  });
});
