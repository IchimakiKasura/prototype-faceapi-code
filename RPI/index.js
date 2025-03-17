const { blinkBoth, blinkAlternate, blinkWhileSearching, greenLed } = require('./led');
const { findWebcam } = require('./network');
const { startStreaming } = require('./camera');

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

main();
