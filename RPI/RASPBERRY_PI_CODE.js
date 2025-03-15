// ps aux | grep node
// sudo kill -9
const io = require('socket.io-client');
const { spawn, exec } = require('child_process');
const pigpio = require('pigpio');
const sharp = require('sharp');

const Gpio = pigpio.Gpio;
const greenLed = new Gpio(23, { mode: Gpio.OUTPUT }); // Green LED (Power Indicator)
const redLed = new Gpio(24, { mode: Gpio.OUTPUT });   // Red LED (Status Indicator)

// Adjustable settings
const fps = '15';
let whitebalance = 'custom';
const width = '1024';
const height = '768';

const cameraArgs = [
    '--width', width, '--height', height, '--framerate', fps, '-t', '0',
    '--codec', 'mjpeg', '--inline', '--nopreview', '-o', '-', '-v', '0',
    '--vflip', '1', '--denoise', 'cdn_fast',
    '--awbgains', '1.2,1.0', '--contrast', '1.0', '--brightness', '0.1',
    '--denoise', 'cdn_off', '--shutter', '60000', '--gain', '2',
    '--awb', whitebalance
];

async function findWebcam() {
    console.log("Searching for webcam on the network...");
    while (true) {
        const devices = await new Promise(resolve => {
            exec("sudo arp-scan --localnet | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}'", (err, stdout) => {
                resolve(stdout ? stdout.trim().split("\n") : []);
            });
        });

        if (devices.length === 0) {
            console.log("No devices found, retrying...");
            await new Promise(r => setTimeout(r, 3000));
            continue;
        }

        console.log(`Found devices: ${devices.join(", ")}`);

        for (const ip of devices) {
            const found = await new Promise(resolve => {
                exec(`nmap -p 8080 --open -n -Pn --min-rate 10000 --max-retries 1 ${ip}`, (err, result) => {
                    if (result.includes("open")) {
                        console.log(`Webcam found at ${ip}:8080!`);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                });
            });

            if (found) return ip;
        }
        await new Promise(r => setTimeout(r, 500));
    }
}

async function blinkBoth(times, delay) {
    for (let i = 0; i < times; i++) {
        greenLed.digitalWrite(1);
        redLed.digitalWrite(1);
        await new Promise(r => setTimeout(r, delay));
        greenLed.digitalWrite(0);
        redLed.digitalWrite(0);
        await new Promise(r => setTimeout(r, delay));
    }
}

async function blinkAlternate(delay) {
    while (!(await checkInternet())) {
        redLed.digitalWrite(1);
        greenLed.digitalWrite(0);
        await new Promise(r => setTimeout(r, delay));
        redLed.digitalWrite(0);
        greenLed.digitalWrite(1);
        await new Promise(r => setTimeout(r, delay));
    }
}

async function blinkWhileSearching(delay, stopSignal) {
    const steps = [
        [1, 0, delay], [0, 0, delay - 450], [1, 0, delay - 450], [0, 0, delay - 450],
        [1, 0, delay - 450], [0, 0, delay - 450], [1, 0, delay - 450], [0, 1, delay],
        [0, 0, delay - 450], [0, 1, delay - 450], [0, 0, delay - 450], [0, 1, delay - 450],
        [0, 0, delay - 450], [0, 1, delay - 450]
    ];

    while (!stopSignal.done) {
        for (const [red, green, wait] of steps) {
            redLed.digitalWrite(red);
            greenLed.digitalWrite(green);
            await new Promise(r => setTimeout(r, wait));
        }
    }
}

async function checkInternet() {
    return new Promise(resolve => {
        exec("ip -4 addr show wlan0 | grep 'inet '", (error, stdout) => {
            resolve(stdout.trim().length > 0);
        });
    });
}

async function main() {
    console.log("Starting...");
    await blinkBoth(2, 100);
    await new Promise(r => setTimeout(r, 1000));
    await blinkAlternate(300);
    console.log("Connected to WiFi!");
    await blinkBoth(5, 100);
    console.log("Waiting for webcam...");
    let stopSignal = { done: false };
    const searchPromise = findWebcam().then(ip => {
        stopSignal.done = true;
        startStreaming(ip);
    });
    const blinkPromise = blinkWhileSearching(500, stopSignal);
    await searchPromise;
    await blinkPromise;
    greenLed.digitalWrite('1');
}

function startStreaming(ip) {
    const SERVER_IP = `http://${ip}:8080`;
    const socket = io(SERVER_IP, { maxHttpBufferSize: 5e6 });

    let connectingBlink = setInterval(() => {
        redLed.digitalWrite(redLed.digitalRead() ^ 1);
    }, 250);

    let videoProcess;

    function startVideoProcess() {
        console.log('Starting up Video Process')
        if (videoProcess) videoProcess.kill();
        videoProcess = spawn('sudo', ['rpicam-vid', ...cameraArgs]);
        console.log('video process spawned')

        let frameBuffer = Buffer.alloc(0);

        videoProcess.stdout.on('data', async (data) => {
            console.log('data sent')
            frameBuffer = Buffer.concat([frameBuffer, data]);
        
            let frameEnd;
            while ((frameEnd = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]))) !== -1) {
                const frame = frameBuffer.slice(0, frameEnd + 2);
                frameBuffer = frameBuffer.slice(frameEnd + 2); // Remove processed frame
        
                try {
                    const compressed = await sharp(frame)
                        .webp({ quality: 75 }) // Optimize MJPEG without resizing
                        .toBuffer();
        
                    socket.emit('rpi_webcam', compressed.toString('base64'));
                } catch (err) {
                    console.error('WebP Compression Error:', err);
                }
            }
        });

        videoProcess.stderr.on('data', (data) => {
            console.error(`libcamera-vid error: ${data}`);
        });

        videoProcess.on('close', (code) => {
            console.log(`libcamera-vid exited with code ${code}, restarting...`);
            setTimeout(startVideoProcess, 5000); // Restart after 1 second
        });
    }

    socket.on('connect', () => {
        console.log('Connected to server:', SERVER_IP);
        clearInterval(connectingBlink);
        redLed.digitalWrite(0);
        startVideoProcess(); // Start the video process
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
        connectingBlink = setInterval(() => {
            redLed.digitalWrite(redLed.digitalRead() ^ 1);
        }, 250);
    });

    socket.on('ledActivity', data => {
        console.log(`LED ACTIVITY: "${data}"`)
        switch (data) {
            case 'add':
                console.log('STUDENT ADDED');
                redLed.digitalWrite(1);
                setTimeout(() => redLed.digitalWrite(0), 450);
                break;
            case 'violation':
                console.log('STUDENT VIOLATED');
                redLed.digitalWrite(1);
                setTimeout(() => redLed.digitalWrite(0), 200);
                break;
            case 'removed':
                console.log('STUDENT REMOVED');
                redLed.digitalWrite(1);
                setTimeout(() => redLed.digitalWrite(0), 200);
                break;
        }
    });
}

main();