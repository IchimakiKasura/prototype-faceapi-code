const pigpio = require('pigpio');
const Gpio = pigpio.Gpio;
const greenLed = new Gpio(23, { mode: Gpio.OUTPUT });
const redLed = new Gpio(24, { mode: Gpio.OUTPUT });
const buzzer = new Gpio(14, { mode: Gpio.OUTPUT });
const { checkInternet } = require('./network');

async function Beep(delay) {
    buzzer.digitalWrite(1);
    await new Promise(r => setTimeout(r, delay));
    buzzer.digitalWrite(0);
}

async function blinkBoth(times, delay) {
    for (let i = 0; i < times; i++) {
        greenLed.digitalWrite(1);
        redLed.digitalWrite(1);
        buzzer.digitalWrite(1);
        await new Promise(r => setTimeout(r, delay));
        greenLed.digitalWrite(0);
        redLed.digitalWrite(0);
        buzzer.digitalWrite(0);
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
        Beep(50);
        for (const [red, green, wait] of steps) {
            redLed.digitalWrite(red);
            greenLed.digitalWrite(green);
            await new Promise(r => setTimeout(r, wait));
        }
        Beep(50);
    }
}

module.exports = { Beep, blinkBoth, blinkAlternate, blinkWhileSearching, redLed, greenLed, buzzer };