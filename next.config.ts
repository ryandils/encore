import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Keep contributor instructions authored here; dev startup must not rewrite AGENTS.md.
  agentRules: false,
  // Keep the development badge from covering phone-preview navigation; errors still surface.
  devIndicators: false,
  // TypeScript 7 exposes a native CLI instead of the legacy compiler API.
  // Keep Next's build-time checks enabled using its supported CLI integration.
  // Strict route types import the active generated validator through next-env.d.ts,
  // avoiding duplicate globals when both dev and production type output exist.
  experimental: { useTypeScriptCli: true, strictRouteTypes: true },
};

export default nextConfig;
