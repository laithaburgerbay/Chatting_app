const socket = io();

// DOM elements
const messages = document.getElementById('messages');
const typingDiv = document.getElementById('typing');
const recipientSelect = document.getElementById('recipient-select');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

// Append message to chat
function appendMessage(text, isPrivate = false) {
  const li = document.createElement('li');
  li.textContent = text;
  if (isPrivate) li.classList.add('private');
  messages.appendChild(li);
  messages.scrollTop = messages.scrollHeight;
}

// Send message
sendButton.addEventListener('click', () => {
  const msg = messageInput.value.trim();
  const recipient = recipientSelect.value;
  if (msg) {
    socket.emit('chat message', { text: msg, to: recipient });
    messageInput.value = '';
  }
});

messageInput.addEventListener('keypress', () => {
  socket.emit('typing');
});

// Receive chat message
socket.on('chat message', ({ from, text, private }) => {
  appendMessage(private ? `(Private) ${from}: ${text}` : `${from}: ${text}`, private);
});

// Update typing indicator
socket.on('typing', (name) => {
  typingDiv.textContent = `${name} is typing...`;
  setTimeout(() => typingDiv.textContent = '', 1000);
});

// Populate user list
socket.on('user list', (users) => {
  recipientSelect.innerHTML = '<option value="">Everyone</option>';
  users.forEach((user) => {
    const option = document.createElement('option');
    option.value = user.id;
    option.textContent = user.name;
    recipientSelect.appendChild(option);
  });
});
