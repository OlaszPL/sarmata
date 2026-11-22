import Link from 'next/link';
import { Section } from '@sarmata/ui';
import { type Guide as GuideData } from '@/lib/help/guides';

/** One step by step guide: numbered steps, each with a title, a short text and an optional link. */
export function Guide({ guide }: { guide: GuideData }) {
  return (
    <Section title={guide.title} id={`instrukcja-${guide.id}`}>
      <p className="mb-6 max-w-[70ch]">{guide.intro}</p>
      <ol className="grid gap-4">
        {guide.steps.map((step, index) => (
          <li key={step.title} className="border-rule flex gap-4 border-t pt-4">
            <span
              aria-hidden
              className="font-heading bg-navy flex size-10 shrink-0 items-center justify-center text-lg font-semibold text-white"
            >
              {index + 1}
            </span>
            <div className="grid max-w-[70ch] gap-1">
              <h3 className="font-heading text-ink text-xl leading-[normal] font-semibold">
                <span className="sr-only">Krok {index + 1}. </span>
                {step.title}
              </h3>
              <p>{step.body}</p>
              {step.link ? (
                <p>
                  <Link
                    href={step.link.href}
                    className="font-heading text-link leading-[normal] font-medium underline"
                  >
                    {step.link.label}
                  </Link>
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}
