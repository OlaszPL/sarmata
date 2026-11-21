import Link from 'next/link';
import { routes } from '@/lib/routes';

const links = [
  { href: routes.accessibility, label: 'Deklaracja dostępności', public: true },
  { href: routes.help, label: 'Pomoc', public: false },
  { href: routes.aiLog, label: 'Dziennik użycia AI', public: false },
] as const;

/** `publicOnly` hides links to pages that need an office membership (sign-in, no-office pages). */
export function SiteFooter({ publicOnly = false }: { publicOnly?: boolean }) {
  return (
    <footer className="mx-auto flex max-w-[calc(75rem+4rem)] flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-7">
      <div>
        <ul className="font-heading flex flex-wrap gap-x-7 gap-y-2 leading-[normal]">
          {links
            .filter((link) => link.public || !publicOnly)
            .map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="font-medium text-white underline">
                  {link.label}
                </Link>
              </li>
            ))}
        </ul>
      </div>
      <p className="text-on-navy-muted text-sm leading-[normal]">
        Model AI działa w urzędzie. Dane nie opuszczają twojej sieci.
      </p>
    </footer>
  );
}
