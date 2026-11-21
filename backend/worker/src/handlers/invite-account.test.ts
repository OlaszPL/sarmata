import {
  type InvitationProcessing,
  type InvitationProcessingResult,
} from '@sarmata/services/system';
import { describe, expect, it } from 'vitest';
import { type Logger } from '../logger';
import { inviteAccountHandler } from './invite-account';
import { jobHandlersFor } from './index';

const id = '6f0c1f0e-8d0a-4c53-9a3b-3b2f2a1d9e01';

function setup(result: InvitationProcessingResult | Error) {
  const processed: string[] = [];
  const invitations: InvitationProcessing = {
    process: (invitationId) => {
      processed.push(invitationId);
      return result instanceof Error ? Promise.reject(result) : Promise.resolve(result);
    },
  };
  const entries: { level: string; message: string; fields: unknown }[] = [];
  const logger: Logger = {
    info: (message, fields) => entries.push({ level: 'info', message, fields }),
    error: (message, fields) => entries.push({ level: 'error', message, fields }),
  };
  const context = { signal: new AbortController().signal, logger };
  return { handler: inviteAccountHandler(invitations), processed, entries, context };
}

describe('inviteAccountHandler', () => {
  it('processes the invitation and logs the mode without any e-mail address', async () => {
    const { handler, processed, entries, context } = setup({ status: 'sent', mode: 'invitation' });
    await expect(handler.run({ invitationId: id }, context)).resolves.toEqual({ status: 'done' });
    expect(processed).toEqual([id]);
    expect(entries).toEqual([
      {
        level: 'info',
        message: 'account invitation sent',
        fields: { invitationId: id, mode: 'invitation' },
      },
    ]);
  });

  it('logs a failed invitation as an error and still completes the job', async () => {
    const { handler, entries, context } = setup({
      status: 'failed',
      errorCode: 'account_exists',
      cause: new Error('This person already has an account in an office'),
    });
    await expect(handler.run({ invitationId: id }, context)).resolves.toEqual({ status: 'done' });
    expect(entries).toEqual([
      {
        level: 'error',
        message: 'account invitation failed',
        fields: {
          invitationId: id,
          errorCode: 'account_exists',
          error: 'This person already has an account in an office',
        },
      },
    ]);
  });

  it('logs a skipped delivery', async () => {
    const { handler, entries, context } = setup({ status: 'skipped' });
    await handler.run({ invitationId: id }, context);
    expect(entries.map((entry) => entry.message)).toEqual(['account invitation skipped']);
  });

  it('rethrows a store failure so the queue delivers the job again', async () => {
    const { handler, context } = setup(new Error('database down'));
    await expect(handler.run({ invitationId: id }, context)).rejects.toThrow('database down');
  });

  it('rejects a payload without a uuid and registers the job type', async () => {
    const { handler, processed, context } = setup({ status: 'skipped' });
    await expect(handler.run({ invitationId: 'x' }, context)).resolves.toMatchObject({
      status: 'invalid_payload',
    });
    expect(processed).toEqual([]);
    const types = jobHandlersFor({
      delivery: { sendDigest: () => Promise.reject(new Error('unused')) },
      closing: { closeUnobjected: () => Promise.reject(new Error('unused')) },
      retention: { run: () => Promise.reject(new Error('unused')) },
      invitations: { process: () => Promise.reject(new Error('unused')) },
    }).map((entry) => entry.type);
    expect(types).toContain('accounts.invite');
  });
});
