import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Nowa ocena' };

export default function Page() {
  return <ComingSoon title="Nowa ocena" />;
}
