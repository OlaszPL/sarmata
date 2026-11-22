import type { InputHTMLAttributes } from 'react';
import { cn } from 'cn';
import { controlClasses } from '#components/field';

export type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

/** Single-line text input. Put it inside `Field`, which gives it the id, label and messages. */
export function TextInput({ className, type = 'text', ...props }: TextInputProps) {
  return <input type={type} className={cn(controlClasses, className)} {...props} />;
}
