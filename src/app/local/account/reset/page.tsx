import { AccountForm } from '../account-form';

export default function ResetPasswordPage() {
  return <><h1 className="text-3xl font-semibold">Reset password</h1><p className="leading-relaxed text-slate-300">Request a recovery link for your existing test account. Replacing its password signs that account out on other devices; it does not verify its email.</p><AccountForm mode="reset" /></>;
}
