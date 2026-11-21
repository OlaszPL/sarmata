import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Sprawa oceny' };

export default function Page() {
  return <ComingSoon title="Sprawa oceny" />;
}
