const video = document.getElementById('cam');
const detectionBuffer = new Map();
const LATE = 'late', UNIFORM = 'uniform', HAIRCUT = 'haircut';

const message = document.querySelector('.message');
message.style.display = 'block';

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
]).then(startVideo);

async function startVideo() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevice = devices.filter(device => device.kind === "videoinput");
    let webCam;

    switch (typeof(cameraDevice)) {
        case 'number':
            webCam = { deviceId: { exact: videoDevice[cameraDevice].deviceId } };
            break;
        case 'boolean':
            webCam = true;
            break;
    }

    navigator.mediaDevices.getUserMedia({ video: webCam })
        .then(stream => video.srcObject = stream)
        .catch(err => console.error(err));
}

async function loadLabeledImages() {
    console.log('loading labels')
    try {
        const response = await fetch('faces.bin');
        if (response.ok) {
            const cachedData = JSON.parse(await response.text());

            // Convert JSON back into LabeledFaceDescriptors
            return cachedData.map(sd => new faceapi.LabeledFaceDescriptors(
                sd.label,
                sd.descriptors.map(base64 => {
                    const binary = atob(base64);
                    const buffer = new Uint8Array([...binary].map(c => c.charCodeAt(0))).buffer;
                    return new Float32Array(buffer);
                })
            ));
        }
    } catch (err) {
        console.warn("Cache not found, processing images...");
    }

    // No cache found, process images
    const labeledDescriptors = await processFaceDescriptors();
    socket.emit('saveDescriptors', 
        JSON.stringify(
            labeledDescriptors.map(ld => ({
                label: ld.label,
                descriptors: ld.descriptors.map(desc => btoa(String.fromCharCode(...new Uint8Array(desc.buffer))))
                })
            )
        )
    );
    return labeledDescriptors.map(d => 
        new faceapi.LabeledFaceDescriptors(d.label, d.descriptors.map(desc => new Float32Array(desc)))
    );
}

async function processFaceDescriptors() {
    let total = 0;
    let counted = 0;
    Object.entries(window.studentData).forEach(([label, data]) => total += data.pictures.length);

    return Promise.all(Object.entries(window.studentData).map(async ([label, data]) => {
        const descriptors = [];
        for (let path of data.pictures) {
            counted++;
            let percentage = ((counted / total) * 100).toFixed(2);
            console.log(`face progress: ${percentage}%`)
            message.textContent = `Learning faces model: ${percentage}%`
            const img = await faceapi.fetchImage(path);
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();
            if (detection) descriptors.push(detection.descriptor);
        }
        return { label, descriptors };
    }));
}

socket.on('cacheUpdated', () => console.log("Cache file updated."));

video.addEventListener('play', async () => {
    const faceTimeNow = Date.now();
    console.log('loading face data from database');
    message.textContent = "Loading Face data from Database"
    const labeledDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, faceThreshold);
    console.log('face data are loaded');
    message.textContent = "Face data are loaded"
    const faceTimeAfter = Date.now();
    console.log(`face loaded at ${(faceTimeAfter - faceTimeNow) / 1000}s`)

    setTimeout(()=>{
        message.style.display = 'none';
    }, 500)
    
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    const detectionBuffer = new Map();

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d', { willReadFrequently: true }).clearRect(0, 0, canvas.width, canvas.height);

        // Track currently detected faces
        const detectedNames = new Set();

        resizedDetections.forEach(detection => {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            const name = bestMatch.distance < faceThreshold ? bestMatch.label : "Unknown";
            detectedNames.add(name);

            if (name !== "Unknown") {
                const now = Date.now();

                if (!detectionBuffer.has(name)) {
                    detectionBuffer.set(name, now);
                } else {
                    const firstDetectedTime = detectionBuffer.get(name);

                    // Register only if face is continuously detected for 3 seconds
                    if (now - firstDetectedTime >= faceTimeout) { 
                        socket.emit('detectedFace', name, window.studentData[name].information.GradeSection);
                        detectionBuffer.delete(name); // Remove after sending
                    }
                }
            }

            const box = detection.detection.box;
            new faceapi.draw.DrawBox(box, { label: name }).draw(canvas);
        });

        // Remove faces from buffer if they are not detected anymore
        detectionBuffer.forEach((_, name) => {
            if (!detectedNames.has(name)) {
                detectionBuffer.delete(name);
            }
        });

    }, faceDetectionInterval);

    setInterval(() => {
        const vidToCanvas = document.createElement('canvas');
        const ctx = vidToCanvas.getContext('2d');
        vidToCanvas.width = video.videoWidth;
        vidToCanvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, vidToCanvas.width, vidToCanvas.height);
    
        vidToCanvas.toBlob((blob) => {
            const reader = new FileReader();
            reader.readAsArrayBuffer(blob);
            reader.onloadend = () => {
                socket.emit('frame', reader.result);
            };
        }, 'image/webp', 0.8);
    }, 1000/webcamStreamFPS);   
});

socket.on('AddStudent', (name)=>{
    console.log('done');
    addStudent(name);
})