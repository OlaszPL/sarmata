import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Karta pracownika' };

export default function Page() {
  return <ComingSoon title="Karta pracownika" />;
}
