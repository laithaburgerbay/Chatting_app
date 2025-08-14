const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files
app.use(express.static(path.join(__dirname, '/')));

// PostgreSQL setup (replace with your Render credentials)
const pool = new Pool({
  user: 'your_db_user',
  host: 'your_db_host',
  database: 'your_db_name',
  password: 'your_db_password',
  port: 5432,
});

// Create messages table if it doesn't exist
pool.query(`
CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender TEXT NOT NULL,
    recipient TEXT,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
`).catch(err => console.error(err));

io.on('connection', (socket) => {
  console.log('A user connected');

  // Send existing messages to new user
  pool.query('SELECT * FROM messages ORDER BY timestamp ASC')
    .then(res => socket.emit('loadMessages', res.rows))
    .catch(err => console.error(err));

  socket.on('chatMessage', async (data) => {
    const { sender, recipient, content } = data;
    try {
      // Insert message into DB
      await pool.query(
        'INSERT INTO messages (sender, recipient, content) VALUES ($1, $2, $3)',
        [sender, recipient || null, content]
      );

      // Broadcast message
      if (recipient) {
        // Private message to recipient only
        socket.to(recipient).emit('newMessage', data);
        socket.emit('newMessage', data); // Also show to sender
      } else {
        io.emit('newMessage', data); // Public message
      }
    } catch (err) {
      console.error('DB error:', err);
    }
  });

  socket.on('register', (username) => {
    socket.username = username;
    socket.join(username); // Join room for private messages
    io.emit('userList', Array.from(io.sockets.sockets.values()).map(s => s.username).filter(Boolean));
  });

  socket.on('disconnect', () => {
    io.emit('userList', Array.from(io.sockets.sockets.values()).map(s => s.username).filter(Boolean));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
