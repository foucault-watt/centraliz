const supabase = require("./supabaseClient");

// The notes and settings endpoints also run against databases awaiting migration 022.
module.exports = async (columns, filter = (query) => query) => {
  const result = await filter(
    supabase.from("users").select(`${columns}, ent_password_storage`),
  );
  if (result.error?.code === "42703" &&
      result.error.message?.includes("ent_password_storage")) {
    return filter(supabase.from("users").select(columns));
  }
  return result;
};
