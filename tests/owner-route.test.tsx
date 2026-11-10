import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NOT_FOUND'); } }));
vi.mock('../src/features/owner/owner-console', () => ({ default: () => null }));

import OwnerRehearsalPage from '../src/app/demo/owner-rehearsal/page';

afterEach(() => vi.unstubAllEnvs());

describe('isolated owner rehearsal boundary', () => {
  it('rejects production before rendering fixture controls', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => OwnerRehearsalPage()).toThrow('NOT_FOUND');
  });

  it('renders the synthetic rehearsal in development without a database', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(OwnerRehearsalPage()).toBeTruthy();
  });
});
