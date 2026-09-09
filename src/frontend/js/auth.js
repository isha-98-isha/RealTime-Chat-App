// --- Navigation Switches ---
document.getElementById('to-login').addEventListener('click', () => {
    document.getElementById('signup-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
});

document.getElementById('to-signup').addEventListener('click', () => {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('signup-screen').classList.remove('hidden');
});

// --- Handle User Registration (Signup) ---
document.getElementById('signup-form').addEventListener('submit', (e) => {
    e.preventDefault();
    
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim().toLowerCase();
    const password = document.getElementById('signup-password').value;

    const users = JSON.parse(localStorage.getItem('registered_users')) || [];

    const emailExists = users.some(user => user.email === email);
    if (emailExists) {
        return alert("Error: This email address is already registered!");
    }

    const usernameExists = users.some(user => user.username === username);
    if (usernameExists) {
        return alert("Error: Username is already taken!");
    }

    users.push({ username, email, password });
    localStorage.setItem('registered_users', JSON.stringify(users));

    alert("Registration successful! Please log in.");
    document.getElementById('signup-screen').classList.add('hidden');
    document.getElementById('login-screen').classList.remove('hidden');
});

// --- Handle User Login Verification ---
document.getElementById('login-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    const users = JSON.parse(localStorage.getItem('registered_users')) || [];

    const validUser = users.find(user => user.email === email && user.password === password);

    if (!validUser) {
        return alert("Invalid email address or incorrect password!");
    }

    localStorage.setItem('active_session_user', validUser.username);
    
    if (typeof initChatApplication === "function") {
        initChatApplication(validUser.username);
    } else {
        console.error("Chat engine initialization function not found yet.");
    }
});

// --- FIXED: Updated target to listen to the bottom profile footer button click ---
document.getElementById('open-profile-btn').addEventListener('click', () => {
    const activeUsername = localStorage.getItem('active_session_user') || window.myUsername;
    const users = JSON.parse(localStorage.getItem('registered_users')) || [];
    
    const accountData = users.find(u => u.username === activeUsername)
        || users.find(u => u.username.toLowerCase() === activeUsername?.toLowerCase());

    if (!accountData) return;

    document.getElementById('profile-username-text').textContent = `@${accountData.username}`;
    document.getElementById('profile-email-text').textContent = accountData.email;

    // Highlight the user's previously saved theme inside the picker
    const savedTheme = localStorage.getItem('custom_chat_theme') || 'slate';
    highlightSelectedPalette(savedTheme);

    document.getElementById('profile-modal').classList.remove('hidden');
});

document.getElementById('close-profile-btn').addEventListener('click', () => {
    document.getElementById('profile-modal').classList.add('hidden');
});

// --- NEW: Theme Palette Selection Click Handlers ---
document.querySelectorAll('.palette-dot').forEach(dot => {
    dot.addEventListener('click', (e) => {
        const targetTheme = e.target.getAttribute('data-theme');
        
        // Apply theme to body HTML node
        document.body.setAttribute('data-theme', targetTheme);
        // Persist theme to localStorage
        localStorage.setItem('custom_chat_theme', targetTheme);
        
        highlightSelectedPalette(targetTheme);
    });
});

function highlightSelectedPalette(themeName) {
    document.querySelectorAll('.palette-dot').forEach(dot => {
        dot.classList.toggle('active-palette', dot.getAttribute('data-theme') === themeName);
    });
}

// --- Initialize saved user data and themes on load ---
window.addEventListener('load', () => {
    // 1. Restore Custom Palette Theme
    const savedTheme = localStorage.getItem('custom_chat_theme') || 'slate';
    document.body.setAttribute('data-theme', savedTheme);

    // 2. Check Session
    const sessionUser = localStorage.getItem('active_session_user');
    if (sessionUser && typeof initChatApplication === "function") {
        initChatApplication(sessionUser);
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('active_session_user');
    window.location.reload(); 
});