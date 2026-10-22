'use client';

import { useRef, useState } from 'react';
import type { ChangeEvent, ComponentPropsWithoutRef } from 'react';
import { cents } from '../../lib/model';

type MoneyInputProps = Omit<ComponentPropsWithoutRef<'input'>, 'type' | 'value' | 'defaultValue' | 'onChange'> & {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
};

function toCents(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = cents(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function format(centsValue: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(centsValue / 100);
}

function display(value: string | undefined) {
  const parsed = toCents(value);
  return parsed === null ? '' : format(parsed);
}

export default function MoneyInput({ value, defaultValue, onChange, inputMode = 'decimal', ...props }: MoneyInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [internalValue, setInternalValue] = useState(() => display(defaultValue));
  const shownValue = value === undefined ? internalValue : display(value);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.currentTarget.value.replace(/\D/g, '').slice(0, 14);
    const nextCents = digits && Number(digits) > 0 ? Number(digits) : null;
    const nextValue = nextCents === null ? '' : format(nextCents);
    const distanceFromEnd = event.currentTarget.value.length - (event.currentTarget.selectionStart ?? event.currentTarget.value.length);
    if (value === undefined) setInternalValue(nextValue);
    onChange?.(nextCents === null ? '' : (nextCents / 100).toFixed(2));
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (input) {
        const position = Math.max(0, Math.min(input.value.length, input.value.length - distanceFromEnd));
        input.setSelectionRange(position, position);
      }
    });
  }

  return <input {...props} ref={inputRef} type="text" inputMode={inputMode} value={shownValue} onChange={handleChange} autoComplete="off"/>;
}
