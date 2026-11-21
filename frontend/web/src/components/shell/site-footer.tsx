import Link from 'next/link';
import { routes } from '@/lib/routes';

const links = [
  { href: routes.accessibility, label: 'Deklaracja dostępności' },
  { href: routes.help, label: 'Pomoc' },
  { href: routes.aiLog, label: 'Dziennik użycia AI' },
] as const;

export function SiteFooter() {
  return (
    <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-8 py-8">
      <div>
        <ul className="flex flex-wrap gap-x-7 gap-y-2">
          {links.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="font-heading font-medium text-white underline">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <p className="text-on-navy-muted text-sm">
        Model AI działa w urzędzie. Dane nie opuszczają twojej sieci.
      </p>
    </footer>
  );
}
