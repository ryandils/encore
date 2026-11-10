import type { CloseCommand, CloseResult, EventCommand, EventResult } from '../domain/contracts.ts';

/** Internal server contract, never construct from client role/actor fields. B4 supplies the implementation. */
export interface LedgerCommandContext {
  readonly authenticatedUserId: string;
  readonly nightId: string;
}
/**
 * For each call B4 must authorize venue membership/active assignment, lock the night,
 * and compare stored request payload before rejecting a closed night. Identical retries
 * return the stored responseSnapshot; changed payloads conflict. Staff undo additionally
 * requires their own latest uncorrected action, <=60 seconds old, on an open night.
 * A paid admission reads the preset on the server, rejects a stale expected amount,
 * and stores the charged amount. Free entry stores an ADMISSION with amountCents=0.
 * Events, receipt, sequence and version commit atomically. Closing uses that same lock
 * and stores reconciliation plus its request/response receipt atomically. Implementations
 * must not expose financial summary data in EventResult, even to owner door clients.
 * No runtime transaction, permission enforcement, or HTTP endpoint exists in B1.
 */
export interface TransactionalLedgerCommands {
  record(context: LedgerCommandContext, command: EventCommand): Promise<EventResult>;
  close(context: LedgerCommandContext, command: CloseCommand): Promise<CloseResult>;
}
