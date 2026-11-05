import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../environments/environment';
import { SecureStorage } from '../core/auth/secure-storage';
import { CarteiraService } from '../core/carteira/carteira.service';
import { AppShellComponent } from './aurum-shell.component';

function links() {
  TestBed.configureTestingModule({
    imports: [AppShellComponent],
    providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
  });
  const fixture = TestBed.createComponent(AppShellComponent);
  fixture.detectChanges();
  return Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('nav a')).map(a => a.textContent?.trim());
}

describe('Menu "Meus clientes" (VEI-RD-157e)', () => {
  afterEach(() => { localStorage.clear(); TestBed.resetTestingModule(); });

  it('aparece logo depois da entrada pela Prospecção, sem o usuário carregado', () => {
    SecureStorage.setToken(environment.tokenKey, 'cabecalho.corpo.assinatura-da-sessao-de-carteira');
    CarteiraService.marcarSessao('cabecalho.corpo.assinatura-da-sessao-de-carteira');
    expect(links()).toContain('Meus clientes');
  });

  it('não aparece sem a marca de carteira', () => {
    SecureStorage.setToken(environment.tokenKey, 'cabecalho.corpo.assinatura-de-login-comum');
    expect(links()).not.toContain('Meus clientes');
  });

  it('não aparece se outro login trocou o token', () => {
    CarteiraService.marcarSessao('cabecalho.corpo.assinatura-da-sessao-de-carteira');
    SecureStorage.setToken(environment.tokenKey, 'cabecalho.corpo.outro-token-de-outro-login');
    expect(links()).not.toContain('Meus clientes');
  });
});
