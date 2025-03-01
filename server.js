const os = require('os')
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const useragent = require('express-useragent');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = 8080;

app.use(useragent.express());

const setMimeType = (res, filePath) => {
    const types = { js: 'application/javascript', css: 'text/css', less: 'text/css', jpeg: 'image/jpeg' };
    const ext = path.extname(filePath).slice(1);
    if (types[ext]) res.setHeader('Content-Type', types[ext]);
};

// Dynamic folder selection based on device
app.use((req, res, next) => {

    // automate large amount of picture request cuz' faceapi requires to
    if (req.method === 'GET') {
        if(req.url.match(/database/)) {
            app.use(req.url, express.static(path.join(__dirname, 'bin', req.url), { setHeaders: setMimeType}))
        }
    }

    const folder = req.useragent.isMobile ? 'mobile' : 'application';
    express.static(path.join(__dirname, 'bin', 'website', folder), { setHeaders: setMimeType })(req, res, next);
});

// Detects if its a Desktop (admin) or Mobile (users)
app.get('/', (req, res) => {
    const folder = req.useragent.isMobile ? 'mobile' : 'application';
    const access = folder == 'mobile' ? 'user' : 'admin';
    console.log(access == 'user' ? "User has connected" : "Admininstrator has connected")
    res.sendFile(path.join(__dirname, 'bin', 'website', folder, `${access}.html`));
});

['/less.js', '/camera.js', '/face-api.min.js', '/socket.io.js'].forEach(file =>
    app.use(file, express.static(path.join(
        __dirname, file.includes('.js') ? (file === '/face-api.min.js' ? 'node_modules/face-api.js/dist/face-api.min.js' : file === '/socket.io.js' ? 'node_modules/socket.io/client-dist/socket.io.js' : `bin${file}`) : ''
        ), { setHeaders: setMimeType }
    )));

// Restrict anonymous access to data.js cuz' its an important file and privacy is priority idk
app.use('/data.js', (req, res) => {
    if (!req.headers.referer || !req.headers.referer.includes(req.get('host')))
        return res.status(403).sendFile(path.join(__dirname, 'bin/website/restricted.html'));
    res.sendFile(path.join(__dirname, 'bin/database/data.js'), { setHeaders: setMimeType });
});

/*
    It receives the video stream from the Desktop's webcam so Mobile users can access them
    though slight issue here is, it kinda lags when faceapi is processing but who knows
    how tf do I optimize this lobotomized code
*/
io.on('connection', (socket) => {
    socket.on('frame', (imageData) => {
        socket.broadcast.emit('stream', imageData);
    });
});

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
const interfaces = os.networkInterfaces();
for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
        if (config.family === 'IPv4' && !config.internal) {
            console.log(`Mobile users: http://${config.address}:${PORT}`);
        }
    }
}