import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { OwnerPhonePreview } from '../src/app/demo/owner-mobile/phone-preview';

it('offers three phone widths and embeds the actual owner fixture with an accessible frame label', () => {
  const html = renderToStaticMarkup(<OwnerPhonePreview />);
  expect(html).toContain('not a native iOS app');
  expect(html).toContain('title="Encore owner phone preview"');
  expect(html).toContain('src="/demo/owner-rehearsal"');
  expect(html).toContain('width:390px');
  for (const width of [320, 390, 430]) expect(html).toContain(`value="${width}"`);
  expect(html).toContain('Open owner view without the frame');
});