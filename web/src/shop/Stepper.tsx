import { MAX_QTY } from '../core';

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
}

export function Stepper({ value, onChange, label, min = 1 }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite" aria-label="Quantity">
        {value}
      </output>
      <button type="button" aria-label="Increase quantity" disabled={value >= MAX_QTY} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
