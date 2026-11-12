import { AccountForm } from './account-form';

export default function LocalAccountPage() {
  return <><h1 className="text-3xl font-semibold">Local account</h1><p className="leading-relaxed text-slate-300">Verify your test email before signing in. If you came from an invitation, keep that tab open and return to it after signing in.</p><AccountForm mode="sign-in" /></>;
}
