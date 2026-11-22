import type { Metadata } from 'next';
import { Section } from '@sarmata/ui';
import { caseTitle } from '../loader';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Zdarzenia') };
}

/** Placeholder of the tab until its stream builds it. The layout holds the H1 and the case frame. */
export default function Page() {
  return (
    <Section title="Zdarzenia sprawy">
      <p>Ta część sprawy jest w przygotowaniu.</p>
    </Section>
  );
}
