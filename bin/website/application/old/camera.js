const video = document.getElementById('cam');
let isFirstLoad = true;
const detectionBuffer = new Map();

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
    const img = new Image();
    img.onload = () => video.src = img.src; // Only update when ready
    
    socket.on('camera-frame', (base64Data) => {
        img.src = `data:image/webp;base64,${base64Data}`; // Use WebP format
    });


    // For built-in webcam

    // const devices = await navigator.mediaDevices.enumerateDevices();
    // const videoDevice = devices.filter(device => device.kind === "videoinput");
    // let webCam;

    // switch (typeof(cameraDevice)) {
    //     case 'number':
    //         webCam = { deviceId: { exact: videoDevice[cameraDevice].deviceId } };
    //         break;
    //     case 'boolean':
    //         webCam = true;
    //         break;
    // }

    // navigator.mediaDevices.getUserMedia({ video: webCam })
    //     .then(stream => video.srcObject = stream)
    //     .catch(err => {
    //         console.error('No camera found')
    //         message.textContent = 'No camera device found!'
    //     });
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

video.onload = async () => {
    if(isFirstLoad)
    {
        isFirstLoad = false;

        const faceTimeNow = Date.now();
        console.log('Loading face data from database...');
        message.textContent = "Loading Face data from Database";
        
        const labeledDescriptors = await loadLabeledImages();
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, faceThreshold);
        
        console.log('Face data loaded.');
        message.textContent = "Face data are loaded";
        
        const faceTimeAfter = Date.now();
        console.log(`Face loaded in ${(faceTimeAfter - faceTimeNow) / 1000}s`);
    
        setTimeout(() => {
            message.style.display = 'none';
        }, 500);
    
        const imgToCanvas = document.createElement('canvas');
        imgToCanvas.height = video.height;
        imgToCanvas.width = video.width;
        
        const canvas = faceapi.createCanvasFromMedia(video);
        document.body.append(canvas);
        
        const displaySize = { width: video.width, height: video.height };
        faceapi.matchDimensions(canvas, displaySize);
    
        const detectionBuffer = new Map();
    
        async function processFaceDetection() {
            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            const ctxBoxed = canvas.getContext('2d');
            ctxBoxed.clearRect(0, 0, canvas.width, canvas.height);

            const detectedNames = new Set();

            resizedDetections.forEach(detection => {
                const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                const isKnown = bestMatch.distance < faceThreshold;
                const name = isKnown ? bestMatch.label : "Unknown";
                detectedNames.add(name);

                const labelText = `${name} (${bestMatch.distance.toFixed(2)})`;
                const boxColor = isKnown ? "green" : "red"; // Green for known, red for unknown

                new faceapi.draw.DrawBox(detection.detection.box, { 
                    label: labelText, 
                    boxColor 
                }).draw(canvas);

                if (isKnown) {
                    const now = Date.now();
                    if (!detectionBuffer.has(name)) {
                        detectionBuffer.set(name, now);
                    } else if (now - detectionBuffer.get(name) >= faceTimeout) { 
                        socket.emit('detectedFace', name, window.studentData[name]?.information.GradeSection);
                        detectionBuffer.delete(name);
                    }
                }
            });

            const ctx = imgToCanvas.getContext('2d');
            ctx.drawImage(video, 0, 0, imgToCanvas.width, imgToCanvas.height);

            // clear preview
            imgToCanvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(blob);
                reader.onloadend = () => {
                    socket.emit('clearFrame', reader.result);
                };
            }, 'image/webp', streamCompression);

            // Merge video and canvas into one image for boxes preview
            const mergeCanvas = document.createElement('canvas');
            mergeCanvas.width = video.width;
            mergeCanvas.height = video.height;
            const mergeCtx = mergeCanvas.getContext('2d');

            mergeCtx.drawImage(video, 0, 0, mergeCanvas.width, mergeCanvas.height);
            mergeCtx.drawImage(canvas, 0, 0, mergeCanvas.width, mergeCanvas.height);

            mergeCanvas.toBlob((blob) => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(blob);
                reader.onloadend = () => {
                    socket.emit('boxFrame', reader.result);
                };
            }, 'image/webp', streamCompression);
        }

        setInterval(() => processFaceDetection(), 1000 / webcamStreamFPS);
    }
}

socket.on('AddStudent', (name)=>{
    console.log('done');
    addStudent(name);
})