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
let typingTimeout = null;
let typingTarget = null;
const TYPING_IDLE_DELAY_MS = 5000;

// Conversation data belongs to the signed-in account, not just the chat partner.
// The old storage key was shared by every account in this browser profile.
const CHAT_HISTORY_STORAGE_KEY = 'chat_histories_by_owner_v2';
const UNREAD_COUNT_STORAGE_KEY = 'unread_counts_by_owner_v2';
let chatHistories = {};
let unreadCounts = {};
let cachedOnlineUsers = []; // NEW: Cache online users locally to repaint badges correctly

function readStoredObject(key) {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
        return {};
    }
}

function loadAccountChatData(username) {
    const allHistories = readStoredObject(CHAT_HISTORY_STORAGE_KEY);
    const allUnreadCounts = readStoredObject(UNREAD_COUNT_STORAGE_KEY);

    chatHistories = allHistories[username] && typeof allHistories[username] === 'object'
        ? allHistories[username]
        : {};
    unreadCounts = allUnreadCounts[username] && typeof allUnreadCounts[username] === 'object'
        ? allUnreadCounts[username]
        : {};
}

function saveChatHistories() {
    const allHistories = readStoredObject(CHAT_HISTORY_STORAGE_KEY);
    allHistories[myUsername] = chatHistories;
    localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(allHistories));
}

function saveUnreadCounts() {
    const allUnreadCounts = readStoredObject(UNREAD_COUNT_STORAGE_KEY);
    allUnreadCounts[myUsername] = unreadCounts;
    localStorage.setItem(UNREAD_COUNT_STORAGE_KEY, JSON.stringify(allUnreadCounts));
}

function initChatApplication(username) {
    myUsername = username;
    loadAccountChatData(myUsername);
    currentUserBadge.textContent = `@${myUsername}`;
    
    // Connect to server
    socket.connect();

    document.getElementById('signup-screen').classList.add('hidden');
    loginScreen.classList.add('hidden');
    appContainer.classList.remove('hidden');

    // Create typing indicator element container if it doesn't exist yet
    if (!document.getElementById('typing-indicator-bar')) {
        const indicator = document.createElement('div');
        indicator.id = 'typing-indicator-bar';
        indicator.className = 'typing-indicator hidden';
        activeChatTarget.parentNode.appendChild(indicator);
    }
}

// --- Automatically re-register whenever socket establishes a connection ---
socket.on('connect', () => {
    if (myUsername) {
        socket.emit('register_user', myUsername);
    }
});

// --- Real-Time Sidebar Updates ---
socket.on('update_user_list', (users) => {
    cachedOnlineUsers = users; // Update active user cache

    // An offline user cannot still be typing. This also clears a stale indicator
    // if their browser closes before its final typing event reaches us.
    if (currentChatTarget && !cachedOnlineUsers.includes(currentChatTarget)) {
        hideTypingIndicator();
    }

    renderUserList();
});

// NEW: Separated layout rendering function to clean up and inject unread notification badges
function renderUserList() {
    userList.innerHTML = ""; 
    const otherUsers = cachedOnlineUsers.filter(user => user !== myUsername);

    if (otherUsers.length === 0) {
        userList.innerHTML = `<li class="no-users">No one else is online</li>`;
        return;
    }

    otherUsers.forEach(username => {
        const li = document.createElement('li');
        li.className = 'user-item-row';
        if (username === currentChatTarget) li.classList.add('active-user');
        
        // Create user text name block nodes
        const nameSpan = document.createElement('span');
        nameSpan.textContent = username;
        li.appendChild(nameSpan);

        // Inject dynamic numeric badge element if there are unread messages from this user
        const unreadCount = unreadCounts[username] || 0;
        if (unreadCount > 0 && username !== currentChatTarget) {
            const badge = document.createElement('span');
            badge.className = 'unread-count-badge';
            badge.textContent = unreadCount;
            li.appendChild(badge);
        }
        
        li.addEventListener('click', () => {
    unreadCounts[username] = 0; 
    
    // NEW: Save the cleared state to localStorage so it stays 0 after refreshing
    saveUnreadCounts();
    
    switchActiveChat(username);
    renderUserList(); 
});

        userList.appendChild(li);
    });
}

