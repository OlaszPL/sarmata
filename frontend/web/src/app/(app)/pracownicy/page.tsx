import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Moi pracownicy' };

export default function Page() {
  return <ComingSoon title="Moi pracownicy" />;
}
