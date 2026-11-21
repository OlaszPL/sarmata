import type { SelectHTMLAttributes } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from 'cn';
import { controlClasses } from '#components/field';

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Native select with a chevron. Options go in as children, `className` sizes the whole control. */
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={cn('relative w-full', className)}>
      <select className={cn(controlClasses, 'cursor-pointer appearance-none pr-10')} {...props}>
        {children}
      </select>
      <ChevronDown
        className="text-ink pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
        aria-hidden
      />
    </div>
  );
}
