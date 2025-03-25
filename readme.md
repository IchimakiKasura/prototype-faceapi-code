<div align='center'>
<img src="./bin/website/FIST CIRCLE.png" height="120px">
<h1>Facial Integrated System Technology</h1>
</div>
<br>

# SCHOOL DATABASE APPLICATION w/ FACIAL RECOGNITION
This applciation prototype is soley made for our group project.

This application is free to use as long as you credit this repo.

This repository includes all the source code used for webserver full-stack* <br>
it also includes code for IP camera which uses RPI (recommended to boot on start, use pm2)

## How to use?
First you need these following requirements:
- Node JS
- npm
- nodemon

## STEPS TO SETUP
1. Make sure the faces data are saved on the `bin/database/users`.
    - guidelines on adding faces for each students and its sections: `bin/database/users/<section>/<student name>/1.jpg`.
    - If more pictures are included, please number them as `1.jpg`, `2.jpg`, and so on.
    - Then, on `bin/database/` insert a javascript file, naming is not strict but its recommended `<GRADE><SECTION>-DATA.js`
    because it will be hardcoded onto the `bin/settings.js` under `const scriptList`.
    ```js
    // example: 12STEM-A-DATA.js
    if (!window.studentData) window.studentData = {};
    Object.assign(window.studentData,
        {
            "<NAME OF THE STUDENT>": {
                "pictures": [
                    "../../database/users/<SECTION>/<SHORT NAME OF STUDENT>/1.jpg",
                ],
                "information": {
                    "Grade Section": "<SECTION>",
                    "ID": "<ID NUMBER>"
                },
            }
        }
    )
    ```
    After that, proceed to the `bin/settings.js` and add the file name onto the `const scriptList` array.

2. Run the server by typing on the terminal `nodemon server.js`
    - NOTE: You need nodemon installed globally if not, install it `npm install -g nodemon`

3. After the server has completely setup and running, the app will do its job automatically registering the faces that
    are placed on the `bin/database/users` and create a cache for faster loading times next time its used.

4. That's all, NOTE: If you want more accurate* results try uncommenting the SsdMobileNet instead of the TinyFaceDetector on the `camera.js`.

## FEATURES etc...
- Can detect multiple faces (up to 5 people, more than that will cause too much processing but it depends on the system components, e.g GPU or CPU)
- Has triple User Interface, public ui, admin ui, and user ui (mobile ui)
- Can be used by USB Webcam or Built-in Webcam if IP Camera is not available.
- Uses excel as a database for marking attendance for easy readability for users/clients.
- Updates real-time information directly.

## Some things I want to say
- The project needs more optimization, e.g Spaghetti codez.
- Badly need to refactor into TypeScript instead of plain JS for better readability and maintainability.
- Badly data structure lmao.
- Need more refinement on the front-end as I don't like these designing with CSS (though I use LESS).
- Badly need to switch to WebRTC instead of SOCKET.IO as its more superior when it comes to live streaming video feed as SOCKET.IO is more on sending messages and not for huge continue flow or stream of big chunks of data repeatedly.
- Transfer the workload of detection processing on server-side instead of the browser.

## PREVIEW
![image](https://github.com/user-attachments/assets/538d1ae6-8682-48b1-92ad-62dfb1dfcf59)