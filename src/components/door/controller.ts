import type { DoorState, EventCommand, LedgerApi } from '../../domain/contracts.ts';

export type DoorApi = Pick<LedgerApi, 'doorState' | 'recordEvent'>;
type Intent = EventCommand extends infer T ? T extends EventCommand ? Omit<T, 'requestId'> : never : never;
export interface PendingAction { readonly command: EventCommand; readonly label: string }
export interface ConsoleSnapshot {
  readonly state: DoorState | null;
  readonly queue: readonly PendingAction[];
  readonly phase: 'idle' | 'saving' | 'failed' | 'unknown';
  readonly message: string;
  readonly syncError: string | null;
  readonly lastSync: number | null;
  readonly now: number;
}

/** Holds submitted commands until their outcome is acknowledged; never projects pending taps. */
export class DoorController {
  private snapshot: ConsoleSnapshot;
  private listeners = new Set<() => void>();
  private writing = false;
  private reading = false;
  private unknownRequests = new Set<string>();
  constructor(private api: DoorApi, private nightId: string, private clock = Date.now, private requestId = () => crypto.randomUUID()) {
    this.snapshot = { state: null, queue: [], phase: 'idle', message: 'Loading door state…', syncError: null, lastSync: null, now: clock() };
  }
  getSnapshot = (): ConsoleSnapshot => this.snapshot;
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(change: Partial<ConsoleSnapshot>) { this.snapshot = { ...this.snapshot, ...change, now: this.clock() }; for (const listener of this.listeners) listener(); }
  tick = () => this.update({});
  isStale = () => this.snapshot.lastSync === null || this.clock() - this.snapshot.lastSync >= 10000;
  canSubmit = () => this.snapshot.state?.night.status === 'OPEN' && !this.isStale() && !this.snapshot.syncError && (this.snapshot.phase === 'idle' || this.snapshot.phase === 'saving');
  private accept(state: DoorState) {
    // A delayed poll or stored idempotency receipt must never roll back a newer count.
    const current = this.snapshot.state;
    const syncedAt = Date.parse(state.syncedAt);
    if (!Number.isFinite(syncedAt)) return;
    if (current && (state.night.version < current.night.version || (state.night.version === current.night.version && syncedAt < Date.parse(current.syncedAt)))) return;
    this.update({ state, lastSync: Math.min(this.clock(), syncedAt), syncError: null });
  }
  refresh = async () => {
    if (this.reading) return;
    this.reading = true;
    try {
      const result = await this.api.doorState(this.nightId);
      if (result.ok) { const initial = this.snapshot.state === null; this.accept(result.data); if (initial) this.update({ message: 'Door state synchronized.' }); }
      else this.update({ syncError: result.error.message });
    } catch { this.update({ syncError: 'Connection unavailable. Use a physical backup until synchronization returns.' }); }
    finally { this.reading = false; }
  };
  submit = (intent: Intent, label: string) => {
    if (!this.canSubmit()) return;
    const command = { ...intent, requestId: this.requestId() } as EventCommand;
    this.update({ queue: [...this.snapshot.queue, { command, label }], phase: 'saving', message: 'Saving. Pending taps are not included in the count.' });
    void this.drain();
  };
  retry = () => {
    if (this.writing || !this.snapshot.queue.length || !['failed', 'unknown'].includes(this.snapshot.phase)) return;
    this.update({ phase: 'saving', message: 'Retrying the original request; no new admission is created.' });
    void this.drain();
  };
  discardRejected = () => {
    if (this.snapshot.phase !== 'failed') return;
    // Only definitively rejected and never-submitted actions can be canceled.
    this.update({ queue: [], phase: 'idle', message: 'Rejected action and unsent taps canceled. No unknown request was discarded.' });
  };
  private async drain() {
    if (this.writing) return;
    this.writing = true;
    try {
      while (this.snapshot.queue.length && this.snapshot.phase === 'saving') {
        const action = this.snapshot.queue[0];
        if (!action) break;
        try {
          const result = await this.api.recordEvent(this.nightId, action.command);
          if (!result.ok) {
            const unresolved = this.unknownRequests.has(action.command.requestId);
            this.update({ phase: unresolved ? 'unknown' : 'failed', message: unresolved ? `Original outcome still unknown. Retry was rejected: ${result.error.message} Do not record this person again.` : `Not saved: ${result.error.message}` });
            void this.refresh(); break;
          }
          if (result.data.requestId !== action.command.requestId) throw new Error('Mismatched acknowledgement');
          this.unknownRequests.delete(action.command.requestId);
          this.accept(result.data.state);
          this.update({ queue: this.snapshot.queue.slice(1), message: `${action.label} saved in this demo.` });
        } catch {
          this.unknownRequests.add(action.command.requestId);
          this.update({ phase: 'unknown', message: 'Outcome unknown. This tap may have saved. Retry this same request before adding another person.' });
          break;
        }
      }
      if (!this.snapshot.queue.length) { this.update({ phase: 'idle' }); void this.refresh(); }
    } finally { this.writing = false; }
  }
}
