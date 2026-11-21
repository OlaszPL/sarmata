import type { Metadata } from 'next';
import { ComingSoon } from '@/components/coming-soon';

export const metadata: Metadata = { title: 'Powiadomienia' };

export default function Page() {
  return <ComingSoon title="Powiadomienia" />;
}
