const crypto = require("crypto");
const fs = require("fs").promises;
const path = require("path");
const supabase = require("../utils/supabaseClient");

const ICON_DIR = path.join(__dirname, "../data/theme-palette-icons");

const generateIconFileName = (extension) => {
  const timestamp = Date.now();
  const randomBytes = crypto.randomBytes(16).toString("hex");
  return `${timestamp}_${randomBytes}.${extension}`;
};

const mapEntry = (row) => ({
  id: row.id,
  name: row.name,
  colorPrimary: row.color_primary,
  colorPrimaryDark: row.color_primary_dark,
  iconUrl: row.icon_filename
    ? `/api/theme-palette/icon/${row.icon_filename}`
    : null,
  displayOrder: row.display_order,
  isActive: row.is_active,
});

async function listActive() {
  const { data, error } = await supabase
    .from("theme_palette_associations")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapEntry);
}

async function listAll() {
  const { data, error } = await supabase
    .from("theme_palette_associations")
    .select("*")
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data || []).map(mapEntry);
}

async function getById(id) {
  const { data, error } = await supabase
    .from("theme_palette_associations")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data;
}

async function getPublicById(id) {
  const row = await getById(id);
  return row ? mapEntry(row) : null;
}

async function create({
  name,
  colorPrimary,
  colorPrimaryDark,
  displayOrder,
  isActive,
}) {
  const { data, error } = await supabase
    .from("theme_palette_associations")
    .insert({
      name,
      color_primary: colorPrimary,
      color_primary_dark: colorPrimaryDark || null,
      display_order: displayOrder ?? 0,
      is_active: isActive ?? true,
    })
    .select()
    .single();
  if (error) throw error;
  return mapEntry(data);
}

async function update(
  id,
  { name, colorPrimary, colorPrimaryDark, displayOrder, isActive }
) {
  const patch = { updated_at: new Date().toISOString() };
  if (name !== undefined) patch.name = name;
  if (colorPrimary !== undefined) patch.color_primary = colorPrimary;
  if (colorPrimaryDark !== undefined)
    patch.color_primary_dark = colorPrimaryDark || null;
  if (displayOrder !== undefined) patch.display_order = displayOrder;
  if (isActive !== undefined) patch.is_active = isActive;

  const { data, error } = await supabase
    .from("theme_palette_associations")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapEntry(data);
}

async function setIcon(id, iconFilename) {
  const { data, error } = await supabase
    .from("theme_palette_associations")
    .update({
      icon_filename: iconFilename,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return mapEntry(data);
}

async function remove(id) {
  const existing = await getById(id);
  if (existing && existing.icon_filename) {
    await deleteIconFile(existing.icon_filename);
  }
  const { error } = await supabase
    .from("theme_palette_associations")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

async function saveIconFile(buffer, extension) {
  await fs.mkdir(ICON_DIR, { recursive: true });
  const fileName = generateIconFileName(extension);
  await fs.writeFile(path.join(ICON_DIR, fileName), buffer);
  return fileName;
}

async function deleteIconFile(fileName) {
  try {
    await fs.unlink(path.join(ICON_DIR, fileName));
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  ICON_DIR,
  listActive,
  listAll,
  getById,
  getPublicById,
  create,
  update,
  setIcon,
  remove,
  saveIconFile,
  deleteIconFile,
};
