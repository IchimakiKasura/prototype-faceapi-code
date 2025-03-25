const useragent = require('express-useragent');
const favicon = require('serve-favicon');
const express = require('express');
const setIo = require('./io');
const http = require('http');
const path = require('path');
const XLSX = require('xlsx');
const os = require('os');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const PORT = 8080;

// Login credentials for security? idk
const credentials = JSON.parse(fs.readFileSync('./bin/database/credentials.json', 'utf-8'));
const { admin, user } = credentials;

const setMimeType = (res, filePath) => {
    const types = { js: 'application/javascript', css: 'text/css', less: 'text/css', jpeg: 'image/jpeg', json: 'application/json' };
    const ext = path.extname(filePath).slice(1);
    if (types[ext]) res.setHeader('Content-Type', types[ext]);
};

app.use(useragent.express());

app.use(favicon(path.join(__dirname, 'bin/website/favicon.ico')))

app.use((req, res, next) => {
    // automate large amount of picture request cuz' faceapi requires to
    if (req.method === "GET" && req.url.startsWith("/database")) {
        restricted(req, res);
        return express.static(path.join(__dirname, "bin"), { setHeaders: setMimeType })(req, res, next);
    }
    
    const folder = req.useragent.isMobile ? "mobile" : "application";
    express.static(path.join(__dirname, "bin", "website", folder), { setHeaders: setMimeType })(req, res, next);
});

app.get("/", (req, res, next) => {
    const b64auth = (req.headers.authorization || "").split(" ")[1] || "";
    const [username, password] = Buffer.from(b64auth, "base64").toString().split(":");

    const folder = req.useragent.isMobile ? 'mobile' : 'application';
    
    const isValidUser = Array.isArray(user) && user.some(u => u.username === username && u.password === password);
    const isValidAdmin = username === admin.username && password === admin.password;

    const validCredentials = (folder === 'mobile' && isValidUser) || (folder === 'application' && isValidAdmin);

    if (!validCredentials) {
        res.set("WWW-Authenticate", 'Basic realm="Login Required"');
        return res.status(401).sendFile(path.join(__dirname, "bin", "website", "authentication.html"));
    }

    const access = folder === 'mobile' ? 'user' : 'admin';
    console.log(access === 'user' ? `User ${username} has connected` : `Administrator has connected`);

    res.sendFile(path.join(__dirname, 'bin', 'website', folder, `${access}.html`));
});

app.get("/public", (req, res) =>{
    res.sendFile(path.join(__dirname, 'bin/website/guest/guest.html'), { setHeaders: {'Content-Type': 'application/text'} })
})

app.get("/logout", (req, res) => {
    res.set("WWW-Authenticate", 'Basic realm="Login Required"');
    return res.status(401).sendFile(path.join(__dirname, "bin", "website", "authentication.html"));
});

app.get('/:date.xlsx', (req, res) => {
    const date = req.params.date;
    const filePath = path.join(__dirname, 'bin/database/attendance', `${date}.xlsx`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ message: 'No attendance record found' });
    }

    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false }).reverse(); // Reverse order here

    // Convert array format to object format
    const attendanceData = jsonData.reduce((acc, row) => {
        acc[row.NAME] = {
            gradeSection: row.SECTION,
            time: row.TIME || "Unknown Time",
            violations: {
                uniform: row.VIOLATIONS.includes("uniform"),
                late: row.VIOLATIONS.includes("late"),
                haircut: row.VIOLATIONS.includes("haircut")
            }
        };
        return acc;
    }, {});

    res.json(attendanceData);
});

app.get('/faces.bin', (req, res, next) => {
    restricted(req, res);
    const filePath = path.join(__dirname, 'bin/database/cache/faces.bin');
    
    fs.access(filePath, fs.constants.F_OK, (err) => {
        if (err) return res.status(404).json({ error: "Descriptors file not found" });
        
        res.sendFile(filePath, { setHeaders: {'Content-Type': 'application/text'} });
    });
})

// Restrict anonymous access cuz' its an important file and privacy is priority idk
const restrictedFiles = [
    '/12STEM-D-DATA.js',
    '/12TECHVOC-ICT-DATA.js'
]
restrictedFiles.forEach(file=>
    app.use(file, (req, res) => {
        restricted(req, res);
        res.sendFile(path.join(__dirname, `bin/database/${file}`), { setHeaders: setMimeType });
    }))

const files = [
    '/less.js',
    '/camera.js',
    '/faceTrainer.js',
    '/settings.js',
    '/face-api.min.js',
    '/socket.io.js',
    '/simplepeer.min.js',
    '/serverCom.js',
    '/12STEM-D-DATA.js',
    '/12TECHVOC-ICT-DATA.js'
];
files.forEach(file => {

    const paths = {
        '/face-api.min.js': 'node_modules/face-api.js/dist/face-api.min.js',
        '/socket.io.js': 'node_modules/socket.io/client-dist/socket.io.js',
        '/12STEM-D-DATA.js': 'bin/database/12STEM-D-DATA.js',
        '/12TECHVOC-ICT-DATA.js': 'bin/database/12TECHVOC-ICT-DATA.js',
    };

    app.use(file, express.static(
        path.join(__dirname, paths[file] || `bin${file}`
    ), { setHeaders: setMimeType }));
});

// Handle 403 requests
const restricted = (req, res) =>{
    if (!req.headers.referer || !req.headers.referer.includes(req.get('host')))
        return res.status(403).sendFile(path.join(__dirname, 'bin/website/restricted.html'));
    else return 0;
}
// Handle 404 requests
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, "bin", "website", "notFound.html")));

setIo(server);

server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
const interfaces = os.networkInterfaces();
for (const iface of Object.values(interfaces)) {
    for (const config of iface) {
        if (config.family === 'IPv4' && !config.internal) {
            console.log(`Mobile users: http://${config.address}:${PORT}`);
        }
    }
}