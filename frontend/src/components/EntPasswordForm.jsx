import { useId } from "react";
import { LockKeyhole } from "lucide-react";

const inputClass =
  "mt-2 block min-h-12 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

export function EntUsernameField({ value, onChange }) {
  return (
    <label className="block text-sm font-semibold text-gray-800">
      Identifiant ENT
      <input type="text" className={inputClass} autoComplete="username" autoCapitalize="none"
        value={value} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

export default function EntPasswordForm({
  title, password, onPasswordChange, onSubmit, busy, error, submitLabel, onCancel, cancelLabel, children,
}) {
  const id = useId();
  return (
    <form
      className="mx-auto w-full max-w-md space-y-5 rounded-2xl border border-gray-200 bg-white p-5 text-left text-gray-900 shadow-sm sm:p-7"
      onSubmit={onSubmit}
      aria-labelledby={`${id}-title`}
      aria-busy={busy}
    >
      <div className="space-y-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LockKeyhole size={21} aria-hidden="true" />
        </span>
        <h2 id={`${id}-title`} className="text-xl font-bold leading-tight sm:text-2xl">{title}</h2>
        <p id={`${id}-hint`} className="text-base leading-relaxed text-gray-700">
          Saisis ton mot de passe <strong className="font-semibold text-gray-900">une seule fois sur ce navigateur</strong>.
          Il y sera mémorisé pour tes prochains accès.
        </p>
      </div>
      <div className="space-y-4">
        {children}
        <label className="block text-sm font-semibold text-gray-800">
          Mot de passe ENT
          <input
            type="password"
            autoComplete="current-password"
            aria-describedby={`${id}-hint`}
            className={inputClass}
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm leading-relaxed text-red-800">
            {error}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <button type="submit" disabled={busy}
          className="min-h-12 w-full rounded-xl bg-primary px-4 py-2 text-base font-semibold text-white transition-colors hover:bg-primary-dark disabled:opacity-60">
          {busy ? "Connexion en cours…" : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={busy}
            className="min-h-11 w-full rounded-xl px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60">
            {cancelLabel}
          </button>
        )}
      </div>
    </form>
  );
}
