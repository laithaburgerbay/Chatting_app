const socket = io();

const messagesList = document.getElementById('messages');
const typingDiv = document.getElementById('typing');
const recipientSelect = document.getElementById('recipient-select');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const usernameInput = document.getElementById('username-input');
const setUsernameBtn = document.getElementById('set-username');

// Render helpers
function renderMessage({ sender, recipient, content }) {
  const li = document.createElement('li');
  const isPrivate = !!recipient;
  li.className = isPrivate ? 'private' : '';
  li.textContent = isPrivate
    ? `(Private) ${sender} → ${recipient}: ${content}`
    : `${sender}: ${content}`;
  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;
}

function setUsersDropdown(names) {
  const current = recipientSelect.value;
  recipientSelect.innerHTML = '<option value="">Everyone</option>';
  names.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    recipientSelect.appendChild(opt);
  });
  // Try to keep the previously selected recipient if still present
  const match = Array.from(recipientSelect.options).find(o => o.value === current);
  if (match) recipientSelect.value = current;
}

// Username handling
setUsernameBtn.addEventListener('click', () => {
  const name = (usernameInput.value || '').trim();
  if (!name) return;
  socket.emit('set username', name);
});

// Send a message
sendButton.addEventListener('click', () => {
  const content = (messageInput.value || '').trim();
  if (!content) return;
  const to = recipientSelect.value || '';
  socket.emit('chat message', { content, to });
  messageInput.value = '';
  messageInput.focus();
});

// Send typing signal
messageInput.addEventListener('input', () => {
  socket.emit('typing');
});

// Load past messages
socket.on('load messages', (messages) => {
  messagesList.innerHTML = '';
  messages.forEach(renderMessage);
});

// New incoming message
socket.on('new message', renderMessage);

// Update user list
socket.on('user list', (names) => {
  setUsersDropdown(names);
});

// Typing indicator
socket.on('typing', (name) => {
  typingDiv.textContent = `${name} is typing…`;
  clearTimeout(window.__typingTimer);
  window.__typingTimer = setTimeout(() => {
    typingDiv.textContent = '';
  }, 1000);
});
