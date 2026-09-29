export const pageCount = (total: number, pageSize: number): number => Math.ceil(total / pageSize);

export const clampPage = (page: number, total: number, pageSize: number): number =>
  Math.max(1, Math.min(page, pageCount(total, pageSize)));

export const pageItems = <T>(items: T[], page: number, pageSize: number): T[] =>
  items.slice((page - 1) * pageSize, page * pageSize);
