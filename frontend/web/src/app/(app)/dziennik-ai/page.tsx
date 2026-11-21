import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Dziennik użycia AI' };

export default function Page() {
  return <ComingSoon title="Dziennik użycia AI" />;
}
