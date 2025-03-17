const { exec } = require('child_process');
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
async function checkInternet() {
    return new Promise(resolve => {
        exec("ip -4 addr show wlan0 | grep 'inet '", (error, stdout) => {
            resolve(stdout.trim().length > 0);
        });
    });
}

module.exports = { findWebcam, checkInternet };