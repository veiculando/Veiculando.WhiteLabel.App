import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';

export interface CepAddress {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

@Injectable({ providedIn: 'root' })
export class CepService {
  private readonly http = inject(HttpClient);

  lookup(cep: string) {
    return this.http.get<CepAddress>(`https://viacep.com.br/ws/${cep}/json/`);
  }
}
