import { FormControl } from '@angular/forms';
import { exactDigits, formatBrazilianPhone, formatCep, formatCnpj, formatCpf, onlyDigits } from './brazilian-fields';

describe('campos brasileiros', () => {
  it('formata CNPJ, CPF e CEP, inclusive entradas parciais, sem aceitar excesso', () => {
    expect(formatCnpj('29689492000156')).toBe('29.689.492/0001-56');
    expect(formatCnpj('296')).toBe('29.6');
    expect(formatCnpj('29689492000156999')).toBe('29.689.492/0001-56');
    expect(formatCpf('12345678909')).toBe('123.456.789-09');
    expect(formatCep('04107000')).toBe('04107-000');
    expect(formatCep('0410700099')).toBe('04107-000');
  });

  it('formata telefone fixo ou celular e normaliza a carga enviada ao BFF', () => {
    expect(formatBrazilianPhone('1133334444')).toBe('(11) 3333-4444');
    expect(formatBrazilianPhone('11999996299')).toBe('(11) 99999-6299');
    expect(onlyDigits('(11) 99999-6299')).toBe('11999996299');
  });

  it('exige a quantidade exata de dígitos para campos estruturados', () => {
    const control = new FormControl('04107-00');
    expect(exactDigits([8])(control)).not.toBeNull();
    control.setValue('04107-000');
    expect(exactDigits([8])(control)).toBeNull();
  });
});
