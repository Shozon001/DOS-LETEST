const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { startWorker, getStatus } = require('./worker');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

// Read-only API - no control endpoints
app.get('/api/status', (req, res) => {
    res.json(getStatus());
});

io.on('connection', (socket) => {
    socket.emit('status', getStatus());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`[+] Vexu Dashboard running on port ${PORT}`);
    startWorker(io);
});
