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

  // Create tables for normal + private messages
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_offset TEXT UNIQUE,
      content TEXT,
      sender TEXT,
      recipient TEXT
    );
  `);

  // Optional: clear old messages on startup
  await db.exec('DELETE FROM messages;');
  console.log('Cleared old messages');

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {}
  });

  const users = {}; // socket.id -> username

  io.on('connection', (socket) => {
    console.log('a user connected');

    // Set username
    socket.on('set username', (username) => {
      users[socket.id] = username;
      console.log(`User ${socket.id} set username to ${username}`);
    });

    // Handle normal + private messages
    socket.on('chat message', async (msg, clientOffset, recipient) => {
      const sender = users[socket.id] || 'Anonymous';
      try {
        await db.run(
          'INSERT INTO messages (content, client_offset, sender, recipient) VALUES (?, ?, ?, ?)',
          msg,
          clientOffset,
          sender,
          recipient
        );
      } catch (e) {
        if (e.errno === 19) return; // duplicate
        console.error('DB error:', e);
        return;
      }

      if (recipient) {
        // Send only to recipient and sender
        for (let id in users) {
          if (users[id] === recipient || id === socket.id) {
            io.to(id).emit('chat message', msg, null, sender, recipient);
          }
        }
      } else {
        io.emit('chat message', msg, null, sender, null);
      }
    });

    // Typing indicators
    socket.on('typing', (user) => {
      socket.broadcast.emit('display typing', user);
    });

    socket.on('stop typing', (user) => {
      socket.broadcast.emit('hide typing');
    });

    socket.on('disconnect', () => {
      console.log('a user disconnected');
      delete users[socket.id];
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
