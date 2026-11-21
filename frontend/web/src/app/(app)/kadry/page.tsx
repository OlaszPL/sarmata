import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Kadry' };

export default function Page() {
  return <ComingSoon title="Kadry" />;
}
