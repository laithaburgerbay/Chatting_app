const socket = io();

// Replace with dynamic username or prompt
const username = prompt('Enter your username:');
socket.emit('register', username);

const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');
const messagesList = document.getElementById('messages');
const recipientSelect = document.getElementById('recipient-select');

function addMessage(data) {
  const li = document.createElement('li');
  li.textContent = `${data.sender}: ${data.content}`;
  if (data.recipient) li.classList.add('private');
  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;
}

// Load previous messages
socket.on('loadMessages', (messages) => {
  messages.forEach(addMessage);
});

// Update user list
socket.on('userList', (users) => {
  recipientSelect.innerHTML = '<option value="">Everyone</option>';
  users.forEach(u => {
    if (u !== username) recipientSelect.innerHTML += `<option value="${u}">${u}</option>`;
  });
});

// New incoming message
socket.on('newMessage', addMessage);

sendButton.addEventListener('click', () => {
  const content = messageInput.value.trim();
  if (!content) return;

  const recipient = recipientSelect.value || null;
  const data = { sender: username, recipient, content };
  socket.emit('chatMessage', data);
  messageInput.value = '';
});
