const video = document.getElementById('cam');
let isFirstLoad = true;
const detectionBuffer = new Map();

const message = document.querySelector('.message');
message.style.display = 'block';

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.ssdMobilenetv1.loadFromUri('/models')
]).then(startVideo);

async function startVideo() {
    if(useWebcam)
    {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevice = devices.filter(device => device.kind === "videoinput");

        navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: videoDevice[0].deviceId } } })
        .then(stream => {
          const vid = document.getElementById('webcams'); // Video element
          const img = document.getElementById('cam');  // Image element
          vid.srcObject = stream;

          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          vid.addEventListener('playing', () => {
            setInterval(() => {
              if (vid.videoWidth > 0 && vid.videoHeight > 0) {
                canvas.width = vid.videoWidth;
                canvas.height = vid.videoHeight;
                ctx.drawImage(vid, 0, 0, canvas.width, canvas.height);
                img.src = canvas.toDataURL('image/webp'); // Optimized encoding
              }
            }, 16); // 24 FPS (1000ms / 24 = ~42ms per frame)
          });
        })
        .catch(error => console.error('Webcam access error:', error));
    } else {
        const img = new Image();
        img.onload = () => {
            requestAnimationFrame(() => video.src = img.src);
        };

        let lastFrameTime = Date.now();
        const timeoutThreshold = 5000;
        
        socket.on('camera-frame', (base64Data) => {
            img.src = `data:image/webp;base64,${base64Data}`;
            lastFrameTime = Date.now();
        });

        setInterval(() => {
            if (Date.now() - lastFrameTime > timeoutThreshold) {
                message.textContent = "reconnecting"
                message.style.display = 'block';
                img.src = "";
            } else message.style.display = 'none';
        }, 1000);
    }
}

socket.on('cacheUpdated', () => console.log("Cache file updated."));

video.onload = async () => {
    if (isFirstLoad) {
        isFirstLoad = false;        

        const faceTimeNow = Date.now();
        const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, faceThreshold);
        labeledDescriptors = '' // remove data for security idk

        message.textContent = "webcam connected!"

        setTimeout(() => { message.style.display = 'none'; }, 500);
        
        console.log(`Face loaded in ${(Date.now() - faceTimeNow) / 1000}s`);
    
        const canvas = faceapi.createCanvasFromMedia(video);
        document.body.append(canvas);
        faceapi.matchDimensions(canvas, { width: video.width, height: video.height });

        const imgToCanvas = document.createElement('canvas');
        imgToCanvas.width = video.width;
        imgToCanvas.height = video.height;
        const imgCtx = imgToCanvas.getContext('2d');

        async function processFaceDetection() {
            // const detections = await faceapi.detectAllFaces(video, new faceapi.SsdMobilenetv1Options())
            //     .withFaceLandmarks()
            //     .withFaceDescriptors();

            const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
                .withFaceLandmarks()
                .withFaceDescriptors();

            const resizedDetections = faceapi.resizeResults(detections, { width: video.width, height: video.height });
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const detectedNames = new Set();
            const now = Date.now();
            const resetTime = 500;  // Increased reset time for smoother tracking
            const cooldownTime = 5000;

            resizedDetections.forEach(detection => {
                const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
                const isKnown = bestMatch.distance < faceThreshold;
                const name = isKnown ? bestMatch.label : "Unknown";
                detectedNames.add(name);
        
                new faceapi.draw.DrawBox(detection.detection.box, { 
                    label: `${name} (${bestMatch.distance.toFixed(2)})`, 
                    boxColor: isKnown ? "green" : "red"
                }).draw(canvas);

                if (isKnown) {
                    if (!detectionBuffer.has(name)) {
                        detectionBuffer.set(name, { firstSeen: now, lastSeen: now, lastRegistered: 0 });
                    } else {
                        let { firstSeen, lastSeen, lastRegistered } = detectionBuffer.get(name);
        
                        // If the face reappears within resetTime, continue tracking
                        if (now - lastSeen <= resetTime) {
                            detectionBuffer.set(name, { firstSeen, lastSeen: now, lastRegistered });
        
                            // Register face only if it stays long enough
                            if (now - firstSeen >= faceTimeout && now - lastRegistered >= cooldownTime) {
                                socket.emit('detectedFace', name, window.studentData[name]?.information.GradeSection);
                                detectionBuffer.set(name, { firstSeen: now, lastSeen: now, lastRegistered: now });
                            }
                        } else {
                            // Reset firstSeen only if face is gone too long
                            detectionBuffer.set(name, { firstSeen: now, lastSeen: now, lastRegistered });
                        }
                    }
                }
            });

            // Remove faces that disappeared only if they have been gone too long
            detectionBuffer.forEach((data, name) => {
                if (!detectedNames.has(name) && now - data.lastSeen > resetTime) {
                    detectionBuffer.delete(name);
                }
            });
        }

        function sendImages()
        {
            // Clear Preview
            imgCtx.drawImage(video, 0, 0, imgToCanvas.width, imgToCanvas.height);
            imgToCanvas.toBlob(blob => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(blob);
                reader.onloadend = () => {
                    socket.volatile.emit('clearFrame', reader.result);
                };
            }, 'image/webp', streamCompression);

            // Merge video and canvas into one image for preview
            const mergeCanvas = document.createElement('canvas');
            mergeCanvas.width = video.width;
            mergeCanvas.height = video.height;
            const mergeCtx = mergeCanvas.getContext('2d');

            mergeCtx.drawImage(video, 0, 0, mergeCanvas.width, mergeCanvas.height);
            mergeCtx.drawImage(canvas, 0, 0, mergeCanvas.width, mergeCanvas.height);

            mergeCanvas.toBlob(blob => {
                const reader = new FileReader();
                reader.readAsArrayBuffer(blob);
                reader.onloadend = () => {
                    socket.volatile.emit('boxFrame', reader.result);
                };
            }, 'image/webp', streamCompression);
        }

        setInterval(processFaceDetection, faceDetectionInterval);
        setInterval(sendImages, 1000 / webcamStreamFPS);
    }
};

async function autoTrain()
{
    console.log('Loading face data from database...');
    message.textContent = "Loading Face data from Database";

    labeledDescriptors = await loadLabeledImages();
    console.log('Face data loaded.');

    message.textContent = "Face data are loaded";

    if(video.src == "")
    {
        setTimeout(()=> { message.textContent = "Awaiting Webcam"; }, 500)
    }
}

socket.on('AddStudent', (name) => {
    console.log('Student added:', name);
    addStudent(name);
});

autoTrain();