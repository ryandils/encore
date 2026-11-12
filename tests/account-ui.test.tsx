import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { AccountForm } from '../src/app/local/account/account-form';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
describe('account forms before hydration', () => {
  it.each(['sign-in', 'verify', 'reset'] as const)('keeps %s controls disabled until the handler attaches', (mode) => {
    const markup = renderToStaticMarkup(<AccountForm mode={mode} />);
    expect(markup).toContain('method="post"');
    const controls = markup.match(/<(?:input|button)\b[^>]*>/g) ?? [];
    expect(controls.length).toBeGreaterThanOrEqual(2);
    for (const control of controls) expect(control).toContain('disabled=""');
  });
});
