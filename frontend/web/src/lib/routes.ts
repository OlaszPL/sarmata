/** Paths the proxy, server actions and pages agree on. URLs are user-facing, so they are Polish. */
export const routes = {
  home: '/',
  signIn: '/logowanie',
  noOffice: '/brak-urzedu',
  employees: '/pracownicy',
  evaluations: '/oceny',
  newEvaluation: '/oceny/nowa',
  notes: '/notatki',
  hr: '/kadry',
  settings: '/ustawienia',
  notifications: '/powiadomienia',
  accessibility: '/deklaracja-dostepnosci',
  help: '/pomoc',
  aiLog: '/dziennik-ai',
  evaluation: (id: string) => `/oceny/${id}`,
  employee: (id: string) => `/pracownicy/${id}`,
} as const;
