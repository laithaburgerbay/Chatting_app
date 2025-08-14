const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-button');
const recipientSelect = document.getElementById('recipient-select');

// Send message
sendBtn.addEventListener('click', () => {
  const msg = inputEl.value.trim();
  const recipient = recipientSelect.value;
  if (!msg) return;

  socket.emit('chat message', msg, recipient);
  inputEl.value = '';
});

// Receive messages
socket.on('chat message', (sender, recipient, msg) => {
  const li = document.createElement('li');
  li.textContent = `${sender}: ${msg}`;
  if (recipient) li.classList.add('private');
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
});

// Update recipient dropdown
socket.on('update users', (users) => {
  recipientSelect.innerHTML = '<option value="">Everyone</option>';
  users.forEach((user) => {
    recipientSelect.innerHTML += `<option value="${user}">${user}</option>`;
  });
});
