'use client';

import { useState } from 'react';
import type { CoverPreset, PresetSlot } from '../../domain/contracts';
import type { OwnerFixtureState } from './fixture-model';
import styles from './owner-tonight.module.css';

export function OwnerDoorControls({ state, presets, blocked, onRecord }: {
  state: OwnerFixtureState;
  presets: readonly CoverPreset[];
  blocked: boolean;
  onRecord: (type: 'ADMISSION' | 'EXIT', slot?: PresetSlot) => void;
}) {
  const [price, setPrice] = useState('1');
  const open = state.active?.summary.night.status === 'OPEN';
  const occupancy = state.active?.summary.projection.occupancy ?? 0;
  const slot = price === 'free' ? undefined : Number(price) as PresetSlot;
  const selected = presets.find((preset) => preset.slot === slot);
  const unavailable = !open || blocked;
  return <div className={styles.doorControls}>
    <h2>Record a person</h2>
    <label>Entry price<select value={price} disabled={unavailable} onChange={(event) => setPrice(event.target.value)}>
      {presets.map((preset) => <option key={preset.slot} value={preset.slot}>{preset.label} — ${(preset.amountCents / 100).toFixed(2)}</option>)}
      <option value="free">Free entry — $0.00</option>
    </select></label>
    <div className={styles.doorButtons}>
      <button type="button" className={styles.secondary} disabled={unavailable || occupancy === 0} onClick={() => onRecord('EXIT')} aria-label="Record one person exiting">− Exit</button>
      <button type="button" className={styles.primary} disabled={unavailable || (slot !== undefined && !selected)} onClick={() => onRecord('ADMISSION', slot)} aria-label="Record one person entering">+ Entry</button>
    </div>
    <p className={styles.context}>{!open ? 'Start a night in My bar to record people.' : blocked ? 'Finish or cancel the cash check before recording people.' : `Entry records one person and $${((selected?.amountCents ?? 0) / 100).toFixed(2)}. Exit removes one person without changing cash.`}</p>
    {open && occupancy === 0 && <p className={styles.context}>Nobody is recorded inside. Exit is unavailable at zero.</p>}
    <p role="status" className={styles.context}>{open ? `${occupancy} people recorded inside · Practice only` : 'Practice only · No live door connected'}</p>
  </div>;
}
