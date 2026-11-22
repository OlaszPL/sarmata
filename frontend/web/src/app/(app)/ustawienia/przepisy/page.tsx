import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  type CalendarDate,
  type RegulationVersionDetail,
  type RegulationVersionSummary,
  servicesFor,
} from '@sarmata/services';
import { DataTable, type DataTableColumn, Notice, Section, SummaryList, Tag } from '@sarmata/ui';
import { CaseResults } from '@/components/regulations/case-results';
import { CloneForm } from '@/components/regulations/clone-form';
import { DeleteDraftForm } from '@/components/regulations/delete-draft-form';
import { ParametersForm } from '@/components/regulations/parameters-form';
import { PublishForm } from '@/components/regulations/publish-form';
import { RegulationGraphList } from '@/components/regulations/regulation-graph-list';
import { AdminOnlyNotice } from '@/components/settings/admin-only-notice';
import { SettingsHero } from '@/components/settings/settings-nav';
import { requireMember } from '@/lib/account';
import { formatDate, todayInWarsaw } from '@/lib/format';
import { inForceLabel, versionStatusLabel } from '@/lib/regulations/labels';
import {
  fieldDisplayValue,
  regulationFields,
  regulationFormValues,
  visibleFields,
} from '@/lib/regulations/regulation-form';
import { routes } from '@/lib/routes';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Wersje przepisów' };

const TITLE = 'Wersje przepisów';

const confirmations: readonly { param: string; text: string }[] = [
  { param: 'utworzono', text: 'Utworzono szkic.' },
  { param: 'zapisano', text: 'Zapisano parametry. Wyniki testów są poniżej.' },
  { param: 'opublikowano', text: 'Opublikowano wersję.' },
  { param: 'usunieto', text: 'Usunięto szkic.' },
];

const versionHref = (id: string) => `${routes.settingsRules}?wersja=${encodeURIComponent(id)}`;

function StatusTags({ summary }: { summary: RegulationVersionSummary }) {
  const status = versionStatusLabel(summary);
  return (
    <span className="flex flex-wrap gap-2">
      <Tag tone={status.tone}>{status.label}</Tag>
      {summary.inForce ? <Tag tone={inForceLabel.tone}>{inForceLabel.label}</Tag> : null}
    </span>
  );
}

function basedOnName(summary: RegulationVersionSummary, versions: RegulationVersionSummary[]) {
  if (summary.basedOn === null) return 'Wersja urzędowa';
  return versions.find((version) => version.id === summary.basedOn)?.name ?? 'Wersja niedostępna';
}

/** Regulation versions of the office (`/ustawienia/przepisy`), a version by `?wersja=`. Admin only. */
export default async function RegulationVersionsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const account = await requireMember();
  const params = await searchParams;
  if (account.role !== 'admin') {
    return (
      <div className="flex flex-1 flex-col">
        <SettingsHero title={TITLE} current="rules" />
        <div className="grid gap-8 px-6 py-8 sm:px-10">
          <AdminOnlyNotice what={TITLE} />
        </div>
      </div>
    );
  }

  const editor = servicesFor(await createSupabase()).regulationEditor;
  const versionId = single(params.wersja);
  const versions = await editor.list();
  const notices = confirmations.filter(({ param }) => single(params[param]) === '1');
  const noticeBlock =
    notices.length > 0 ? (
      <div className="grid gap-4 px-6 pt-8 sm:px-10">
        {notices.map((notice) => (
          <Notice key={notice.param} tone="success" role="status" className="max-w-[40rem]">
            {notice.text}
          </Notice>
        ))}
      </div>
    ) : null;

  if (versionId === '') {
    return (
      <div className="flex flex-1 flex-col">
        <SettingsHero
          title={TITLE}
          current="rules"
          meta="Parametry oceny i terminy, według których system liczy oceny urzędu."
        />
        {noticeBlock}
        <VersionList versions={versions} />
      </div>
    );
  }

  const detail = await editor.get(versionId);
  if (detail === null) notFound();
  const summary = versions.find((version) => version.id === detail.id) ?? detail;

  return (
    <div className="flex flex-1 flex-col">
      <SettingsHero
        title={detail.name}
        current="rules"
        meta={`Kod wersji ${detail.code}`}
        crumbs={[
          { href: routes.settings, label: 'Ustawienia' },
          { href: routes.settingsRules, label: TITLE },
          { label: detail.name },
        ]}
      />
      {noticeBlock}
      <VersionDetail detail={detail} summary={summary} versions={versions} />
    </div>
  );
}

