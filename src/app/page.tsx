export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 sm:px-8">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 py-6">
        <p className="text-2xl font-semibold tracking-tight">encore<span className="text-amber-300">.</span></p>
        <p className="rounded-full border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs font-semibold text-amber-200">
          Demo / setup milestone
        </p>
      </header>

      <main id="main-content" className="flex-1 py-12 sm:py-20">
        <section aria-labelledby="welcome-title" className="max-w-3xl">
          <p className="mb-5 text-sm font-medium uppercase tracking-widest text-amber-200">
            Built for the door
          </p>
          <h1 id="welcome-title" className="text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
            Know your door.<br />
            <span className="text-slate-400">Account for your cover.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-300">
            Encore is being built to help small venues record entries and exits,
            then compare recorded cash cover with cash counted at close.
          </p>
          <a href="#setup-status" className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-amber-300 px-5 py-3 font-semibold text-slate-950 transition-colors hover:bg-amber-200">
            See what works today <span aria-hidden="true" className="ml-3">↓</span>
          </a>
        </section>

        <section id="setup-status" aria-labelledby="setup-title" className="mt-14 scroll-mt-6 rounded-2xl border border-white/10 bg-slate-900 p-6 sm:mt-20 sm:p-8">
          <p className="mb-2 text-sm font-medium text-amber-200">Current milestone · B0.3</p>
          <h2 id="setup-title" className="text-2xl font-semibold tracking-tight">The foundation is taking shape.</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-slate-300">
            This page is a setup preview. It does not record admissions, track
            occupancy, or reconcile cash. Do not use it to run a live door.
          </p>

          <dl className="mt-7 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-slate-100">Available now</dt>
              <dd className="mt-2 leading-relaxed text-slate-300">
                A responsive landing page, local database storage, and a synthetic
                owner/staff sign-in demo for local development.
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-100">Still to come</dt>
              <dd className="mt-2 leading-relaxed text-slate-300">
                Door recording, venue permissions, and owner closeout.
                No real accounts or venue data are connected.
              </dd>
            </div>
          </dl>
          <a href="/demo/sign-in" className="mt-7 inline-flex min-h-12 items-center rounded-lg border border-amber-300/60 px-5 py-3 font-semibold text-amber-200 hover:bg-amber-300/10">Try local sign-in demo</a>
        </section>
      </main>

      <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-white/10 py-5 text-sm text-slate-400">
        <p>Encore · A clearer picture of your night.</p>
        <a className="inline-flex min-h-12 items-center text-slate-200 underline decoration-slate-500 underline-offset-4 hover:text-amber-200" href="https://github.com/ryandils/encore#readme">
          Contributor setup guide <span aria-hidden="true" className="ml-2">↗</span>
        </a>
      </footer>
    </div>
  );
}
