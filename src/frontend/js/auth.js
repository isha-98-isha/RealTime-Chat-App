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

    // Search profile verification matching
    const validUser = users.find(user => user.email === email && user.password === password);

    if (!validUser) {
        return alert("Invalid email address or incorrect password!");
    }

    // Establish persistent active browser token session
    localStorage.setItem('active_session_user', validUser.username);
    
    // Safely verify function exists in memory before execution
    if (typeof initChatApplication === "function") {
        initChatApplication(validUser.username);
    } else {
        console.error("Chat engine initialization function not found yet.");
    }
});

// --- Wait for everything to load completely before checking old sessions ---
window.addEventListener('load', () => {
    const sessionUser = localStorage.getItem('active_session_user');
    if (sessionUser && typeof initChatApplication === "function") {
        initChatApplication(sessionUser);
    }
});

// --- Log Out Event Handler Handling ---
document.getElementById('logout-btn').addEventListener('click', () => {
    localStorage.removeItem('active_session_user');
    window.location.reload(); 
});
