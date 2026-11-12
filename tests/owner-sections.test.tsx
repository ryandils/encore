import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import OwnerConsole from '../src/features/owner/owner-console';

it('starts on Tonight and keeps other sections hidden with their forms intact', () => {
  const html = renderToStaticMarkup(<OwnerConsole />);
  expect(html).toMatch(/<div><section[^>]*id="tonight"/);
  expect(html).toContain('href="#tonight" aria-current="location"');
  for (const id of ['setup', 'activity', 'summary', 'access', 'closeout', 'history']) {
    expect(html).toMatch(new RegExp(`<section[^>]*id="${id}"[^>]*hidden=""[^>]*tabindex="-1"[^>]*aria-labelledby="${id}-title"`));
  }
  expect(html).toContain('name="venueName"');
  expect(html).toContain('aria-label="Owner sections"');
});

it('keeps only bottom navigation and starts Prepare with one visible price', () => {
  const html = renderToStaticMarkup(<OwnerConsole />);
  expect(html).not.toContain('Synthetic demo only');
  expect(html).not.toContain('Changes exist only');
  expect(html).not.toContain('Ready to rehearse');
  expect(html).not.toContain('(for example, America/New_York)');
  expect(html).not.toContain('(sample)');
  expect(html.match(/<nav /g)).toHaveLength(1);
  expect(html).toContain('Practice · resets on refresh');
  expect(html).toContain('<fieldset><legend>Entry price 1</legend>');
  expect(html).toContain('<fieldset hidden=""><legend>Entry price 2</legend>');
  expect(html).toContain('<fieldset hidden=""><legend>Entry price 3</legend>');
  expect(html).toContain('type="button" aria-label="Add another entry price"');
  expect(html).toContain('1 of 3 entry prices');
});

it('keeps Finish out of the four bottom tabs and defaults to a truthful 5am practice prompt', () => {
  const html = renderToStaticMarkup(<OwnerConsole />);
  const nav = html.match(/<nav[\s\S]*?<\/nav>/)?.[0] ?? '';
  expect(nav.match(/<a /g)).toHaveLength(4);
  expect(nav).not.toContain('#closeout');
  expect(html).toContain('type="time"');
  expect(html).toContain('value="05:00"');
  expect(html).toContain('Automatic closing while the app is off is not connected.');
});
