import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageHero, type HeroStat } from '@sarmata/ui';
import { routes } from '@/lib/routes';
import { HrNav } from './hr-nav';
import { RoleNotice } from './role-notice';

interface HrPageProps {
  title: string;
  meta?: ReactNode;
  stats?: HeroStat[];
  actions?: ReactNode;
  /** Set to the area name when the role has no access: a notice replaces the children. */
  denied?: string;
  /** The panel start page has no crumbs. */
  root?: boolean;
  children?: ReactNode;
}

/** Hero, panel navigation and the content frame shared by every HR page. */
export function HrPage({ title, meta, stats, actions, denied, root, children }: HrPageProps) {
  return (
    <>
      <PageHero
        title={title}
        linkAs={Link}
        {...(root ? {} : { crumbs: [{ href: routes.hr, label: 'Kadry' }, { label: title }] })}
        {...(meta !== undefined ? { meta } : {})}
        {...(stats ? { stats } : {})}
        {...(actions !== undefined ? { actions } : {})}
      />
      <HrNav />
      <div className="px-6 py-7 sm:px-10">
        {denied !== undefined ? <RoleNotice area={denied} /> : children}
      </div>
    </>
  );
}
