import { syncOfficialFromEnv } from './bootstrap';

// Loads official regulation versions into the database (pnpm regulations:sync, installer).
await syncOfficialFromEnv(process.env);
