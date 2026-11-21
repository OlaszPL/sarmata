import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Ustawienia' };

export default function Page() {
  return <ComingSoon title="Ustawienia" />;
}
