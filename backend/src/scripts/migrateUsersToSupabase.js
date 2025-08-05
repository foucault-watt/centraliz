const supabase = require('../utils/supabaseClient');
const fs = require('fs');
const path = require('path');

const USER_DATA_FILE = path.join(__dirname, '../data/users.json');

async function migrateUsers() {
  const users = JSON.parse(fs.readFileSync(USER_DATA_FILE, 'utf-8'));
  const userArray = Object.values(users).map(user => ({
    username: user.userName,
    display_name: user.displayName,
    ical_link: user.icalLink,
    birth_date: user.birthDate,
    group: user.group,
    notes_count: user.notesCount
  }));

  const { data, error } = await supabase
    .from('users')
    .upsert(userArray, { onConflict: 'username' });

  if (error) {
    console.error('Error migrating users:', error);
  } else {
    console.log('Users migrated successfully:', data);
  }
}

migrateUsers().then(() => process.exit(0));
