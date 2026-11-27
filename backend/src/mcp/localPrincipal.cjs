const accountError = (code, message) => Object.assign(new Error(message), { code });

function createAccountDirectory(supabase) {
  return {
    async findByUsername(username) {
      const { data, error } = await supabase.from("users").select("username, ent_username").eq("username", username).maybeSingle();
      if (error) throw error;
      return data;
    },
    async findByEntUsername(username) {
      const { data, error } = await supabase.from("users").select("username, ent_username").eq("ent_username", username).limit(2);
      if (error) throw error;
      return data || [];
    },
  };
}

async function resolveLocalPrincipal(input, { directory, deriveUserKey }) {
  const identifier = typeof input === "string" ? input.trim() : "";
  if (!identifier) throw accountError("MCP_ACCOUNT_NOT_FOUND", "Saisissez un identifiant ENT ou Centraliz.");
  let exact;
  let linked;
  try {
    exact = await directory.findByUsername(identifier);
    linked = await directory.findByEntUsername(identifier);
  } catch {
    throw accountError("MCP_ACCOUNT_LOOKUP_FAILED", "Impossible de vérifier le compte. Vérifiez la connexion à la base et backend/.env.");
  }
  const matches = new Map([...linked, ...(exact ? [exact] : [])].map(user => [user.username, user]));
  if (matches.size > 1) throw accountError("MCP_ACCOUNT_AMBIGUOUS", "Cet identifiant correspond à plusieurs comptes. Utilisez l’identifiant Centraliz exact ou corrigez la liaison ENT.");
  if (!matches.size) throw accountError("MCP_ACCOUNT_NOT_FOUND", "Aucun compte Centraliz trouvé pour cet identifiant ENT ou Centraliz.");
  const user = [...matches.values()][0];
  if (!user.ent_username) throw accountError("MCP_ENT_NOT_LINKED", "Ce compte Centraliz n’a pas de compte ENT lié. Connectez l’ENT dans Mails, puis relancez le MCP.");
  return { username: user.username, userKey: deriveUserKey(user.username) };
}

module.exports = { createAccountDirectory, resolveLocalPrincipal };
