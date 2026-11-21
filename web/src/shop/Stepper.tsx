import { MAX_QTY } from '../core';

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  label: string;
  min?: number;
  max?: number;
}

export function Stepper({ value, onChange, label, min = 1, max = MAX_QTY }: StepperProps) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" aria-label="Decrease quantity" disabled={value <= min} onClick={() => onChange(value - 1)}>
        −
      </button>
      <output aria-live="polite" aria-label="Quantity">
        {value}
      </output>
      <button type="button" aria-label="Increase quantity" disabled={value >= max} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
