import Link from 'next/link';
import { Notice } from '@sarmata/ui';
import { routes } from '@/lib/routes';

/** Shown instead of the forms to a signed-in member who is not the office admin. */
export function AdminOnlyNotice({ what }: { what: string }) {
  return (
    <Notice tone="info">
      <p>{what} zmienia administrator urzędu.</p>
      <p className="mt-2">
        <Link href={routes.home} className="font-heading text-link font-medium underline">
          Wróć do pulpitu
        </Link>
      </p>
    </Notice>
  );
}
