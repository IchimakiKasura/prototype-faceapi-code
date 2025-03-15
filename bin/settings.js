/*
    Here is where shortcut settings are placed
        for easy access etc.
*/

/*
    constant string idk lmao HAHAHA
*/
const LATE = 'late', UNIFORM = 'uniform', HAIRCUT = 'haircut';


/*
    CONFIDENCE RATE:
        The threshold for how strict the faceapi detects
            lower means stricter and higher means looser.
*/
const faceThreshold = 0.5;

/*
    Amount of compression level for mobile devices and
        public.
    
    0 = highest compression, might be blocky
    1 = no compression, original quality
    
    (DOES NOT AFFECT THE QUALITY OF THE SERVER MAIN CAMERA)
*/
const streamCompression = 0.2;

/*
    Amount of time to take before registering
    the student on the database.
    
    1000ms = 1sec
*/
const faceTimeout = 1500;

/*
    Amout of time to process the face on the image.

    recommended is 100ms for headroom for cpu process
        and have accurate* data/info.

    50ms for faster detection but increases inaccuracy

    1000ms = 1sec
*/
const faceDetectionInterval = 100;

/*
    Amount of frames per second to sent on
    mobile users.
*/
const webcamStreamFPS = 15;

/*
    This is optional, uncomment or change the boolean
        into a number of your specified webcam.

    If its false, it will automatically select the nearest
        or main webcam.
    
    If you wish to select other webcam, change the number
        to your specified webcam device id.

    Not used when using IP camera
*/
// const cameraDevice = 0;
const cameraDevice = true;

/*
    list all the javascript files from the bin/database directory
*/
const scriptList = [
    "12TECHVOC-ICT-DATA.js",
    "12STEM-D-DATA.js"
];