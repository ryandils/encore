import type { ReactNode } from 'react';

export function DemoShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 sm:px-8">
      <a className="skip-link" href="#demo-content">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 py-6">
        <a href="/" className="inline-flex min-h-12 items-center text-2xl font-semibold">encore<span className="text-amber-300">.</span></a>
        <p className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200">Synthetic local demo</p>
      </header>
      <main id="demo-content" className="flex-1 py-10 sm:py-14">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <div className="mt-6">{children}</div>
      </main>
      <footer className="border-t border-white/10 py-5 text-sm leading-relaxed text-slate-400">
        Fake accounts only. This demo cannot operate a venue, record admissions, or reconcile cash.
      </footer>
    </div>
  );
}

export function DemoUnavailable() {
  return (
    <DemoShell title="Demo temporarily unavailable">
      <p className="leading-relaxed text-slate-300">We could not load the local demo. Check the local setup and database, then try again.</p>
      <a href="/demo/sign-in" className="mt-6 inline-flex min-h-12 items-center rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-950">Try again</a>
    </DemoShell>
  );
}
