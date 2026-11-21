// Entry point `@sarmata/services/system`: services that act for the system, not for an account.
// Only the worker and scripts import it. It needs a `ServiceDb`, which the frontend cannot create.
export { type SyncDependencies, type SyncReport, syncOfficialRegulations } from './sync-official';
export { type SystemServices, createSystemServices } from './system-services';
