/*
    This does not include in the server, This is placed under Raspberry Pi
    that has camera module attached to it, not USB Webcam as this code
    turns RPI into IP Camera.
*/
const io = require('socket.io-client');
const { spawn } = require('child_process');
const yargs = require('yargs');
const Gpio = require('pigpio').Gpio;
const led = new Gpio(16, { mode: Gpio.OUTPUT });

// Adjustable settings
const fps = '15';
const whitebalance = 'auto';
const width = '1024';  // Default: 1024
const height = '768'; // Default: 768
let ledBlinkInterval = 100;

// Parse command-line argument for the server IP
const argv = yargs.option('ip', {
    alias: 'i',
    description: 'Server IP Address',
    type: 'string',
    demandOption: true
}).help().argv;

const SERVER_IP = argv.ip; // Server IP from argument

const socket = io(`http://${SERVER_IP}:8080`);

socket.on('connect', () => {
    console.log('Connected to server:', SERVER_IP);

    socket.on('led', ()=>{
        led.writeSync(1);
        setTimeout(()=>led.writeSync(0), 500);
    });

    const videoProcess = spawn('libcamera-vid', [
        '--width', width, '--height', height, '--framerate', fps, '-t', '0',
        '--codec', 'mjpeg', '--inline', '--nopreview', '-o', '-', '-v', '0', '--awb', whitebalance,
        '--brightness', '0.5'
    ]);

    let frameBuffer = Buffer.alloc(0);

    videoProcess.stdout.on('data', (data) => {        frameBuffer = Buffer.concat([frameBuffer, data]);
        const frameEnd = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9])); // JPEG End Marker

        if (frameEnd !== -1) {
            const frame = frameBuffer.slice(0, frameEnd + 2);
            socket.emit('rpi_webcam', frame.toString('base64'));
            frameBuffer = frameBuffer.slice(frameEnd + 2);
        }
    });

    videoProcess.stderr.on('data', (data) => {
        console.error(`libcamera-vid error: ${data}`);
    });

    videoProcess.on('close', (code) => {
        console.log(`libcamera-vid sexited with code ${code}`);
    });
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
});


socket.on('ledActivity', (status) => {
    switch(status)
    {
        case 'add':
            blink(1.5)
            break;
        case 'violation':
            blink(0.5)
            break;
    }
});

function blink(seconds)
{
    let temp = ledBlinkInterval; 
    ledBlinkInterval = 1500
    led.digitalRead(0); // resets if its on

    led.digitalWrite(1);
    setTimeout(() => led.digitalWrite(0), seconds * 1000);
    ledBlinkInterval = temp;
}

// just activity
// setInterval(() => { led.digitalWrite(led.digitalRead() ^ 1) }, ledBlinkInterval);

process.on('SIGINT', () => {
    led.digitalWrite(0);
    process.exit();
});