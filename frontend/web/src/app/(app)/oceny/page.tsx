import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Oceny' };

export default function Page() {
  return <ComingSoon title="Oceny" />;
}
