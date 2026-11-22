import type { AccountInvitation, Member } from '@sarmata/services';
import { roleLabels } from '@/lib/role-labels';

export interface MemberRow {
  accountId: string;
  name: string;
  email: string | null;
  roleLabel: string;
  active: boolean;
  endedOn: string | null;
  isMe: boolean;
}

function fullName(member: Member): string | null {
  const name = [member.firstName, member.lastName].filter(Boolean).join(' ');
  return name === '' ? null : name;
}

/** Rows of the accounts table: active members first, then by last name (Polish collation). */
export function memberRows(members: readonly Member[], me: string): MemberRow[] {
  const sorted = [...members].sort(
    (a, b) =>
      Number(b.endedOn === null) - Number(a.endedOn === null) ||
      (a.lastName ?? a.email ?? '').localeCompare(b.lastName ?? b.email ?? '', 'pl') ||
      (a.firstName ?? '').localeCompare(b.firstName ?? '', 'pl'),
  );
  return sorted.map((member) => ({
    accountId: member.accountId,
    name: fullName(member) ?? member.email ?? 'Konto bez danych',
    email: member.email,
    roleLabel: roleLabels[member.role],
    active: member.endedOn === null,
    endedOn: member.endedOn,
    isMe: member.accountId === me,
  }));
}

export interface InvitationView {
  tone: 'info' | 'success' | 'error';
  title: string;
  body: string;
  pending: boolean;
  canTakePassword: boolean;
}

const INVITATION_ERRORS: Record<string, string> = {
  membership_exists: 'Ta osoba ma już dostęp do urzędu.',
  employee_has_account: 'Pracownik o tym adresie ma już inne konto.',
  employment_ended: 'Zatrudnienie tej osoby ustało.',
  account_exists: 'Konto o tym adresie już istnieje w innym urzędzie.',
};

export function invitationErrorMessage(errorCode: string | null): string {
  const known = errorCode === null ? undefined : INVITATION_ERRORS[errorCode];
  return known ?? 'Coś poszło nie tak. Spróbuj ponownie.';
}

/** What the status panel of an invitation says, from the request and the result the worker wrote. */
export function invitationView(inv: AccountInvitation): InvitationView {
  const base = { pending: false, canTakePassword: false };
  if (inv.status === 'pending') {
    return {
      ...base,
      tone: 'info',
      title: 'Zaproszenie czeka na wysłanie',
      body: 'Sarmata wysyła zaproszenia w tle. Ta strona odświeża się sama.',
      pending: true,
    };
  }
  if (inv.status === 'failed') {
    return {
      ...base,
      tone: 'error',
      title: 'Nie udało się zaprosić konta',
      body: invitationErrorMessage(inv.errorCode),
    };
  }
  if (inv.mode === 'temporary_password') {
    return {
      ...base,
      tone: 'success',
      title: 'Utworzono konto z hasłem jednorazowym',
      body: inv.temporaryPasswordWaiting
        ? 'Urząd nie ma działającej poczty. Odbierz hasło i przekaż je osobiście.'
        : 'Hasło jednorazowe już odebrano. Nie da się go pokazać ponownie.',
      canTakePassword: inv.temporaryPasswordWaiting,
    };
  }
  if (inv.mode === 'existing_account') {
    return {
      ...base,
      tone: 'success',
      title: 'Dodano istniejące konto do urzędu',
      body: `${inv.firstName} ${inv.lastName} ma już konto i od teraz ma dostęp do urzędu.`,
    };
  }
  return {
    ...base,
    tone: 'success',
    title: 'Wysłano zaproszenie',
    body: `${inv.firstName} ${inv.lastName} dostanie e-mail z linkiem do ustawienia hasła.`,
  };
}
