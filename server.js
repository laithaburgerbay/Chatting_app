const express = require('express');
const { createServer } = require('node:http');
const { join } = require('node:path');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

async function main() {
  const db = await open({
    filename: 'chat.db',
    driver: sqlite3.Database
  });

  // Create table with username
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      username TEXT,
      content TEXT
    );
  `);

  // Clear previous messages
  await db.exec('DELETE FROM messages;');
  console.log('Cleared old messages');

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {}
  });

  io.on('connection', async (socket) => {
    console.log('a user connected');

    // Send all previous messages to the newly connected user
    const rows = await db.all('SELECT * FROM messages ORDER BY id ASC');
    socket.emit('previous messages', rows);

    socket.on('disconnect', () => {
      console.log('a user disconnected');
    });

    // Handle chat messages with username
    socket.on('chat message', async (msg, clientOffset, username, callback) => {
      let result;
      try {
        result = await db.run(
          'INSERT INTO messages (content, client_offset, username) VALUES (?, ?, ?)',
          msg,
          clientOffset,
          username
        );
      } catch (e) {
        if (e.errno === 19) {
          callback?.();
          return;
        }
        console.error('DB error:', e);
        return;
      }

      // Emit message with username
      io.emit('chat message', msg, result.lastID, username);
      callback?.();
    });

    // Typing indicator
    socket.on('typing', (username) => {
      socket.broadcast.emit('typing', username);
    });

    socket.on('stop typing', (username) => {
      socket.broadcast.emit('stop typing', username);
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

main().catch(console.error);
