import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { initSocket } from './config/socket.js';

const app = express();
const server = http.createServer(app);

// Resolve directory path for serving static frontend files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendPath = path.join(__dirname, '../frontend');

// Serve frontend assets statically
app.use(express.static(frontendPath));

// Initialize Socket.IO configuration
initSocket(server);

// Change this line at the bottom of your server.js:
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Chat server running professionally at port ${PORT}`);
});

