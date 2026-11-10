'use client';

import { useState } from 'react';
import { DoorConsole } from '../../../components/door/door-console';
import { createSyntheticDoorAdapter } from '../../../features/door/synthetic-adapter';

export function DoorDemo() {
  const [adapter] = useState(() => createSyntheticDoorAdapter());
  return <main id="main-content">
    <aside style={{ maxWidth: '36rem', margin: 'auto', padding: '1rem 1.25rem', boxSizing: 'border-box', background: '#302b25', color: '#ffe3a1' }} aria-label="Synthetic demo notice">
      <strong>{adapter.label}</strong><p>Practice only. No real admissions, cash, or venue access. Refresh resets this browser’s fixture; devices do not share data.</p>
      <details><summary style={{ minHeight: 44, cursor: 'pointer' }}>Demo connection controls</summary><p>Use these synthetic failures to rehearse recovery. Each selected outcome applies to one save only.</p><label style={{ display: 'block', padding: '.75rem 0' }}><input type="checkbox" onChange={event => adapter.setOffline(event.target.checked)} /> Simulate disconnected adapter</label><label>Next save outcome <select defaultValue="" style={{ minHeight: 44, maxWidth: '100%' }} onChange={event => { const value = event.target.value; if (value === 'success' || value === 'reject' || value === 'unknown') adapter.setNextWriteOutcome(value); event.currentTarget.value = ''; }}><option value="" disabled>Choose a one-shot outcome</option><option value="success">Acknowledged</option><option value="reject">Rejected before saving</option><option value="unknown">Saved, acknowledgement lost</option></select></label></details>
    </aside>
    <DoorConsole api={adapter.api} nightId={adapter.nightId} />
  </main>;
}
