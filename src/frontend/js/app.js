const socket = io({ 
    autoConnect: false,
    reconnection: true,             // Enable auto recovery reconnection
    reconnectionAttempts: Infinity, // Keep trying to reconnect if connection drops
    reconnectionDelay: 1000 
}); 

const loginScreen = document.getElementById('login-screen');
const appContainer = document.getElementById('app-container');
const userList = document.getElementById('user-list');
const activeChatTarget = document.getElementById('active-chat-target');
const messagesDisplay = document.getElementById('messages-display');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const currentUserBadge = document.getElementById('current-user-badge');

let myUsername = "";
let currentChatTarget = null;
const chatHistories = JSON.parse(localStorage.getItem('chat_histories')) || {};

function initChatApplication(username) {
    myUsername = username;
    currentUserBadge.textContent = `@${myUsername}`;
    
    // Connect to server
    socket.connect();

    document.getElementById('signup-screen').classList.add('hidden');
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');
}

// --- NEW: Automatically re-register whenever socket establishes or re-establishes a connection ---
socket.on('connect', () => {
    if (myUsername) {
        socket.emit('register_user', myUsername);
    }
});

// --- Real-Time Sidebar Updates ---
socket.on('update_user_list', (users) => {
    userList.innerHTML = ""; 
    const otherUsers = users.filter(user => user !== myUsername);

    if (otherUsers.length === 0) {
        userList.innerHTML = `<li class="no-users">No one else is online</li>`;
        return;
    }

    otherUsers.forEach(username => {
        const li = document.createElement('li');
        li.textContent = username;
        if (username === currentChatTarget) li.classList.add('active-user');
        
        li.addEventListener('click', () => {
            switchActiveChat(username);
        });
        userList.appendChild(li);
    });
});

// --- Switching Chat Windows ---
function switchActiveChat(targetUser) {
    currentChatTarget = targetUser;
    activeChatTarget.textContent = `Chatting with: ${targetUser}`;
    
    messageInput.disabled = false;
    sendBtn.disabled = false;

    document.querySelectorAll('#user-list li').forEach(li => {
        li.classList.toggle('active-user', li.textContent === targetUser);
    });

    renderMessages();
}

// --- Sending a Private Message ---
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message || !currentChatTarget) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!chatHistories[currentChatTarget]) chatHistories[currentChatTarget] = [];
    chatHistories[currentChatTarget].push({ sender: myUsername, message, timestamp });

    localStorage.setItem('chat_histories', JSON.stringify(chatHistories));

    socket.emit('private_message', {
        targetUsername: currentChatTarget,
        message: message
    });

    renderMessages();
    messageInput.value = ""; 
});

// --- Receiving a Private Message ---
socket.on('receive_message', (payload) => {
    const { sender, message, timestamp } = payload;

    if (!chatHistories[sender]) chatHistories[sender] = [];
    chatHistories[sender].push({ sender, message, timestamp });

    localStorage.setItem('chat_histories', JSON.stringify(chatHistories));

    if (sender === currentChatTarget) {
        renderMessages();
    } else {
        alert(`New message from ${sender}!`);
    }
});

// --- Render Text Bubbles ---
function renderMessages() {
    messagesDisplay.innerHTML = "";
    if (!currentChatTarget || !chatHistories[currentChatTarget]) return;

    chatHistories[currentChatTarget].forEach(chat => {
        const bubble = document.createElement('div');
        const isMe = chat.sender === myUsername;
        bubble.className = `msg-bubble ${isMe ? 'msg-sent' : 'msg-received'}`;

        bubble.innerHTML = `
            <div class="msg-text">${chat.message}</div>
            <div class="msg-time">${chat.timestamp}</div>
        `;
        messagesDisplay.appendChild(bubble);
    });

    messagesDisplay.scrollTop = messagesDisplay.scrollHeight;
}
