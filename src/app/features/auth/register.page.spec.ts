import { formatBrazilianPhone } from './register.page';

describe('cadastro Aurum', () => {
  it('formata celular e limita a 11 dígitos', () => {
    expect(formatBrazilianPhone('11999996299')).toBe('(11) 99999-6299');
    expect(formatBrazilianPhone('(11) 3333-4444')).toBe('(11) 3333-4444');
    expect(formatBrazilianPhone('119999962991234')).toBe('(11) 99999-6299');
  });

  it('preserva entrada parcial sem acrescentar dígitos', () => {
    expect(formatBrazilianPhone('11')).toBe('(11');
    expect(formatBrazilianPhone('119')).toBe('(11) 9');
  });
});
