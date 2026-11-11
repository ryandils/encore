import type { ApiResult, EventCommand, EventResult } from '../../domain/contracts.ts';
import { parseEventCommand } from '../../domain/contracts.ts';
import { assertNonemptyString, assertUuid } from '../../domain/validation.ts';
import type { DoorApi } from '../../components/door/controller.ts';

type RequestStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export function pendingRequestKey(userId: string, nightId: string): string {
  assertNonemptyString(userId, 'userId'); assertUuid(nightId, 'nightId');
  return `encore:pending-door:v1:${encodeURIComponent(userId)}:${nightId}`;
}

/** One submitted request, not an offline queue. A restored request always has an unknown outcome. */
export function createPendingDoorApi(api: DoorApi, storage: RequestStorage, key: string, nightId: string,
  onChange?: (pending: EventCommand | null, error?: string) => void) {
  assertUuid(nightId, 'nightId');
  const stored = storage.getItem(key);
  let pending = stored === null ? null : parseEventCommand(JSON.parse(stored));
  let unknown = pending !== null;
  let unavailable = false;
  function storageFailure(): never {
    unavailable = true;
    const message = 'Local request storage is unavailable. Recording is paused; resolve prior requests before changing browser settings.';
    onChange?.(pending, message);
    throw new Error(message);
  }
  function save(command: EventCommand) {
    pending = command;
    const serialized = JSON.stringify(command);
    try { storage.setItem(key, serialized); if (storage.getItem(key) !== serialized) throw new Error('Request storage verification failed.'); }
    catch { storageFailure(); }
    onChange?.(pending);
  }
  function clear(command: EventCommand) {
    try {
      const current = storage.getItem(key);
      if (current === null || JSON.stringify(parseEventCommand(JSON.parse(current))) !== JSON.stringify(command)) throw new Error('Pending request changed.');
      storage.removeItem(key);
      if (storage.getItem(key) !== null) throw new Error('Request storage was not cleared.');
    } catch { storageFailure(); }
    pending = null; unknown = false; onChange?.(null);
  }
  const wrapped: DoorApi = {
    doorState: (id) => {
      if (id !== nightId) throw new Error('Wrong night for this request journal.');
      return api.doorState(id);
    },
    async recordEvent(id, value) {
      if (unavailable) storageFailure();
      if (id !== nightId) throw new Error('Wrong night for this request journal.');
      const command = parseEventCommand(value);
      if (pending && JSON.stringify(pending) !== JSON.stringify(command)) throw new Error('Resolve the existing request before recording another action.');
      if (!pending) save(command);
      try {
        const result = await api.recordEvent(id, command);
        if (result.ok && (result.data.requestId !== command.requestId || result.data.state.night.id !== nightId)) throw new Error('Mismatched request acknowledgement.');
        if (result.ok || !unknown) clear(command);
        return result;
      } catch (error) { unknown = true; throw error; }
    },
  };
  return {
    api: wrapped,
    pending: (): EventCommand | null => pending,
    retry: (): Promise<ApiResult<EventResult>> => {
      if (!pending) return Promise.reject(new Error('There is no unresolved request.'));
      return wrapped.recordEvent(nightId, pending);
    },
  };
}
