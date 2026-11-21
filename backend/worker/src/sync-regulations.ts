import { connectAndSyncRegulations } from './bootstrap';

// Loads official regulation versions into the database (pnpm regulations:sync, installer).
await connectAndSyncRegulations(process.env);
