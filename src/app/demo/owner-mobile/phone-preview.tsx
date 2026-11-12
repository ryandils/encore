'use client';

import { useState } from 'react';
import styles from './phone-preview.module.css';

export function OwnerPhonePreview() {
  const [width, setWidth] = useState(390);
  return <main className={styles.preview}>
    <header><h1>Owner mobile preview</h1><p>A phone-sized browser simulation, not a native iOS app. Sample data only.</p></header>
    <fieldset className={styles.sizes}><legend>Phone width</legend>{[320, 390, 430].map(size => <label key={size}><input type="radio" name="phone-width" value={size} checked={width === size} onChange={() => setWidth(size)} /><span>{size}px</span></label>)}</fieldset>
    <div className={styles.device} style={{ width }}><iframe title="Encore owner phone preview" src="/demo/owner-rehearsal" /></div>
    <p className={styles.note}>Scroll and use the controls inside the phone. Changing width keeps your current rehearsal.</p>
    <a className={styles.open} href="/demo/owner-rehearsal">Open owner view without the frame</a>
  </main>;
}