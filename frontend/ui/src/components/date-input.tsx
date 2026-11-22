import type { InputHTMLAttributes } from 'react';
import { cn } from 'cn';
import { controlClasses } from '#components/field';

export type DateInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>;

/** Native date picker. The value is `rrrr-mm-dd`, the browser shows it in the Polish format. */
export function DateInput({ className, ...props }: DateInputProps) {
  return (
    <input type="date" className={cn(controlClasses, 'max-w-[15rem]', className)} {...props} />
  );
}
