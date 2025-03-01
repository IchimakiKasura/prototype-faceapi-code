const video = document.getElementById('cam');
const socket = io();

Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri('/models'),
    faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
    faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
    faceapi.nets.faceExpressionNet.loadFromUri('/models')
]).then(startVideo);

async function startVideo() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevice = devices.filter(device => device.kind === "videoinput");

    navigator.mediaDevices.getUserMedia({ video: {
        deviceId: {
            exact: videoDevice[0].deviceId
        }
    }})
    .then(stream => video.srcObject = stream)
    .catch(err => console.error(err));
}

async function loadLabeledDescriptors() {
    return Promise.all(Object.entries(dataLabels).map(async ([label, imagePaths]) => {
        const descriptors = [];

        for (let path of imagePaths) {
            const img = await faceapi.fetchImage(path);
            const detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptor();
            if (detection) {
                descriptors.push(detection.descriptor);
            }
        }

        return new faceapi.LabeledFaceDescriptors(label, descriptors);
    }));
}

video.addEventListener('play', async () => {
    const canvas = faceapi.createCanvasFromMedia(video);
    document.body.append(canvas);
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);

    const labeledDescriptors = await loadLabeledDescriptors();
    const faceMatcher = new faceapi.FaceMatcher(labeledDescriptors, 0.6);

    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();

        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        resizedDetections.forEach(detection => {
            const bestMatch = faceMatcher.findBestMatch(detection.descriptor);
            const box = detection.detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: bestMatch.toString() });
            drawBox.draw(canvas);
        });
    }, 50);

    setInterval(()=>{
        const vidToCanvas = document.createElement('canvas');
        const ctx = vidToCanvas.getContext('2d')
        vidToCanvas.width = video.width;
        vidToCanvas.height = video.height;
        ctx.drawImage(video, 0, 0, vidToCanvas.width, vidToCanvas.height);
        const imageData = vidToCanvas.toDataURL('image/webp')
        socket.emit('frame', imageData)
    }, 100)
});
