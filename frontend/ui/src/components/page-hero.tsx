import type { ElementType, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from 'cn';

export interface HeroCrumb {
  /** Leave out for the current page. */
  href?: string;
  label: string;
}

export interface HeroStat {
  label: string;
  value: string;
  hint?: string;
}

interface PageHeroProps {
  crumbs?: readonly HeroCrumb[];
  title: ReactNode;
  /** Line under the title, e.g. position, unit and evaluator. */
  meta?: ReactNode;
  /** Short framed labels, e.g. the sheet and the regulation version. */
  tags?: readonly string[];
  /** Number cells on the right, separated by thin lines. */
  stats?: readonly HeroStat[];
  /** Buttons or links under the tags. */
  actions?: ReactNode;
  /** Link element for the crumbs, e.g. Next.js `Link`. A plain `<a>` by default. */
  linkAs?: ElementType;
  /** Id of the H1, for `aria-labelledby` of a surrounding region. */
  titleId?: string;
  className?: string;
}

/** Navy block at the top of a case or a person: crumbs, H1, meta, tags and the key numbers. */
export function PageHero({
  crumbs,
  title,
  meta,
  tags,
  stats,
  actions,
  linkAs: LinkTag = 'a',
  titleId,
  className,
}: PageHeroProps) {
  return (
    <div className={cn('bg-navy flex flex-col text-white lg:flex-row', className)}>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 px-6 py-7 sm:px-10">
        {crumbs && crumbs.length > 0 ? (
          <nav aria-label="Ścieżka">
            <ol className="flex flex-wrap items-center gap-2 text-[0.9375rem] leading-[normal]">
              {crumbs.map((crumb, index) => (
                <li key={`${crumb.label}-${index}`} className="flex items-center gap-2">
                  {index > 0 ? (
                    <ChevronRight className="text-on-navy-muted size-3.5 shrink-0" aria-hidden />
                  ) : null}
                  {crumb.href ? (
                    <LinkTag
                      href={crumb.href}
                      className="font-heading font-medium text-white underline"
                    >
                      {crumb.label}
                    </LinkTag>
                  ) : (
                    <span aria-current="page" className="text-on-navy-muted">
                      {crumb.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        ) : null}
        <h1
          id={titleId}
          className="text-[2.25rem] leading-[normal] font-semibold tracking-[-0.0217em] break-words sm:text-[2.875rem]"
        >
          {title}
        </h1>
        {meta ? (
          <div className="text-on-navy-muted text-[0.9375rem] leading-[1.5333]">{meta}</div>
        ) : null}
        {tags && tags.length > 0 ? (
          <ul className="flex flex-wrap gap-2 pt-1.5">
            {tags.map((tag) => (
              <li
                key={tag}
                className="font-heading flex h-[1.875rem] items-center border border-white px-2.5 text-sm leading-[normal] font-semibold"
              >
                {tag}
              </li>
            ))}
          </ul>
        ) : null}
        {actions ? <div className="flex flex-wrap gap-3 pt-2">{actions}</div> : null}
      </div>
      {stats && stats.length > 0 ? (
        <dl className="flex flex-wrap border-t border-white/40 lg:w-[32.6875rem] lg:shrink-0 lg:flex-nowrap lg:border-t-0 lg:border-l">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className={cn(
                'flex min-w-[10rem] flex-1 flex-col justify-end gap-1.5 px-6 py-7',
                index < stats.length - 1 ? 'border-r border-white/40' : null,
              )}
            >
              <dt className="font-heading text-on-navy-muted text-[0.9375rem] leading-[normal] font-medium">
                {stat.label}
              </dt>
              <dd className="font-heading text-[2.75rem] leading-none font-semibold tracking-[-0.0227em]">
                {stat.value}
              </dd>
              {stat.hint ? <dd className="text-sm leading-[normal]">{stat.hint}</dd> : null}
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}
