const socket = io();
const messages = document.getElementById('messages');
const input = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const typing = document.getElementById('typing');
const recipientSelect = document.getElementById('recipient-select');

let username = prompt("Enter your username:");
if (!username) username = "Guest";

// Users list
let users = [username];
recipientSelect.innerHTML = `<option value="">Everyone</option><option value="${username}">${username}</option>`;

// Send message
function sendMessage() {
  const msg = input.value.trim();
  if (!msg) return;
  const recipient = recipientSelect.value;
  socket.emit('chat message', msg, username, recipient, () => {
    input.value = '';
  });
}

sendButton.addEventListener('click', sendMessage);
input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
  else socket.emit('typing', username);
});

// Listen for messages
socket.on('chat message', (msg, sender, recipient) => {
  if (!recipient || recipient === username || sender === username) {
    const li = document.createElement('li');
    li.textContent = recipient ? `(Private) ${sender}: ${msg}` : `${sender}: ${msg}`;
    if (recipient) li.classList.add('private');
    messages.appendChild(li);
    messages.scrollTop = messages.scrollHeight;
  }
});

// Typing indicator
socket.on('typing', (user) => {
  typing.textContent = `${user} is typing...`;
  setTimeout(() => { typing.textContent = ''; }, 1000);
});

// Update user list
socket.on('update users', (currentUsers) => {
  users = currentUsers;
  recipientSelect.innerHTML = `<option value="">Everyone</option>`;
  users.forEach(user => {
    recipientSelect.innerHTML += `<option value="${user}">${user}</option>`;
  });
});

// Notify server of new user
socket.emit('new user', username);
