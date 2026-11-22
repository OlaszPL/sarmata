import type { ButtonHTMLAttributes } from 'react';
import { cn } from 'cn';
import { Slot } from 'radix-ui';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'link';
export type ButtonSize = 'md' | 'lg';

const base =
  'font-heading inline-flex shrink-0 items-center justify-center font-semibold leading-[normal] whitespace-nowrap no-underline select-none aria-disabled:cursor-not-allowed aria-disabled:opacity-60 disabled:cursor-not-allowed disabled:opacity-60';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-navy hover:bg-navy-dark text-white hover:underline',
  secondary: 'border-rule text-ink hover:bg-band border bg-white hover:underline',
  // Red only for actions that cannot be undone (UX rules in the plan).
  danger: 'bg-error text-white hover:underline',
  link: 'text-link font-medium underline hover:no-underline',
};

const sizes: Record<ButtonSize, string> = {
  md: 'h-11 gap-2 px-5 text-base [&_svg]:size-5',
  lg: 'h-14 gap-3 px-6 text-lg [&_svg]:size-[1.375rem]',
};

/** A link variant has no block: it sits in the text flow, only the height keeps the touch target. */
const linkSizes: Record<ButtonSize, string> = {
  md: 'min-h-11 gap-2 text-base [&_svg]:size-5',
  lg: 'min-h-14 gap-3 text-lg [&_svg]:size-[1.375rem]',
};

/** Classes of a button, for elements that cannot use `asChild`. */
export function buttonClasses({
  variant = 'primary',
  size = 'md',
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string | undefined } = {}): string {
  return cn(base, variants[variant], variant === 'link' ? linkSizes[size] : sizes[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Renders the single child (e.g. a link) with the button styles instead of a `<button>`. */
  asChild?: boolean | undefined;
};

/**
 * A block button. Primary is the one main action of a page, secondary a white block with a rule,
 * danger the red one for irreversible actions, link an underlined text action.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  asChild = false,
  className,
  type,
  ...props
}: ButtonProps) {
  const classes = buttonClasses({ variant, size, className });
  if (asChild) return <Slot.Root className={classes} {...props} />;
  return <button type={type ?? 'button'} className={classes} {...props} />;
}
