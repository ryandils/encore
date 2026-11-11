import type { ApiResult, CloseCommand, CloseResult } from '../../domain/contracts.ts';
import { parseCloseCommand } from '../../domain/contracts.ts';
import { assertNonemptyString, assertUuid } from '../../domain/validation.ts';
import type { OwnerApi } from './http-owner-api.ts';

type CloseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type CloseApi = Pick<OwnerApi, 'summary' | 'closeNight'>;
const STORAGE_ERROR = 'Close request storage is unavailable or corrupted. Writes are paused; resolve prior close requests before changing browser settings.';
export function pendingCloseKey(userId: string, nightId: string): string {
  assertNonemptyString(userId, 'userId'); assertUuid(nightId, 'nightId');
  return `encore:pending-close:v1:${encodeURIComponent(userId)}:${nightId}`;
}

/** Recover this server user's unresolved nights before a catalog/permission change can hide them. */
export function pendingCloseNightIds(userId: string, storage: Pick<Storage, 'length' | 'key' | 'getItem'>): string[] {
  assertNonemptyString(userId, 'userId');
  const prefix = `encore:pending-close:v1:${encodeURIComponent(userId)}:`;
  try {
    const count = storage.length;
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Unverified storage length.');
    const ids: string[] = [];
    for (let index = 0; index < count; index++) {
      const key = storage.key(index);
      if (typeof key !== 'string') throw new Error('Storage enumeration changed.');
      if (!key.startsWith(prefix)) continue;
      const id = key.slice(prefix.length);
      assertUuid(id, 'pending nightId');
      if (storage.getItem(key) === null) throw new Error('Pending close storage changed.');
      ids.push(id);
    }
    return [...new Set(ids)].sort();
  } catch { throw new Error(STORAGE_ERROR); }
}

/** One original close command in this tab, never a cached authoritative summary or offline queue. */
export function createPendingCloseApi(api: CloseApi, storage: CloseStorage, key: string, nightId: string,
  onChange?: (pending: CloseCommand | null, error?: string) => void) {
  assertUuid(nightId, 'nightId');
  let pending: CloseCommand | null = null;
  let unavailable = false;
  let inFlight = false;
  function storageFailure(): never {
    unavailable = true;
    const message = STORAGE_ERROR;
    onChange?.(pending ? { ...pending } : null, message);
    throw new Error(message);
  }
  try { const stored = storage.getItem(key); pending = stored === null ? null : parseCloseCommand(JSON.parse(stored)); } catch { storageFailure(); }
  let unknown = pending !== null;
  function save(command: CloseCommand): void {
    pending = command;
    const serialized = JSON.stringify(command);
    try { storage.setItem(key, serialized); if (storage.getItem(key) !== serialized) throw new Error('Unverified request storage.'); } catch { storageFailure(); }
    onChange?.({ ...command });
  }
  function clear(command: CloseCommand): void {
    try {
      const stored = storage.getItem(key);
      if (stored === null || JSON.stringify(parseCloseCommand(JSON.parse(stored))) !== JSON.stringify(command)) throw new Error('Pending close changed.');
      storage.removeItem(key); if (storage.getItem(key) !== null) throw new Error('Pending close was not cleared.');
    } catch { storageFailure(); }
    pending = null; unknown = false; onChange?.(null);
  }
  const wrapped: CloseApi = {
    summary: (id) => { if (id !== nightId) throw new Error('Wrong night for this close journal.'); return api.summary(id); },
    async closeNight(id, value) {
      if (unavailable) storageFailure();
      if (id !== nightId) throw new Error('Wrong night for this close journal.');
      if (inFlight) throw new Error('A close request is already in progress.');
      const command = parseCloseCommand(value);
      if (pending && JSON.stringify(command) !== JSON.stringify(pending)) throw new Error('Resolve the original close request before changing its values.');
      if (!pending) save(command);
      inFlight = true;
      try {
        const result = await api.closeNight(id, command);
        if (result.ok) {
          const reconciliation = result.data.summary.reconciliation;
          if (result.data.requestId !== command.requestId || result.data.summary.night.id !== nightId || result.data.summary.night.status !== 'CLOSED'
            || !reconciliation || reconciliation.countedCashCents !== command.countedCashCents || reconciliation.notes !== command.notes) throw new Error('Unverified close acknowledgement.');
        } else if (result.error.code === 'UNAVAILABLE') throw new Error('Close outcome is unknown.');
        if (result.ok || !unknown) clear(command);
        return result;
      } catch (error) { unknown = true; throw error; } finally { inFlight = false; }
    },
  };
  return {
    api: wrapped,
    pending: (): CloseCommand | null => pending ? { ...pending } : null,
    retry: (): Promise<ApiResult<CloseResult>> => pending ? wrapped.closeNight(nightId, pending) : Promise.reject(new Error('There is no unresolved close request.')),
  };
}
