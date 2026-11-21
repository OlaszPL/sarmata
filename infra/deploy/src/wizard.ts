import { hostname } from 'node:os';
import { confirm, isCancel, note, password, select, text } from '@clack/prompts';
import { aiSettings, proposeAi } from './ai.ts';
import { answersSchema, type Answers, type InstallConfig, type Profile } from './config.ts';
import type { Environment } from './environment.ts';

export class WizardCancelled extends Error {
  constructor() {
    super('wizard cancelled by the user');
  }
}

function answer<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) throw new WizardCancelled();
  return value as Exclude<T, symbol>;
}

type Check = (value: string | undefined) => string | undefined;

const required: Check = (value) =>
  value === undefined || value.trim() === '' ? 'To pole jest wymagane.' : undefined;
// Values written to .env sit in single quotes (secrets.ts), so they cannot contain one.
const envSafe: Check = (value) =>
  /['\r\n]/.test(value ?? '') ? 'Wartość nie może zawierać apostrofu ani nowej linii.' : undefined;
const requiredEnvSafe: Check = (value) => required(value) ?? envSafe(value);
const email: Check = (value) =>
  required(value) ??
  (/^[^@\s']+@[^@\s']+\.[^@\s']+$/.test(value ?? '') ? undefined : 'Podaj poprawny adres e-mail.');
const url: Check = (value) =>
  required(value) ??
  (URL.canParse(value ?? '') ? undefined : 'Podaj pełny adres, np. https://abc.supabase.co');
const port: Check = (value) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number < 65536
    ? undefined
    : 'Podaj numer portu od 1 do 65535.';
};

async function askTls(): Promise<InstallConfig['tls']> {
  const mode = answer(
    await select<'internal' | 'files'>({
      message: 'Certyfikat HTTPS',
      initialValue: 'internal',
      options: [
        {
          value: 'internal',
          label: 'wewnętrzne CA Caddy',
          hint: 'certyfikat główny trzeba rozesłać na komputery urzędu',
        },
        { value: 'files', label: 'certyfikat urzędu z plików PEM' },
      ],
    }),
  );
  if (mode === 'internal') return { mode };
  const certPath = answer(
    await text({ message: 'Ścieżka do certyfikatu (PEM, z łańcuchem)', validate: required }),
  ).trim();
  const keyPath = answer(
    await text({ message: 'Ścieżka do klucza prywatnego (PEM)', validate: required }),
  ).trim();
  return { mode, certPath, keyPath };
}

async function askSupabase(): Promise<{
  config: InstallConfig['supabase'];
  external: Answers['external'];
}> {
  const mode = answer(
    await select<'local' | 'external'>({
      message: 'Baza danych i logowanie (Supabase)',
      initialValue: 'local',
      options: [
        { value: 'local', label: 'na tym komputerze', hint: 'zalecane' },
        { value: 'external', label: 'zewnętrzna instancja Supabase' },
      ],
    }),
  );
  if (mode === 'local') return { config: { mode }, external: null };
  const projectUrl = answer(
    await text({
      message: 'Adres projektu Supabase',
      placeholder: 'https://abc.supabase.co',
      validate: url,
    }),
  ).trim();
  const publishableKey = answer(
    await password({
      message: 'Klucz publiczny (publishable albo anon)',
      validate: requiredEnvSafe,
    }),
  );
  const secretKey = answer(
    await password({
      message: 'Klucz serwisowy (secret albo service_role)',
      validate: requiredEnvSafe,
    }),
  );
  const databaseUrl = answer(
    await password({
      message: 'Adres połączenia z bazą (postgresql://...), do migracji i kopii',
      validate: requiredEnvSafe,
    }),
  );
  return {
    config: { mode, url: projectUrl },
    external: { publishableKey, secretKey, databaseUrl },
  };
}

async function askSmtp(): Promise<{ config: InstallConfig['smtp']; password: string }> {
  const enabled = answer(
    await confirm({
      message:
        'Skonfigurować serwer SMTP urzędu? Bez niego powiadomienia są tylko w aplikacji, a hasła ustawia administrator.',
      initialValue: true,
    }),
  );
  if (!enabled) return { config: { enabled: false }, password: '' };
  const host = answer(
    await text({
      message: 'Serwer SMTP',
      placeholder: 'smtp.urzad.gov.pl',
      validate: requiredEnvSafe,
    }),
  ).trim();
  const smtpPort = Number(
    answer(await text({ message: 'Port SMTP', initialValue: '587', validate: port })),
  );
  const user = answer(
    await text({
      message: 'Użytkownik SMTP (puste, gdy serwer nie wymaga logowania)',
      defaultValue: '',
      validate: envSafe,
    }),
  ).trim();
  const smtpPassword =
    user === '' ? '' : answer(await password({ message: 'Hasło SMTP', validate: requiredEnvSafe }));
  const senderEmail = answer(
    await text({ message: 'Adres nadawcy', placeholder: 'oceny@urzad.gov.pl', validate: email }),
  ).trim();
  const senderName = answer(
    await text({
      message: 'Nazwa nadawcy',
      initialValue: 'Oceny okresowe',
      validate: requiredEnvSafe,
    }),
  ).trim();
  return {
    config: { enabled: true, host, port: smtpPort, user, senderEmail, senderName },
    password: smtpPassword,
  };
}

async function askAi(profile: Profile): Promise<InstallConfig['ai']> {
  const recommendation = await proposeAi(profile);
  const settings = aiSettings(recommendation);
  if (settings === null) {
    note(recommendation.reason, 'Moduł AI niedostępny');
    return { enabled: false };
  }
  const enable = answer(
    await confirm({
      message: `Włączyć moduł AI? ${recommendation.reason}`,
      initialValue: recommendation.enabledByDefault,
    }),
  );
  return enable ? settings : { enabled: false };
}

/** Asks the wizard questions and validates the answers as a whole. */
export async function askInstallAnswers(env: Environment): Promise<Answers> {
  const profile = answer(
    await select<Profile>({
      message: 'Profil instalacji',
      initialValue: 'standard',
      options: [
        { value: 'light', label: 'light', hint: 'jedno stanowisko, słaby komputer, AI wyłączone' },
        { value: 'standard', label: 'standard', hint: 'mocniejsze stanowisko albo mały urząd' },
        { value: 'server', label: 'server', hint: 'serwer w sieci urzędu z HTTPS' },
      ],
    }),
  );
  const exposure =
    profile === 'light'
      ? 'localhost'
      : profile === 'server'
        ? 'lan'
        : answer(
            await select<'localhost' | 'lan'>({
              message: 'Kto będzie korzystać z aplikacji?',
              initialValue: 'localhost',
              options: [
                { value: 'localhost', label: 'tylko ten komputer' },
                { value: 'lan', label: 'komputery w sieci urzędu' },
              ],
            }),
          );
  const host =
    exposure === 'localhost'
      ? 'localhost'
      : answer(
          await text({
            message:
              profile === 'server'
                ? 'Nazwa serwera w sieci urzędu, np. oceny.urzad.local'
                : 'Nazwa albo adres IP tego komputera w sieci urzędu',
            initialValue: hostname(),
            validate: requiredEnvSafe,
          }),
        ).trim();
  const tls: InstallConfig['tls'] = profile === 'server' ? await askTls() : { mode: 'none' };
  const supabase = await askSupabase();
  const officeName = answer(await text({ message: 'Nazwa urzędu', validate: required })).trim();
  const firstName = answer(
    await text({ message: 'Imię administratora', validate: required }),
  ).trim();
  const lastName = answer(
    await text({ message: 'Nazwisko administratora', validate: required }),
  ).trim();
  const adminEmail = answer(
    await text({ message: 'E-mail administratora (login)', validate: email }),
  ).trim();
  const adminPassword = answer(
    await password({
      message: 'Hasło administratora (co najmniej 12 znaków)',
      validate: (value) =>
        value !== undefined && value.length >= 12
          ? undefined
          : 'Hasło musi mieć co najmniej 12 znaków.',
    }),
  );
  answer(
    await password({
      message: 'Powtórz hasło',
      validate: (value) => (value === adminPassword ? undefined : 'Hasła się różnią.'),
    }),
  );
  const smtp = await askSmtp();
  const ai = await askAi(profile);
  const shortcut =
    env.desktopDir !== null &&
    answer(await confirm({ message: 'Utworzyć skrót na pulpicie?', initialValue: true }));
  const config: InstallConfig = {
    schemaVersion: 1,
    profile,
    exposure,
    host,
    tls,
    supabase: supabase.config,
    smtp: smtp.config,
    ai,
    office: { name: officeName },
    admin: { email: adminEmail, firstName, lastName },
    shortcut,
  };
  return answersSchema.parse({
    config,
    adminPassword,
    smtpPassword: smtp.password,
    external: supabase.external,
  });
}
