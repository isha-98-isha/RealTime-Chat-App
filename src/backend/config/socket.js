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

        socket.on('disconnect', () => {
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
