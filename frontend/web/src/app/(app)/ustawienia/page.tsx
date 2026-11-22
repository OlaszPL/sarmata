import type { Metadata } from 'next';
import { servicesFor } from '@sarmata/services';
import { Notice } from '@sarmata/ui';
import { AdminOnlyNotice } from '@/components/settings/admin-only-notice';
import { OfficeSettingsForm } from '@/components/settings/office-settings-form';
import { SettingsHero } from '@/components/settings/settings-nav';
import { SmtpPasswordForm } from '@/components/settings/smtp-password-form';
import { requireMember } from '@/lib/account';
import { type SearchParams, single } from '@/lib/search-params';
import { settingsFormValues } from '@/lib/settings/office-settings-form';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Ustawienia urzędu' };

/** Office settings (`/ustawienia`). Only the office admin sees the forms. */
export default async function OfficeSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const account = await requireMember();
  const params = await searchParams;
  const isAdmin = account.role === 'admin';
  const settings = isAdmin ? await servicesFor(await createSupabase()).officeSettings.get() : null;

  return (
    <div className="flex flex-1 flex-col">
      <SettingsHero
        title="Ustawienia urzędu"
        current="office"
        meta="Zmiany obowiązują cały urząd od zapisu."
      />
      <div className="grid gap-8 px-6 py-8 sm:px-10">
        {single(params.zapisano) === '1' ? (
          <Notice tone="success" role="status" className="max-w-[40rem]">
            Zapisano ustawienia urzędu.
          </Notice>
        ) : null}
        {single(params.haslo) === '1' ? (
          <Notice tone="success" role="status" className="max-w-[40rem]">
            Zapisano hasło SMTP.
          </Notice>
        ) : null}
        {settings ? (
          <OfficeSettingsForm
            initialValues={settingsFormValues(settings)}
            smtpPasswordForm={<SmtpPasswordForm passwordSet={settings.smtp.passwordSet} />}
          />
        ) : (
          <AdminOnlyNotice what="Ustawienia urzędu" />
        )}
      </div>
    </div>
  );
}
