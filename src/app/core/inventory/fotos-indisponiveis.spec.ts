import { FotosIndisponiveis } from './fotos-indisponiveis';

describe('FotosIndisponiveis', () => {
  it('marca só a peça cuja foto falhou', () => {
    const fotos = new FotosIndisponiveis();
    fotos.marcar(7);
    expect(fotos.tem(7)).toBe(true);
    expect(fotos.tem(8)).toBe(false);
  });
});
