import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import Home from '../src/app/page';

describe('setup landing page', () => {
  it('identifies the demo and its operational limitations in server-rendered content', () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html).toContain('Demo / setup milestone');
    expect(html).toContain('Do not use it to run a live door.');
    expect(html).toContain('No accounts or venue data are connected.');
    // This milestone must not offer a form that appears to record real venue data.
    expect(html).not.toMatch(/<(?:form|input|button|textarea|select)\b/);
  });

  it('provides a main landmark, one primary heading, and valid in-page navigation', () => {
    const html = renderToStaticMarkup(<Home />);

    expect(html.match(/<h1\b/g)).toHaveLength(1);
    expect(html).toContain('<main id="main-content"');
    expect(html).toContain('Skip to content');
    const fragmentLinks = [...html.matchAll(/href="#([^"]+)"/g)];
    expect(fragmentLinks.length).toBeGreaterThan(0);
    for (const [, target] of fragmentLinks) {
      expect(html).toContain(`id="${target}"`);
    }
    expect(html).toContain('href="https://github.com/ryandils/encore#readme"');
  });
});
