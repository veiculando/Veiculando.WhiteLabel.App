import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AurumSuccessPage } from './aurum-success.page';

registerLocaleData(localePt, 'pt-BR');

// VEI-SUP-62: a simulação é salva sem cotação, então a confirmação mostra o valor gravado (preço do período).
describe('confirmação da simulação', () => {
  afterEach(() => history.replaceState(null, ''));

  it('mostra que é simulação, o número e o valor gravado, sem os passos da compra', () => {
    history.replaceState({ order: { orderCode: 'WMAB2Q-ABA1-E363', total: 8003.39, createdAt: '', simulation: true } }, '');
    TestBed.configureTestingModule({ imports: [AurumSuccessPage], providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(AurumSuccessPage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Simulação salva na campanha');
    expect(text).toContain('WMAB2Q-ABA1-E363');
    expect(text).toMatch(/R\$\s?8\.003,39/);
    expect(text).toContain('aba Pedidos');
    expect(text).not.toContain('O que acontece a seguir');
  });
});
