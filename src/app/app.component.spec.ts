import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { BrandingService } from './core/branding/branding.service';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: BrandingService,
          useValue: {
            branding: signal({
              nomeExibicao: 'Marca B',
              logoUrl: '/marca-b.svg',
              primaryColor: '#112233',
              secondaryColor: '#334455',
              accentColor: '#ffcc00',
              footerText: 'Rodape B',
            }).asReadonly(),
          },
        },
      ],
    }).compileComponents();
  });

  it('renderiza a identidade carregada em runtime', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('Marca B');
    expect(compiled.querySelector('img')?.getAttribute('src')).toBe('/marca-b.svg');
    expect(compiled.querySelector('footer')?.textContent).toContain('Rodape B');
  });
});
