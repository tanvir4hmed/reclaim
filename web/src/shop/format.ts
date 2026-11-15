import type { ProductMeta } from '../products/catalog';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function money(cents: number): string {
  return usd.format(cents / 100);
}

export function hours(n: number): string {
  if (n === 1) return '1 hour';
  return `${new Intl.NumberFormat('en-US').format(n)} hours`;
}

export function priceLabel(p: ProductMeta, haunted: boolean): string {
  return haunted ? p.haunted.price : money(p.day.price);
}

export function discountPercent(p: ProductMeta): number | null {
  if (!p.day.was || p.day.was <= p.day.price) return null;
  return Math.round((1 - p.day.price / p.day.was) * 100);
}

export function totalLabel(total: number, haunted: boolean): string {
  return haunted ? `${hours(total)} of your life` : money(total);
}
