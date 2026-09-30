import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { KycService } from '../../core/kyc/kyc.service';
import { OnboardingPage } from './onboarding.page';

describe('onboarding da organização', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [OnboardingPage],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ tipo: 'ad' }) } } },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: KycService, useValue: { submit: vi.fn() } },
      ],
    });
  });

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  it('consulta um CEP completo e preenche somente os dados de endereço, preservando número e complemento', async () => {
    const fixture = TestBed.createComponent(OnboardingPage);
    const page = fixture.componentInstance;
    page.form.patchValue({ number: '123', complement: 'Sala 5' });
    page.form.controls.zipCode.setValue('04107-000');
    await new Promise(resolve => setTimeout(resolve, 350));

    TestBed.inject(HttpTestingController).expectOne('https://viacep.com.br/ws/04107000/json/').flush({
      cep: '04107-000', logradouro: 'Rua Vergueiro', bairro: 'Vila Mariana', localidade: 'São Paulo', uf: 'SP',
    });

    expect(page.form.getRawValue()).toMatchObject({ street: 'Rua Vergueiro', district: 'Vila Mariana', city: 'São Paulo', state: 'SP', number: '123', complement: 'Sala 5' });
    fixture.destroy();
  });

  it('mantém edição manual de logradouro feita enquanto a consulta está em curso', async () => {
    const fixture = TestBed.createComponent(OnboardingPage);
    const page = fixture.componentInstance;
    page.form.controls.zipCode.setValue('01001-000');
    await new Promise(resolve => setTimeout(resolve, 350));
    const request = TestBed.inject(HttpTestingController).expectOne('https://viacep.com.br/ws/01001000/json/');
    page.form.controls.street.setValue('Endereço informado pelo usuário');
    request.flush({ cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP' });
    expect(page.form.controls.street.value).toBe('Endereço informado pelo usuário');
    fixture.destroy();
  });

  it('descarta a resposta de um CEP anterior quando o usuário troca o número', async () => {
    const fixture = TestBed.createComponent(OnboardingPage);
    const page = fixture.componentInstance;
    page.form.controls.zipCode.setValue('01001-000');
    await new Promise(resolve => setTimeout(resolve, 350));
    const oldRequest = TestBed.inject(HttpTestingController).expectOne('https://viacep.com.br/ws/01001000/json/');
    page.form.controls.zipCode.setValue('04107-000');
    expect(oldRequest.cancelled).toBe(true);
    await new Promise(resolve => setTimeout(resolve, 350));
    TestBed.inject(HttpTestingController).expectOne('https://viacep.com.br/ws/04107000/json/').flush({
      cep: '04107-000', logradouro: 'Rua Vergueiro', bairro: 'Vila Mariana', localidade: 'São Paulo', uf: 'SP',
    });
    expect(page.form.controls.street.value).toBe('Rua Vergueiro');
    fixture.destroy();
  });
});
