let labeledDescriptors;

async function loadLabeledImages() {
    console.log('Loading face labels...');
    try {
        const response = await fetch('faces.bin');
        if (response.ok) {
            const cachedData = JSON.parse(await response.text());
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
        console.warn("No cache found, processing images...");
    }

    const labeledDescriptors = await processFaceDescriptors();
    socket.emit('saveDescriptors', JSON.stringify(
        labeledDescriptors.map(ld => ({
            label: ld.label,
            descriptors: ld.descriptors.map(desc => btoa(String.fromCharCode(...new Uint8Array(desc.buffer))))
        }))
    ));
    return labeledDescriptors.map(d => 
        new faceapi.LabeledFaceDescriptors(d.label, d.descriptors.map(desc => new Float32Array(desc)))
    );
}

async function processFaceDescriptors() {
    let total = 0, counted = 0;
    Object.entries(window.studentData).forEach(([_, data]) => total += data.pictures.length);
    const processedImages = new Set(); // Track processed images

    return Promise.all(Object.entries(window.studentData).map(async ([label, data]) => {
        const descriptors = [];

        for (let path of data.pictures) {
            if (processedImages.has(path)) continue; // Skip already processed images

            counted++;
            let percentage = ((counted / total) * 100).toFixed(2);
            console.log(`Processing image: ${label} | face progress: ${percentage}%`);
            message.innerHTML = `<span class="loading"></span> Learning faces model: ${percentage}%`;

            console.log('Processing face in color...');
            const img = await faceapi.fetchImage(path);
            const detection = await faceapi.detectSingleFace(img)
                .withFaceLandmarks()
                .withFaceDescriptor();

            if (detection) {
                descriptors.push(detection.descriptor);

                // Helper function to apply color tint
                function applyColorTint(canvas, img, rFactor, gFactor, bFactor) {
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0, img.width, img.height);

                    const imageData = ctx.getImageData(0, 0, img.width, img.height);
                    for (let i = 0; i < imageData.data.length; i += 4) {
                        imageData.data[i] *= rFactor;   // Red channel
                        imageData.data[i + 1] *= gFactor; // Green channel
                        imageData.data[i + 2] *= bFactor; // Blue channel
                    }
                    ctx.putImageData(imageData, 0, 0);
                    return canvas;
                }

                // Grayscale Processing
                console.log(`Processing faces in grayscale: ${label}`);
                const canvasGray = applyColorTint(document.createElement('canvas'), img, 1, 1, 1);
                const grayDetection = await faceapi.detectSingleFace(await faceapi.fetchImage(canvasGray.toDataURL()))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (grayDetection) descriptors.push(grayDetection.descriptor);

                // Reduced Brightness
                console.log(`Processing faces in reduced brightness: ${label}`);
                const canvasDark = applyColorTint(document.createElement('canvas'), img, 0.7, 0.7, 0.7);
                const darkDetection = await faceapi.detectSingleFace(await faceapi.fetchImage(canvasDark.toDataURL()))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (darkDetection) descriptors.push(darkDetection.descriptor);

                // Pinkish Tint
                console.log(`Processing faces with pinkish tint: ${label}`);
                const canvasPink = applyColorTint(document.createElement('canvas'), img, 1.2, 0.9, 0.9);
                const pinkDetection = await faceapi.detectSingleFace(await faceapi.fetchImage(canvasPink.toDataURL()))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (pinkDetection) descriptors.push(pinkDetection.descriptor);

                // Red Tint
                console.log(`Processing faces with red tint: ${label}`);
                const canvasRed = applyColorTint(document.createElement('canvas'), img, 1.5, 0.7, 0.7);
                const redDetection = await faceapi.detectSingleFace(await faceapi.fetchImage(canvasRed.toDataURL()))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (redDetection) descriptors.push(redDetection.descriptor);

                // Green Tint
                console.log(`Processing faces with green tint: ${label}`);
                const canvasGreen = applyColorTint(document.createElement('canvas'), img, 0.7, 1.5, 0.7);
                const greenDetection = await faceapi.detectSingleFace(await faceapi.fetchImage(canvasGreen.toDataURL()))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (greenDetection) descriptors.push(greenDetection.descriptor);

                // Blue Tint
                console.log(`Processing faces with blue tint: ${label}`);
                const canvasBlue = applyColorTint(document.createElement('canvas'), img, 0.7, 0.7, 1.5);
                const blueDetection = await faceapi.detectSingleFace(await faceapi.fetchImage(canvasBlue.toDataURL()))
                    .withFaceLandmarks()
                    .withFaceDescriptor();
                if (blueDetection) descriptors.push(blueDetection.descriptor);

                // Cleanup
                [canvasGray, canvasDark, canvasPink, canvasRed, canvasGreen, canvasBlue].forEach(canvas => {
                    canvas.remove();
                    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
                });
            }

            img.remove();
            processedImages.add(path); // Mark image as processed
        }
        return { label, descriptors };
    }));
}