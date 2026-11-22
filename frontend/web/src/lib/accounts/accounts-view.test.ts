import type { AccountInvitation, Member } from '@sarmata/services';
import { describe, expect, it } from 'vitest';
import { invitationView, memberRows } from './accounts-view';

function member(overrides: Partial<Member> = {}): Member {
  return {
    accountId: 'a1',
    role: 'evaluator',
    endedOn: null,
    email: 'ala@urzad.pl',
    firstName: 'Ala',
    lastName: 'Kowalska',
    ...overrides,
  };
}

function invitation(overrides: Partial<AccountInvitation> = {}): AccountInvitation {
  return {
    id: 'i1',
    email: 'jan@urzad.pl',
    role: 'hr',
    firstName: 'Jan',
    lastName: 'Nowak',
    requestedAt: '2026-11-22T10:00:00Z',
    status: 'sent',
    mode: 'invitation',
    accountId: 'a2',
    employeeId: null,
    temporaryPasswordWaiting: false,
    errorCode: null,
    error: null,
    finishedAt: '2026-11-22T10:00:05Z',
    ...overrides,
  };
}

describe('memberRows', () => {
  it('lists active members before ended ones, then by last name', () => {
    const rows = memberRows(
      [
        member({ accountId: 'ended', lastName: 'Adamska', endedOn: '2026-10-01' }),
        member({ accountId: 'z', lastName: 'Żak' }),
        member({ accountId: 'b', lastName: 'Brzoza' }),
      ],
      'nobody',
    );
    expect(rows.map((row) => row.accountId)).toEqual(['b', 'z', 'ended']);
    expect(rows[2]).toMatchObject({ active: false, endedOn: '2026-10-01' });
  });

  it('falls back to the e-mail and then to a placeholder name', () => {
    const rows = memberRows(
      [
        member({ accountId: 'x', firstName: null, lastName: null }),
        member({ accountId: 'y', firstName: null, lastName: null, email: null }),
      ],
      'nobody',
    );
    expect(rows.find((row) => row.accountId === 'x')?.name).toBe('ala@urzad.pl');
    expect(rows.find((row) => row.accountId === 'y')?.name).toBe('Konto bez danych');
  });

  it('marks the own account and labels the role', () => {
    const rows = memberRows([member({ role: 'admin' })], 'a1');
    expect(rows[0]).toMatchObject({ isMe: true, roleLabel: 'Administrator', name: 'Ala Kowalska' });
  });
});

describe('invitationView', () => {
  it('shows a pending invitation as polling info', () => {
    expect(invitationView(invitation({ status: 'pending', mode: null }))).toMatchObject({
      tone: 'info',
      title: 'Zaproszenie czeka na wysłanie',
      pending: true,
      canTakePassword: false,
    });
  });

  it('shows a sent invitation with the e-mail link', () => {
    const view = invitationView(invitation());
    expect(view).toMatchObject({ tone: 'success', title: 'Wysłano zaproszenie', pending: false });
    expect(view.body).toBe('Jan Nowak dostanie e-mail z linkiem do ustawienia hasła.');
  });

  it('offers the temporary password while it waits', () => {
    const view = invitationView(
      invitation({ mode: 'temporary_password', temporaryPasswordWaiting: true }),
    );
    expect(view).toMatchObject({
      tone: 'success',
      title: 'Utworzono konto z hasłem jednorazowym',
      canTakePassword: true,
    });
  });

  it('says the temporary password was already taken', () => {
    const view = invitationView(
      invitation({ mode: 'temporary_password', temporaryPasswordWaiting: false }),
    );
    expect(view.canTakePassword).toBe(false);
    expect(view.body).toBe('Hasło jednorazowe już odebrano. Nie da się go pokazać ponownie.');
  });

  it('shows an existing account added to the office', () => {
    expect(invitationView(invitation({ mode: 'existing_account' }))).toMatchObject({
      tone: 'success',
      title: 'Dodano istniejące konto do urzędu',
    });
  });

  it('maps failure codes and falls back to a generic message', () => {
    const failed = invitationView(
      invitation({ status: 'failed', mode: null, errorCode: 'membership_exists' }),
    );
    expect(failed).toMatchObject({ tone: 'error', title: 'Nie udało się zaprosić konta' });
    expect(failed.body).toBe('Ta osoba ma już dostęp do urzędu.');
    const unknown = invitationView(
      invitation({ status: 'failed', mode: null, errorCode: 'weird' }),
    );
    expect(unknown.body).toBe('Coś poszło nie tak. Spróbuj ponownie.');
    const none = invitationView(invitation({ status: 'failed', mode: null, errorCode: null }));
    expect(none.body).toBe('Coś poszło nie tak. Spróbuj ponownie.');
  });
});
