import { assertNonnegativeInt } from '../../domain/validation.ts';

export function dollarsToCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) throw new Error('Enter a nonnegative USD amount with at most two decimal places.');
  const [whole, fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  assertNonnegativeInt(cents, 'amount');
  return cents;
}
