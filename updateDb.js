const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function updateDB() {
  const db = await open({ filename: 'chat.db', driver: sqlite3.Database });

  try {
    await db.exec(`
      ALTER TABLE messages ADD COLUMN recipient TEXT;
    `);
    console.log('✅ Database updated successfully!');
  } catch (e) {
    if (e.message.includes('duplicate column name')) {
      console.log('ℹ️ Column already exists, nothing to do.');
    } else {
      console.error('❌ Error updating database:', e);
    }
  }

  await db.close();
}

updateDB().catch(console.error);
