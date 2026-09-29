import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

export const onlyDigits = (value: string): string => value.replace(/\D/g, '');

export function formatCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits.replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

export function formatCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2');
}

export function formatCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  return digits.replace(/^(\d{5})(\d)/, '$1-$2');
}

export function formatBrazilianPhone(raw: string): string {
  const digits = onlyDigits(raw).slice(0, 11);
  const area = digits.slice(0, 2);
  const local = digits.slice(2);
  const splitAt = digits.length > 10 ? 5 : 4;
  return !digits ? '' : digits.length <= 2 ? `(${area}` : `(${area}) ${local.slice(0, splitAt)}${local.length > splitAt ? `-${local.slice(splitAt)}` : ''}`;
}

export function exactDigits(lengths: number[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null =>
    lengths.includes(onlyDigits(String(control.value ?? '')).length) ? null : { digitLength: { lengths } };
}
