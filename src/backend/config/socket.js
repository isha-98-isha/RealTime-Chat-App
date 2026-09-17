import { Server } from 'socket.io';
import { randomUUID } from 'crypto';

const globalRegisteredUsers = new Set();
const activeOnlineSockets = new Map();
const offlineMessageQueues = new Map();

const broadcastGlobalRoster = (io) => {
    const roster = Array.from(globalRegisteredUsers, (username) => ({
        username,
        isOnline: activeOnlineSockets.has(username)
    }));

    io.emit('update_global_roster', roster);
};

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

            globalRegisteredUsers.add(username);
            activeOnlineSockets.set(username, socket.id);
            socket.username = username; 

            console.log(`👤 Active User list updated: ${username}`);

            const pendingMessages = offlineMessageQueues.get(username);
            if (pendingMessages?.length) {
                pendingMessages.forEach((payload) => {
                    socket.emit('receive_message', payload);
                });
                offlineMessageQueues.delete(username);
            }

            broadcastGlobalRoster(io);
        });

        socket.on('private_message', (payload) => {
            const { targetUsername, message } = payload;
            const messagePayload = {
                id: payload.id || randomUUID(),
                sender: socket.username,
                message: message,
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            };
            const targetSocketId = activeOnlineSockets.get(targetUsername);

            if (targetSocketId) {
                io.to(targetSocketId).emit('receive_message', messagePayload);
            } else {
                const pendingMessages = offlineMessageQueues.get(targetUsername) || [];
                pendingMessages.push(messagePayload);
                offlineMessageQueues.set(targetUsername, pendingMessages);
            }
        });

        socket.on('messages_read', (payload) => {
            const { sender, messageIds } = payload || {};
            const senderSocketId = activeOnlineSockets.get(sender);

            if (!senderSocketId || !Array.isArray(messageIds) || !messageIds.length) return;

            io.to(senderSocketId).emit('messages_read', {
                reader: socket.username,
                messageIds
            });
        });

        // Ensure this event listener is inside your backend socket.js file:
            socket.on('user_typing', (payload) => {
                const { targetUsername, isTyping } = payload;
                const targetSocketId = activeOnlineSockets.get(targetUsername);

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
            const targetSocketId = activeOnlineSockets.get(targetUsername);
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
                const targetSocketId = activeOnlineSockets.get(targetUsername);
                if (targetSocketId) {
                    io.to(targetSocketId).emit('user_typing_broadcast', {
                        sender: socket.username,
                        isTyping: false
                    });
                }
            });
            socket.typingTargets.clear();

            // ONLY remove the user if their current socket matches the one stored
            if (socket.username && activeOnlineSockets.get(socket.username) === socket.id) {
                activeOnlineSockets.delete(socket.username);
                console.log(`❌ User left: ${socket.username}`);
                broadcastGlobalRoster(io);
            }
        });
    });

    return io;
};
