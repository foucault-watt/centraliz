const supabase = require('../utils/supabaseClient');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/books.csv');

function parseCSV(content) {
  const rows = [];
  let cur = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') { cur += '"'; i++; continue; }
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) { row.push(cur); cur = ''; continue; }
    if ((ch === '\n' || ch === '\r') && !inQuotes) {
      // end of row
      row.push(cur);
      rows.push(row);
      row = [];
      cur = '';
      if (ch === '\r' && content[i + 1] === '\n') i++;
      continue;
    }
    cur += ch;
  }
  if (cur !== '' || row.length > 0) { row.push(cur); rows.push(row); }
  return rows;
}

function normalize(s) { if (s == null) return null; const t = String(s).trim(); return t === '' ? null : t; }

async function migrateBooks() {
  if (!fs.existsSync(DATA_FILE)) { console.error('CSV introuvable:', DATA_FILE); process.exit(1); }
  const content = fs.readFileSync(DATA_FILE, 'utf-8');
  const parsed = parseCSV(content);
  if (parsed.length === 0) { console.error('CSV vide'); process.exit(1); }
  const headers = parsed[0].map(h => h.trim().toLowerCase());
  const rows = parsed.slice(1);

  const booksMap = new Map();
  for (const r of rows) {
    if (r.length === 1 && r[0].trim() === '') continue;
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = r[i] !== undefined ? r[i] : '';
    }
    const title = normalize(obj['titre'] || obj['title']);
    if (!title) continue;
    const author = normalize(obj['auteur'] || obj['author']) || null;
    const type = normalize(obj['type']) || null;
    const genre = normalize(obj['genre']) || null;
    const year = normalize(obj['annee'] || obj['year']) || null;
    const series = normalize(obj['serie'] || obj['series']) || null;

    const key = `${(title || '').toLowerCase()}|${(author || '').toLowerCase()}`;
    if (booksMap.has(key)) continue;
    booksMap.set(key, { title, author, type, genre, year, series });
  }

  const bookArray = Array.from(booksMap.values());
  if (bookArray.length === 0) { console.log('Aucun livre à migrer'); process.exit(0); }

  console.log(`Migration de ${bookArray.length} livres vers Supabase...`);
  const { data, error } = await supabase
    .from('books')
    .insert(bookArray);

  if (error) {
    console.error('Erreur lors de la migration :', error);
  } else {
    console.log('Migration terminée. Enregistrements insérés:', data?.length ?? 'unknown');
  }
}

migrateBooks().then(() => process.exit(0)).catch(err => { console.error('Erreur inattendue', err); process.exit(1); });