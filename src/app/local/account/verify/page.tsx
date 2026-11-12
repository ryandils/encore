import { AccountForm } from '../account-form';

export default function VerifyEmailPage() {
  return <><h1 className="text-3xl font-semibold">Verify email</h1><p className="leading-relaxed text-slate-300">Request a verification link for your existing test account, or confirm the link you opened. Verification does not sign you in automatically.</p><AccountForm mode="verify" /></>;
}
