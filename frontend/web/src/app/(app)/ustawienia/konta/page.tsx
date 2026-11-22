import type { Metadata } from 'next';
import Link from 'next/link';
import { type CalendarDate, servicesFor } from '@sarmata/services';
import { DataTable, type DataTableColumn, EmptyState, Notice, Section, Tag } from '@sarmata/ui';
import { AdminOnlyNotice } from '@/components/settings/admin-only-notice';
import { InvitationStatus } from '@/components/settings/invitation-status';
import { InviteForm } from '@/components/settings/invite-form';
import { MemberEdit } from '@/components/settings/member-edit';
import { SettingsHero } from '@/components/settings/settings-nav';
import { requireMember } from '@/lib/account';
import { invitationView, type MemberRow, memberRows } from '@/lib/accounts/accounts-view';
import { runService } from '@/lib/form-action';
import { formatDate, pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Konta' };

const linkClasses = 'font-heading text-link font-medium underline';

/** Panel with the result of an invitation, from `?zaproszenie=<id>`. */
async function InvitationPanel({
  id,
  services,
}: {
  id: string;
  services: ReturnType<typeof servicesFor>;
}) {
  const result = await runService(() => services.accounts.invitation(id));
  if (!result.ok) {
    return (
      <Notice tone="error" role="status" className="max-w-[40rem]">
        {result.state.formError === undefined || result.state.formError.startsWith('Nie znaleziono')
          ? 'Nie znaleziono zaproszenia.'
          : result.state.formError}
      </Notice>
    );
  }
  return <InvitationStatus id={id} view={invitationView(result.value)} />;
}

function Confirmation({ saved, open }: { saved: string; open: number }) {
  if (saved === 'rola') {
    return (
      <Notice tone="success" role="status" className="max-w-[40rem]">
        Zapisano rolę.
      </Notice>
    );
  }
  if (saved !== 'dostep') return null;
  return (
    <div className="grid grid-cols-1 max-w-[40rem] gap-4">
      <Notice tone="success" role="status">
        Zakończono dostęp.
      </Notice>
      {open > 0 ? (
        <Notice tone="warning" role="status">
          Ta osoba prowadzi {open} {pluralPl(open, 'ocenę', 'oceny', 'ocen')} w toku. Kadry powinny
          zmienić oceniającego w tych sprawach.
        </Notice>
      ) : null}
    </div>
  );
}

/** Accounts and invitations (`/ustawienia/konta`). Only the office admin sees the content. */
export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const account = await requireMember();
  const params = await searchParams;
  const heroMeta = 'Zaproś osoby i zarządzaj ich dostępem do urzędu.';

  if (account.role !== 'admin') {
    return (
      <div className="flex flex-1 flex-col">
        <SettingsHero title="Konta" current="accounts" meta={heroMeta} />
        <div className="grid grid-cols-1 gap-8 px-6 py-8 sm:px-10">
          <AdminOnlyNotice what="Konta urzędu" />
        </div>
      </div>
    );
  }

  const services = servicesFor(await createSupabase());
  const members = await services.accounts.list();
  const rows = memberRows(members, account.userId);
  const invitationId = single(params.zaproszenie);
  const editedId = single(params.konto);
  const edited = editedId ? members.find((member) => member.accountId === editedId) : undefined;
  const editedRow = edited ? rows.find((row) => row.accountId === edited.accountId) : undefined;
  const open = Number.parseInt(single(params.otwarte), 10);

  const columns: DataTableColumn<MemberRow>[] = [
    {
      key: 'name',
      header: 'Osoba',
      rowHeader: true,
      cell: (row) => <span className="font-semibold">{row.name}</span>,
    },
    {
      key: 'email',
      header: 'E-mail',
      cell: (row) => row.email ?? <span className="text-ink-muted">Brak</span>,
    },
    { key: 'role', header: 'Rola', cell: (row) => row.roleLabel },
    {
      key: 'access',
      header: 'Dostęp',
      cell: (row) =>
        row.active ? (
          <Tag tone="done">Aktywny</Tag>
        ) : (
          <Tag tone="neutral">
            Zakończony {row.endedOn ? formatDate(row.endedOn as CalendarDate) : ''}
          </Tag>
        ),
    },
    {
      key: 'action',
      header: 'Działanie',
      cell: (row) =>
        row.active ? (
          <Link
            href={`${routes.settingsAccounts}?konto=${row.accountId}#konto`}
            aria-label={`Zmień, ${row.name}`}
            className={linkClasses}
          >
            Zmień
          </Link>
        ) : null,
    },
  ];

  return (
    <div className="flex flex-1 flex-col">
      <SettingsHero title="Konta" current="accounts" meta={heroMeta} />
      <div className="px-6 pt-8 empty:hidden sm:px-10">
        <Confirmation saved={single(params.zapisano)} open={Number.isNaN(open) ? 0 : open} />
      </div>
      {invitationId ? (
        <div className="px-6 pt-8 sm:px-10">
          <InvitationPanel id={invitationId} services={services} />
        </div>
      ) : null}
      <div className="grid grid-cols-1">
        <Section title="Zaproś konto" flush={false}>
          <InviteForm />
        </Section>

        <Section title="Konta w urzędzie" flush={false}>
          {rows.length > 0 ? (
            <DataTable
              caption="Konta w urzędzie"
              columns={columns}
              rows={rows}
              rowKey={(row) => row.accountId}
            />
          ) : (
            <EmptyState title="Urząd nie ma jeszcze kont" className="px-0 sm:px-0">
              <p className="max-w-[70ch]">Zaproś pierwszą osobę formularzem powyżej.</p>
            </EmptyState>
          )}
        </Section>

        {editedId ? (
          <Section title="Zmiana konta" id="konto">
            {edited && editedRow ? (
              <MemberEdit
                accountId={edited.accountId}
                name={editedRow.name}
                currentRole={edited.role}
                isMe={editedRow.isMe}
              />
            ) : (
              <Notice tone="error" role="status" className="max-w-[40rem]">
                Nie znaleziono konta.
              </Notice>
            )}
          </Section>
        ) : null}
      </div>
    </div>
  );
}
