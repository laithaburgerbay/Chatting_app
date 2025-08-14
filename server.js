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

  // Create table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      recipient TEXT,
      content TEXT
    );
  `);

  const app = express();
  const server = createServer(app);
  const io = new Server(server);

  // Track connected users
  const users = new Map();

  io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Assign a random username
    const username = `User${Math.floor(Math.random() * 1000)}`;
    users.set(socket.id, username);

    // Update all clients with current users
    io.emit('update users', Array.from(users.values()));

    // Send past messages
    db.all('SELECT * FROM messages').then((rows) => {
      rows.forEach((row) => {
        socket.emit('chat message', row.sender, row.recipient, row.content);
      });
    });

    // Handle incoming messages
    socket.on('chat message', async (msg, recipient) => {
      const sender = users.get(socket.id) || 'Unknown';

      // Save to DB
      await db.run(
        'INSERT INTO messages (sender, recipient, content) VALUES (?, ?, ?)',
        sender,
        recipient || '',
        msg
      );

      if (recipient) {
        // Private message
        const targetSocketId = Array.from(users.entries())
          .find(([id, name]) => name === recipient)?.[0];
        if (targetSocketId) {
          io.to(targetSocketId).emit('chat message', sender, recipient, msg);
          socket.emit('chat message', sender, recipient, msg);
        }
      } else {
        // Broadcast to everyone
        io.emit('chat message', sender, '', msg);
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      users.delete(socket.id);
      io.emit('update users', Array.from(users.values()));
    });
  });

  app.get('/', (req, res) => {
    res.sendFile(join(__dirname, 'index.html'));
  });

  app.use(express.static(__dirname));

  const port = process.env.PORT || 3000;
  server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
  });
}

main().catch(console.error);
