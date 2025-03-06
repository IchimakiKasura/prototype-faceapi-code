const { registerStudent, setViolation, removeStudent } = require('./attendanceManager'); // Import attendance functions
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');


module.exports = (server) =>
{
    const io = new Server(server);

    io.on('connection', (socket) => {

        /*
            It receives the video stream from the Desktop's webcam so Mobile users can access them
            though slight issue here is, it kinda lags when faceapi is processing but who knows
            how tf do I optimize this lobotomized code
        */
        socket.on('frame', (imageData) => {
            socket.broadcast.emit('stream', imageData);
        });

        // for face data cache
        socket.on('saveDescriptors', (data) => {
            const filePath = path.join(__dirname, 'bin/database/cache/faces.bin');
            fs.writeFileSync(filePath, data);
            socket.emit('cacheUpdated');
            console.log("Descriptors cached.");
        });

        socket.on('setViolation', ({ name, violation, bool }) => {
            setViolation(name, violation, bool);
            io.emit('refreshList')
        });
        socket.on('detectedFace', (name, section) => {
            const isSuccess = registerStudent(name,section)
            
            if(isSuccess)
            {
                io.emit('AddStudent', name)
                io.emit('refreshList')
            }
            
        });
        socket.on('fakeStudent', (name) => {
            removeStudent(name)
            io.emit('refreshList')
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id);
        });
    });

    return io;
}