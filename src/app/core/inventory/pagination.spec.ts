import { clampPage, pageCount, pageItems } from './pagination';

describe('paginação do inventário', () => {
  const points = Array.from({ length: 23 }, (_, index) => index + 1);

  it('divide resultados sem afetar o total nem a última página', () => {
    expect(pageCount(points.length, 10)).toBe(3);
    expect(pageItems(points, 1, 10)).toEqual(points.slice(0, 10));
    expect(pageItems(points, 3, 10)).toEqual([21, 22, 23]);
  });

  it('limita a navegação às páginas existentes', () => {
    expect(clampPage(0, 23, 10)).toBe(1);
    expect(clampPage(5, 23, 10)).toBe(3);
    expect(clampPage(2, 0, 10)).toBe(1);
  });
});
