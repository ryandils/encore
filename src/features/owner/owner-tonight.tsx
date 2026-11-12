import type { ReactNode } from 'react';
import type { OwnerFixtureState } from './fixture-model';
import styles from './owner-tonight.module.css';

const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

export function OwnerTonight({ state, onLoadSample, onReviewCurrentNight, children }: { children?: ReactNode; state: OwnerFixtureState; onLoadSample: () => void; onReviewCurrentNight: () => void }) {
  const summary = state.active?.summary;
  const projection = summary?.projection;
  const closed = summary?.night.status === 'CLOSED';
  const capacity = summary?.night.capacity ?? state.venue?.capacity ?? 0;
  return <section className={styles.dashboard} aria-labelledby="tonight-title" id="tonight" tabIndex={-1}>
    <div className={styles.heading}><div><p className={styles.eyebrow}>OWNER / TONIGHT</p><h1 id="tonight-title">{state.venue?.name ?? 'Your night starts here.'}</h1></div><span className={styles.status}>{summary ? closed ? 'Closed' : 'Open' : 'Not open'}</span></div>
    <p className={styles.context}>{summary ? summary.night.label : 'Set up your bar, or try the buttons with sample numbers.'}</p>
    <p className={styles.sample}>Practice only · This page only · Refresh resets it</p>
    <div className={styles.occupancy}><div><span>People inside (recorded)</span><strong>{projection?.occupancy ?? '—'}<small> people</small></strong></div><span className={styles.capacity}>{capacity > 0 ? `Room capacity ${capacity}` : 'Room capacity not set'}</span>
      {projection && capacity > 0 && <progress aria-label={`Sample occupancy ${projection.occupancy} of room capacity ${capacity}`} value={Math.min(projection.occupancy, capacity)} max={capacity} />}
      <p>{projection?.atOrAboveCapacity ? 'At or above room capacity. Check the room.' : 'Based on entries and exits. Check the room if the count looks wrong.'}</p>
    </div>
    {summary && !closed && <a className={styles.primary} href="#closeout">Finish tonight</a>}
    {children}
    <dl className={styles.metrics}><div><dt>Door money recorded</dt><dd>{projection ? money(projection.expectedCoverCents) : '—'}</dd></div><div><dt>Cash to expect</dt><dd>{projection ? money(projection.expectedDrawerCents) : '—'}</dd></div><div><dt>Came in / left</dt><dd>{projection ? `${projection.entries} / ${projection.exits}` : '—'}</dd></div><div><dt>Most inside at once</dt><dd>{projection?.peakOccupancy ?? '—'}</dd></div></dl>
    <p className={styles.context}>{summary ? `Cash to expect includes ${money(summary.openingFloatCents)} starting cash. Includes the door money recorded tonight.` : 'Your totals appear after you open a night. No sample numbers are presented as your actual activity.'}</p>
    <div className={styles.next}><div><p className={styles.eyebrow}>NEXT STEP</p><h2>{summary ? closed ? 'Your final totals are ready.' : 'Keep your night in view.' : state.venue ? 'Ready for doors?' : 'Set up your bar.'}</h2><p>{summary ? closed ? 'See your final count and any cash difference.' : 'Try adding a sample entry. When finished, count the cash and end the night.' : 'Enter your bar name, room capacity and entry prices. Then start a night.'}</p></div>
      <a className={styles.primary} onClick={closed ? onReviewCurrentNight : undefined} href={summary ? closed ? '#summary' : '#activity' : '#setup'}>{summary ? closed ? 'View final totals' : 'Try adding an entry' : state.venue ? 'Start a sample night' : 'Set up my bar'}<span aria-hidden="true">→</span></a>
      {summary && !closed && (
        // biome-ignore lint/a11y/useValidAnchor: This link navigates to the summary; the handler selects the current night first.
        <a className={styles.secondary} href="#summary" onClick={onReviewCurrentNight}>View current totals</a>
      )}
      {!state.venue && <button type="button" className={styles.secondary} onClick={onLoadSample}>Try it with sample numbers</button>}
    </div>
  </section>;
}