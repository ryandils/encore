import type { ApiErrorCode, ApiResult, DoorState, EventResult, LedgerApi } from '../../domain/contracts.ts';
import { eventRequestPayload, parseEventCommand } from '../../domain/contracts.ts';
import { createLedgerFixtures, SYNTHETIC_FIXTURE_LABEL } from '../../domain/fixtures.ts';
import { projectLedger } from '../../domain/ledger.ts';
import type { DoorEvent } from '../../domain/types.ts';
import { DomainValidationError } from '../../domain/validation.ts';

export type DoorApi = Pick<LedgerApi, 'doorState' | 'recordEvent'>;
export type SyntheticWriteOutcome = 'success' | 'reject' | 'unknown';

/** Browser-memory rehearsal only. This is neither authorization nor durable storage. */
export function createSyntheticDoorAdapter(options: { now?: () => number; delayMs?: number } = {}) {
  const fixture = createLedgerFixtures();
  const now = options.now ?? Date.now;
  const openedAt = new Date(now()).toISOString();
  const events: DoorEvent[] = [];
  const receipts = new Map<string, { payload: string; result: EventResult }>();
  let offline = false;
  let closedAt: string | null = null;
  let nextOutcome: SyntheticWriteOutcome = 'success';
  const actorId = 'synthetic-door-operator';
  const pause = async () => {
    if ((options.delayMs ?? 200) > 0) await new Promise<void>((resolve) => setTimeout(resolve, options.delayMs ?? 200));
    if (offline) throw new Error('Synthetic connection unavailable.');
  };
  const failure = <T>(code: ApiErrorCode, message: string): ApiResult<T> => ({ ok: false, error: { code, message } });
  const state = (): DoorState => {
    const projection = projectLedger(fixture.input, events);
    const reversed = new Set(projection.reversedEventIds);
    const latest = events.findLast((event) => event.actorId === actorId && event.type !== 'REVERSAL' && !reversed.has(event.id));
    const time = now();
    return {
      night: { ...fixture.night, openedAt, status: closedAt === null ? 'OPEN' : 'CLOSED', closedAt, version: events.length },
      occupancy: projection.occupancy,
      atOrAboveCapacity: projection.atOrAboveCapacity,
      presets: fixture.originalPresets.map((preset) => ({ ...preset })),
      recentActions: events.slice(-20).reverse().map((event) => ({
        id: event.id, type: event.type, sequence: event.sequence, recordedAt: event.recordedAt,
        amountCents: event.amountCents, reversed: reversed.has(event.id),
        canUndo: closedAt === null && event.id === latest?.id && time >= Date.parse(event.recordedAt) && time - Date.parse(event.recordedAt) <= 60_000,
      })),
      syncedAt: new Date(time).toISOString(),
    };
  };
  const api: DoorApi = {
    async doorState(nightId) {
      await pause();
      if (nightId !== fixture.night.id) return failure('NOT_FOUND', 'Synthetic night not found.');
      return { ok: true, data: state() };
    },
    async recordEvent(nightId, input) {
      await pause();
      if (nightId !== fixture.night.id) return failure('NOT_FOUND', 'Synthetic night not found.');
      let result: EventResult;
      const outcome = nextOutcome;
      nextOutcome = 'success';
      try {
        const command = parseEventCommand(input);
        const payload = eventRequestPayload(nightId, command);
        const receipt = receipts.get(command.requestId);
        if (receipt) return receipt.payload === payload
          ? { ok: true, data: structuredClone(receipt.result) }
          : failure('REQUEST_CONFLICT', 'This request ID already belongs to a different action.');
        if (closedAt !== null) return failure('NIGHT_CLOSED', 'This synthetic night is closed.');
        if (outcome === 'reject') return failure('RATE_LIMITED', 'Simulated rejected save. No action was recorded; retry when ready.');
        const base = {
          id: crypto.randomUUID(), requestId: command.requestId, venueId: fixture.input.venueId, nightId,
          actorId, sequence: events.length + 1, recordedAt: new Date(now()).toISOString(),
        };
        let event: DoorEvent;
        switch (command.type) {
          case 'ADMISSION': {
            const preset = fixture.originalPresets.find((item) => item.slot === command.presetSlot);
            if (!preset || preset.amountCents !== command.expectedAmountCents) return failure('STALE_PRESET', 'The cover price changed. Refresh before recording a new admission.');
            event = { ...base, type: 'ADMISSION', amountCents: preset.amountCents };
            break;
          }
          case 'FREE_ADMISSION': event = { ...base, type: 'ADMISSION', amountCents: 0 }; break;
          case 'EXIT': event = { ...base, type: 'EXIT', amountCents: 0 }; break;
          case 'REVERSAL': {
            if (!state().recentActions.some((action) => action.id === command.targetEventId && action.canUndo)) return failure('FORBIDDEN', 'Only your latest uncorrected action within 60 seconds can be undone.');
            event = { ...base, type: 'REVERSAL', amountCents: 0, targetEventId: command.targetEventId, reason: command.reason };
            break;
          }
        }
        // Validate the full candidate history before mutating the acknowledged fixture.
        projectLedger(fixture.input, [...events, event]);
        events.push(event);
        result = { eventId: event.id, requestId: command.requestId, state: state() };
        receipts.set(command.requestId, { payload, result: structuredClone(result) });
      } catch (error) {
        if (error instanceof DomainValidationError) return failure(error.code, error.message);
        throw error;
      }
      // A lost response is ambiguous: the caller must reconcile using the same request ID.
      if (outcome === 'unknown') throw new Error('Synthetic response lost after save; outcome unknown to this device.');
      return { ok: true, data: result };
    },
  };
  return {
    api, nightId: fixture.night.id, label: SYNTHETIC_FIXTURE_LABEL,
    setOffline(value: boolean) { offline = value; },
    setNextWriteOutcome(value: SyntheticWriteOutcome) { nextOutcome = value; },
    /** Test/rehearsal control, not an owner closeout API. */
    setClosed() { closedAt = new Date(now()).toISOString(); },
  };
}
