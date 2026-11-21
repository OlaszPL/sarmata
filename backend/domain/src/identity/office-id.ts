import { z } from 'zod';

/** Id of an office (Urząd). Branded so that it cannot be mixed up with other ids across packages. */
export const officeIdSchema = z.uuid().brand<'OfficeId'>();
export type OfficeId = z.infer<typeof officeIdSchema>;
