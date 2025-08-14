const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Database setup
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Connected to SQLite database.');
});

db.run(`CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender TEXT,
  recipient TEXT,
  message TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

app.use(express.static(path.join(__dirname)));

// Store connected users
let users = {};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  // Give user a default name
  users[socket.id] = { id: socket.id, name: `User-${socket.id.slice(0, 4)}` };

  io.emit('user list', Object.values(users));

  socket.on('chat message', ({ text, to }) => {
    const fromUser = users[socket.id];
    if (!fromUser) return;

    // Save message to DB
    db.run(
      `INSERT INTO messages (sender, recipient, message) VALUES (?, ?, ?)`,
      [fromUser.name, to || 'Everyone', text]
    );

    if (to) {
      // Private message
      socket.to(to).emit('chat message', { from: fromUser.name, text, private: true });
      socket.emit('chat message', { from: fromUser.name, text, private: true });
    } else {
      // Public message
      io.emit('chat message', { from: fromUser.name, text, private: false });
    }
  });

  socket.on('typing', () => {
    const fromUser = users[socket.id];
    if (fromUser) {
      socket.broadcast.emit('typing', fromUser.name);
    }
  });

  socket.on('disconnect', () => {
    delete users[socket.id];
    io.emit('user list', Object.values(users));
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
