const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ---- Static files (index.html, client.js) ----
app.use(express.static(path.join(__dirname)));

// ---- SQLite setup ----
const db = new sqlite3.Database('./chat.db', (err) => {
  if (err) console.error('DB open error:', err);
  else console.log('SQLite connected');
});

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT NOT NULL,
      recipient TEXT,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

// ---- In-memory users map ----
/** usersById: { [socket.id]: { id: string, name: string } } */
const usersById = Object.create(null);

// Helper: broadcast current user list (names only)
function broadcastUserList() {
  const names = Object.values(usersById).map(u => u.name);
  io.emit('user list', names);
}

// ---- Socket.IO logic ----
io.on('connection', (socket) => {
  console.log('Connected:', socket.id);

  // Default username until user sets it
  usersById[socket.id] = { id: socket.id, name: `User-${socket.id.slice(0, 4)}` };
  socket.join(usersById[socket.id].name); // join a room named after current username
  broadcastUserList();

  // Send chat history
  db.all('SELECT sender, recipient, content, datetime(timestamp) AS timestamp FROM messages ORDER BY timestamp ASC', [], (err, rows) => {
    if (!err && rows) {
      socket.emit('load messages', rows);
    }
  });

  // Set or change username
  socket.on('set username', (newName) => {
    const name = String(newName || '').trim();
    if (!name) return;

    // Leave old room, join new room
    const oldName = usersById[socket.id].name;
    socket.leave(oldName);
    usersById[socket.id].name = name;
    socket.join(name);

    broadcastUserList();
  });

  // Incoming message (public or private)
  socket.on('chat message', ({ content, to }) => {
    const sender = usersById[socket.id]?.name || 'Anonymous';
    const recipient = (to || '').trim() || null;
    const safeContent = String(content || '').trim();
    if (!safeContent) return;

    // Persist to DB
    db.run(
      'INSERT INTO messages (sender, recipient, content) VALUES (?, ?, ?)',
      [sender, recipient, safeContent],
      (err) => {
        if (err) {
          console.error('DB insert error:', err);
          return;
        }

        const payload = {
          sender,
          recipient, // null for public, a username for private
          content: safeContent,
          // Let clients format time; DB has timestamp too
        };

        if (recipient) {
          // Private: deliver to recipient room + echo to sender
          socket.to(recipient).emit('new message', payload);
          socket.emit('new message', payload);
        } else {
          // Public: deliver to everyone
          io.emit('new message', payload);
        }
      }
    );
  });

  // Typing indicator (optional)
  socket.on('typing', () => {
    const sender = usersById[socket.id]?.name || 'Someone';
    socket.broadcast.emit('typing', sender);
  });

  // Disconnect
  socket.on('disconnect', () => {
    delete usersById[socket.id];
    broadcastUserList();
    console.log('Disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