function VersionList({ versions }: { versions: RegulationVersionSummary[] }) {
  const columns: DataTableColumn<RegulationVersionSummary>[] = [
    {
      key: 'name',
      header: 'Nazwa',
      rowHeader: true,
      cell: (row) => (
        <Link href={versionHref(row.id)} className="text-link font-semibold underline">
          {row.name}
        </Link>
      ),
    },
    { key: 'code', header: 'Kod', cell: (row) => row.code },
    {
      key: 'effectiveFrom',
      header: 'Obowiązuje od',
      cell: (row) => formatDate(row.effectiveFrom as CalendarDate),
    },
    { key: 'status', header: 'Stan', cell: (row) => <StatusTags summary={row} /> },
    { key: 'basedOn', header: 'Oparta na', cell: (row) => basedOnName(row, versions) },
  ];
  const published = versions.filter((version) => version.status === 'published');
  const inForce = versions.find((version) => version.inForce);

  return (
    <>
      <Section title="Wersje przepisów urzędu">
        <div className="grid gap-6">
          <p className="max-w-[70ch]">
            Wersje urzędowe pochodzą z ustawy o służbie cywilnej i rozporządzenia w sprawie ocen
            okresowych. Na ich podstawie urząd może przygotować własną wersję. Nowa wersja działa
            dla ocen rozpoczętych od daty wejścia w życie. Oceny w toku zostają przy swojej wersji.
          </p>
          <DataTable
            caption="Wersje przepisów"
            columns={columns}
            rows={versions}
            rowKey={(row) => row.id}
          />
        </div>
      </Section>
      <Section title="Nowy szkic">
        <CloneForm
          sources={published.map((version) => ({ value: version.id, label: version.name }))}
          {...(inForce ? { defaultSourceId: inForce.id } : {})}
        />
      </Section>
    </>
  );
}

function publishedOn(publishedAt: string | null): string {
  return publishedAt === null
    ? 'Nie opublikowano'
    : formatDate(todayInWarsaw(new Date(publishedAt)));
}

function VersionDetail({
  detail,
  summary,
  versions,
}: {
  detail: RegulationVersionDetail;
  summary: RegulationVersionSummary;
  versions: RegulationVersionSummary[];
}) {
  const isDraft = detail.status === 'draft';
  const groups = regulationFields(detail.document);

  return (
    <>
      <Section title="Wersja">
        <SummaryList
          rows={[
            { key: 'Kod', value: detail.code },
            { key: 'Stan', value: <StatusTags summary={summary} /> },
            { key: 'Obowiązuje od', value: formatDate(detail.effectiveFrom as CalendarDate) },
            { key: 'Oparta na', value: basedOnName(detail, versions) },
            {
              key: 'Opublikowano',
              value: detail.isOfficial ? 'Wersja urzędowa' : publishedOn(detail.publishedAt),
            },
          ]}
        />
      </Section>
      <Section title="Testy przypadków">
        <CaseResults
          cases={detail.check.cases}
          levels={detail.document.partialScale.levels}
          acceptedFailingCases={detail.acceptedFailingCases}
        />
      </Section>
      {isDraft ? (
        <>
          <Section title="Parametry">
            <ParametersForm
              versionId={detail.id}
              groups={groups}
              initialValues={regulationFormValues(detail.document)}
            />
          </Section>
          <Section title="Publikacja">
            <PublishForm versionId={detail.id} />
          </Section>
          <Section title="Usunięcie szkicu">
            <DeleteDraftForm versionId={detail.id} />
          </Section>
        </>
      ) : (
        <>
          <Section title="Parametry">
            <div className="grid gap-8">
              {groups.map((group) => (
                <div key={group.title} className="grid gap-3">
                  <h3 className="text-[1.375rem] leading-[normal] font-semibold">{group.title}</h3>
                  {group.basis ? (
                    <p className="text-ink-muted max-w-[70ch]">Podstawa prawna: {group.basis}</p>
                  ) : null}
                  <SummaryList
                    rows={visibleFields(group)
                      .filter((field) => field.kind !== 'text')
                      .map((field) => ({ key: field.label, value: fieldDisplayValue(field) }))}
                  />
                </div>
              ))}
            </div>
          </Section>
          <Section title="Nowy szkic na podstawie tej wersji">
            <CloneForm fixedSource={{ id: detail.id, name: detail.name }} />
          </Section>
        </>
      )}
      <Section title="Powiązania przepisów">
        <RegulationGraphList graph={detail.graph} />
      </Section>
    </>
  );
}
