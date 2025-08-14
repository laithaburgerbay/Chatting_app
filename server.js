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

  const app = express();
  const server = createServer(app);
  const io = new Server(server, {
    connectionStateRecovery: {}
  });

  // Keep track of usernames and their sockets
  const users = new Map(); // username => socket.id

  io.on('connection', (socket) => {
    console.log('A user connected');

    // Listen for a username assignment
    socket.on('set username', (username) => {
      users.set(username, socket.id);
      socket.username = username;
      console.log(`User set username: ${username}`);
    });

    socket.on('disconnect', () => {
      if (socket.username) {
        users.delete(socket.username);
      }
      console.log('A user disconnected');
    });

    socket.on('chat message', async (msg, recipient, clientOffset, callback) => {
      let result;
      try {
        result = await db.run(
          'INSERT INTO messages (content, client_offset, recipient) VALUES (?, ?, ?)',
          msg,
          clientOffset,
          recipient || null
        );
      } catch (e) {
        if (e.errno === 19) {
          callback?.();
          return;
        }
        console.error('DB error:', e);
        return;
      }

      if (recipient && users.has(recipient)) {
        // Private message: emit only to the recipient and sender
        const recipientSocketId = users.get(recipient);
        io.to(recipientSocketId).emit('chat message', msg, result.lastID, socket.username);
        socket.emit('chat message', msg, result.lastID, socket.username);
      } else {
        // Public message: emit to everyone
        io.emit('chat message', msg, result.lastID, socket.username);
      }

      callback?.();
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
