const supabase = require("../utils/supabaseClient");

// Pages connues de l'application (le front fournit libellé et icône).
const KNOWN_PAGE_IDS = [
  "notes",
  "links",
  "calendars",
  "communication",
  "cekilui",
  "pokemon",
  "bibli",
  "moodle",
  "le-musee",
];

const getBaseGroup = (group) => (group ? group.split("-")[0] : null);

const mapRow = (row) => ({
  id: row.id,
  isActive: row.is_active,
  promos: row.promos || [],
  displayOrder: row.display_order,
});

async function listAll() {
  const { data, error } = await supabase
    .from("nav_pages")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapRow);
}

// Pages actives visibles pour la promo donnée (liste de promos vide = tout le monde).
async function listForGroup(group) {
  const base = getBaseGroup(group);
  const rows = await listAll();
  return rows.filter(
    (row) =>
      row.isActive &&
      (row.promos.length === 0 || (base && row.promos.includes(base)))
  );
}

async function update(id, { isActive, promos, displayOrder }) {
  const patch = { updated_at: new Date().toISOString() };
  if (isActive !== undefined) patch.is_active = isActive;
  if (promos !== undefined) patch.promos = promos;
  if (displayOrder !== undefined) patch.display_order = displayOrder;

  // upsert : crée la ligne si une page connue n'a pas encore été seedée
  const { data, error } = await supabase
    .from("nav_pages")
    .upsert({ id, ...patch }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

async function listAvailablePromos() {
  const { data, error } = await supabase
    .from("users")
    .select("group")
    .not("group", "is", null);
  if (error) throw error;
  return [...new Set((data || []).map((u) => getBaseGroup(u.group)).filter(Boolean))].sort();
}

module.exports = { KNOWN_PAGE_IDS, listAll, listForGroup, update, listAvailablePromos };