// --- Switching Chat Windows ---
function switchActiveChat(targetUser) {
    stopTyping();
    currentChatTarget = targetUser;
    activeChatTarget.textContent = `Chatting with: ${targetUser}`;
    
    // Clear display status values cleanly
    const indicator = document.getElementById('typing-indicator-bar');
    if (indicator) indicator.classList.add('hidden');

    // Typing events are transient. Ask the server for the current state in case
    // this chat was opened after the other user started typing.
    socket.emit('typing_status_request', { targetUsername: targetUser });

    messageInput.disabled = false;
    sendBtn.disabled = false;

    document.querySelectorAll('#user-list li').forEach(li => {
        // Toggle formatting matching row selections correctly
        const rowName = li.querySelector('span') ? li.querySelector('span').textContent : li.textContent;
        li.classList.toggle('active-user', rowName === targetUser);
    });

    renderMessages();
}

function stopTyping(targetUsername = typingTarget) {
    clearTimeout(typingTimeout);
    typingTimeout = null;

    if (targetUsername) {
        socket.emit('user_typing', { targetUsername, isTyping: false });
    }

    if (!targetUsername || targetUsername === typingTarget) {
        typingTarget = null;
    }
}

function hideTypingIndicator() {
    document.getElementById('typing-indicator-bar')?.classList.add('hidden');
}

// --- Typing Event Input Listeners ---
messageInput.addEventListener('input', () => {
    if (!currentChatTarget) return;

    if (!messageInput.value.trim()) {
        stopTyping();
        return;
    }

    if (typingTarget && typingTarget !== currentChatTarget) {
        stopTyping();
    }
    typingTarget = currentChatTarget;

    // Send a real-time keystroke signal to backend
    socket.emit('user_typing', { targetUsername: typingTarget, isTyping: true });

    // If the user remains silent for five seconds, notify the recipient that typing stopped.
    clearTimeout(typingTimeout);
    const targetAtInput = typingTarget;
    typingTimeout = setTimeout(() => {
        if (typingTarget === targetAtInput) {
            stopTyping(targetAtInput);
        }
    }, TYPING_IDLE_DELAY_MS);
});

// NEW: Handle incoming typing status broadcasts from active chat partner
socket.on('user_typing_broadcast', (payload) => {
    const { sender, isTyping } = payload;
    const indicator = document.getElementById('typing-indicator-bar');
    
    if (indicator && sender === currentChatTarget) {
        if (isTyping) {
            indicator.textContent = `${sender} is typing...`;
            indicator.classList.remove('hidden');
        } else {
            hideTypingIndicator();
        }
    }
});

// --- Sending a Private Message ---
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = messageInput.value.trim();
    if (!message || !currentChatTarget) return;

    // Instantly notify the recipient that typing has ended.
    stopTyping();

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (!chatHistories[currentChatTarget]) chatHistories[currentChatTarget] = [];
    chatHistories[currentChatTarget].push({ sender: myUsername, message, timestamp });

    saveChatHistories();

    socket.emit('private_message', {
        targetUsername: currentChatTarget,
        message: message
    });

    renderMessages();
    messageInput.value = ""; 
});

// Locate this block in your app.js and add the new localStorage line:
socket.on('receive_message', (payload) => {
    const { sender, message, timestamp } = payload;

    if (!chatHistories[sender]) chatHistories[sender] = [];
    chatHistories[sender].push({ sender, message, timestamp });

    saveChatHistories();

    if (sender === currentChatTarget) {
        // A delivered message is also definitive evidence that typing ended.
        hideTypingIndicator();
        renderMessages();
    } else {
        // Increment notification counts if you are looking elsewhere
        unreadCounts[sender] = (unreadCounts[sender] || 0) + 1;
        
        // NEW: Save the updated unread badge counts to localStorage
        saveUnreadCounts();
        
        renderUserList(); 
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
