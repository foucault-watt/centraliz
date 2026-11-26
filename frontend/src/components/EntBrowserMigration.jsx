import { useEffect, useState } from "react";
import { fetchApi } from "../utils/api";
import {
  confirmBrowserEntMigration,
  saveBrowserEntCredentials,
} from "../utils/browserEntCredentials";

const API = "/api/auth/ent-browser-migration";
const post = (action, body = {}) => fetchApi(`${API}/${action}`, {
  method: "POST", body: JSON.stringify(body),
});

export default function EntBrowserMigration({ user, onMigrated, children }) {
  const account = user?.userName;
  const eligible = user?.canMigrateEntPassword;
  const receipt = user?.entPasswordMigrationId;
  const [confirmedReceipt, setConfirmedReceipt] = useState(null);
  const [dismissed, setDismissed] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!account || !receipt) return;
    let current = true;
    confirmBrowserEntMigration(account, receipt).then(() => {
      if (current) setConfirmedReceipt(receipt);
    });
    return () => { current = false; };
  }, [account, receipt]);

  const migrate = async (event) => {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setMessage("");
    try {
      const preparation = await post("prepare", { password });
      const data = await preparation.json();
      if (!preparation.ok) {
        if (data.code === "ENT_CREDENTIALS_INVALID") {
          setMessage("Le mot de passe ENT est incorrect.");
          return;
        }
        throw new Error("Migration unavailable");
      }
      const { id, entUsername } = data;
      const saved = await saveBrowserEntCredentials(account, { ent_username: entUsername, password }, id);
      if (!saved) {
        setMessage("Ce navigateur n’a pas pu enregistrer le mot de passe. La migration est reportée.");
        return;
      }
      const confirmation = await post("commit", { id });
      if (!confirmation.ok) throw new Error("Migration was not confirmed");
      await confirmBrowserEntMigration(account, id);
      await onMigrated();
    } catch {
      setMessage("La migration n’a pas pu être confirmée. Tu peux réessayer ou continuer pour l’instant.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  };

  if (receipt && confirmedReceipt !== receipt) {
    return <p role="status" className="p-4">Préparation de l’accès ENT sur ce navigateur…</p>;
  }
  if (!eligible || dismissed) return children;

  return (
    <form onSubmit={migrate} className="mx-auto my-6 max-w-md space-y-4 rounded-xl bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Connexion ENT</h2>
      <p className="text-sm">
        Saisis ton mot de passe une fois pour l’enregistrer sur ce navigateur.
        Centraliz supprimera ensuite la copie serveur.
      </p>
      <label className="block text-sm">
        Mot de passe ENT
        <input
          type="password"
          autoComplete="current-password"
          className="mt-1 block w-full rounded-lg border border-gray-300 p-2"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {message && <p role="alert" className="text-sm">{message}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 font-semibold text-white" disabled={busy}>
          {busy ? "Validation…" : "Continuer"}
        </button>
        <button type="button" className="rounded-lg border border-gray-300 px-4 py-2" disabled={busy}
          onClick={() => { setPassword(""); setDismissed(true); }}>
          Plus tard
        </button>
      </div>
    </form>
  );
}
