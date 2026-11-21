import type { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '#shadcn/ui/alert';

interface FormAlertProps {
  title: string;
  children: ReactNode;
}

/** Error message above a form. Always with an icon (gov.pl) and announced by screen readers. */
export function FormAlert({ title, children }: FormAlertProps) {
  return (
    <Alert variant="destructive" className="border-l-4 border-destructive text-base">
      <CircleAlert aria-hidden />
      <AlertTitle className="font-semibold">{title}</AlertTitle>
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
