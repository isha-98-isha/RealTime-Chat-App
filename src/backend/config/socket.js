import { Server } from 'socket.io';

const onlineUsers = new Map(); 

export const initSocket = (server) => {
    const io = new Server(server, {
        cors: {
            origin: "*", 
            methods: ["GET", "POST"]
        }
    });

    io.on('connection', (socket) => {
        socket.typingTargets = new Set();
        console.log(`🔌 New connection: ${socket.id}`);

        socket.on('register_user', (username) => {
            if (!username) return;
            
            // Map username to the current active connection ID
            onlineUsers.set(username, socket.id);
            socket.username = username; 

            console.log(`👤 Active User list updated: ${username}`);
            io.emit('update_user_list', Array.from(onlineUsers.keys()));
        });

        socket.on('private_message', (payload) => {
            const { targetUsername, message } = payload;
            const targetSocketId = onlineUsers.get(targetUsername);

            if (targetSocketId) {
                io.to(targetSocketId).emit('receive_message', {
                    sender: socket.username,
                    message: message,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                });
            }
        });

        // Ensure this event listener is inside your backend socket.js file:
            socket.on('user_typing', (payload) => {
                const { targetUsername, isTyping } = payload;
                const targetSocketId = onlineUsers.get(targetUsername);

                if (isTyping) {
                    socket.typingTargets.add(targetUsername);
                } else {
                    socket.typingTargets.delete(targetUsername);
                }

                if (targetSocketId) {
                    io.to(targetSocketId).emit('user_typing_broadcast', {
                        sender: socket.username,
                        isTyping: isTyping
                    });
                }
            });

        // Let a newly opened or reconnected chat restore a currently active
        // typing state instead of waiting for the next keypress.
        socket.on('typing_status_request', (payload) => {
            const targetUsername = payload?.targetUsername;
            const targetSocketId = onlineUsers.get(targetUsername);
            const targetSocket = targetSocketId && io.sockets.sockets.get(targetSocketId);

            if (targetSocket?.typingTargets.has(socket.username)) {
                socket.emit('user_typing_broadcast', {
                    sender: targetUsername,
                    isTyping: true
                });
            }
        });

        socket.on('disconnect', () => {
            // A disconnected user cannot still be typing. Clear all recipients'
            // indicators before removing this user from the online roster.
            socket.typingTargets.forEach((targetUsername) => {
                const targetSocketId = onlineUsers.get(targetUsername);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('user_typing_broadcast', {
                        sender: socket.username,
                        isTyping: false
                    });
                }
            });
            socket.typingTargets.clear();

            // ONLY remove the user if their current socket matches the one stored
            if (socket.username && onlineUsers.get(socket.username) === socket.id) {
                onlineUsers.delete(socket.username);
                console.log(`❌ User left: ${socket.username}`);
                io.emit('update_user_list', Array.from(onlineUsers.keys()));
            }
        });
    });

    return io;
};
