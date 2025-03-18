const io = require('socket.io-client');
const { spawn } = require('child_process');
const { Beep } = require('./led');
const { redLed, buzzer } = require('./led');

const fps = '24';
const width = '800';
const height = '600';
const cameraArgs = [
    '--width', width, '--height', height, '--framerate', fps, '-t', '0',
    '--codec', 'mjpeg', '--inline', '--nopreview', '-o', '-', '-v', '0',
    '--vflip', '1', '--denoise', 'cdn_fast'
];

function startStreaming(ip) {
    let isConnected = false;
    let frameBuffer = Buffer.alloc(0);
    const SERVER_IP = `http://${ip}:8080`;
    const socket = io(SERVER_IP, { maxHttpBufferSize: 2e6 });
    
    let connectingBlink = setInterval(async () => {
        redLed.digitalWrite(redLed.digitalRead() ^ 1);
    }, 250);
    
    let videoProcess;

    function startVideoProcess() {
        if(!isConnected) return;
        console.log('Starting up Video Process')
        if (videoProcess) videoProcess.kill();

        const command = 'sudo';
        const args = ['su', '-', '-c', `libcamera-vid ${cameraArgs.join(' ')}`];
        //const args = [`libcamera-vid ${cameraArgs.join(' ')}`];

        console.log(`Executing command: ${command} ${args.join(' ')}`);

        videoProcess = spawn(command, args);

        console.log('video process spawned')

        videoProcess.stdout.on('data', (data) => {
            if (!socket.connected) {
                frameBuffer = Buffer.alloc(0); // Clear buffer to avoid backlog
                return; // Skip processing frames when disconnected
            }
        
            frameBuffer = Buffer.concat([frameBuffer, data]);
        
            let frameEnd;
            while ((frameEnd = frameBuffer.indexOf(Buffer.from([0xFF, 0xD9]))) !== -1) {
                const frame = frameBuffer.subarray(0, frameEnd + 2);
        
                // Clear buffer before sending the latest frame (drop old frames)
                frameBuffer = frameBuffer.subarray(frameEnd + 2);
                if (frameBuffer.length > 100000) frameBuffer = Buffer.alloc(0); // Prevent excessive buildup
        
                socket.volatile.emit('rpi_webcam', frame.toString('base64')); // Send latest frame
            }
        
            // If buffer gets too large, drop all frames to prevent lag buildup
            if (frameBuffer.length > 200000) frameBuffer = Buffer.alloc(0);
        });

        videoProcess.stderr.on('data', (data) => {
            console.error(`libcamera-vid error: ${data}`);
            buzzer.digitalWrite(0);
        });

        videoProcess.on('close', (code) => {
            console.log(`libcamera-vid exited with code ${code}, restarting`);
            // setTimeout(startVideoProcess, 5000); // Restart after 5 second
            buzzer.digitalWrite(0);
         });
    }

    socket.on('connect', async () => {
        isConnected = true;
        await Beep(100)
        await Beep(100)
        await Beep(500)
        console.log('Connected to server:', SERVER_IP);
        frameBuffer = Buffer.alloc(0); // Flush old data on reconnect
        clearInterval(connectingBlink);
        startVideoProcess(); // Start the video process
        redLed.digitalWrite(0);
        buzzer.digitalWrite(0);
    });

    socket.on('disconnect', () => {
        isConnected = false;
        console.log('Disconnected from server');
        connectingBlink = setInterval(() => {
            redLed.digitalWrite(redLed.digitalRead() ^ 1);
        }, 250);
        buzzer.digitalWrite(0);
    });

    socket.on('ledActivity',async data => {
        console.log(`LED ACTIVITY: "${data}"`)
        switch (data) {
            case 'add':
                console.log('STUDENT ADDED');
                redLed.digitalWrite(1);
                setTimeout(() => redLed.digitalWrite(0), 450);
                await Beep(450);
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

module.exports = { startStreaming };