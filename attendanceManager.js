const fs = require('fs');
const path = require('path');

const attendanceFile = path.join(__dirname, 'bin/database/attendance', `${new Date().toLocaleDateString().replaceAll('/','-')}.json`);

function readAttendance() {
    if (!fs.existsSync(attendanceFile)) return {};
    return JSON.parse(fs.readFileSync(attendanceFile, 'utf8'));
}

function writeAttendance(data) {
    fs.writeFileSync(attendanceFile, JSON.stringify(data, null, 2), 'utf8');
}

function registerStudent(name, section) {
    let attendance = readAttendance();

    // Prevent adding duplicate entries
    if (attendance[name]) return false; 

    const newAttendance = { 
        [name]: {
            gradeSection: section,
            time: new Date().toLocaleString().replace(',', ' @'),
            violations: { uniform: false, late: false, haircut: false }
        },
        ...attendance
    };

    writeAttendance(newAttendance);
    console.log(`${name} is present.`);

    return true;
}

function setViolation(name, violationType, bool) {
    let attendance = readAttendance();

    attendance[name].violations[violationType] = bool;
    writeAttendance(attendance);
    console.log(`Violation '${violationType}' set to ${bool} for ${name}.`);
}

function removeStudent(name) {
    let attendance = readAttendance();

    delete attendance[name];
    writeAttendance(attendance);
    console.log(`Removed ${name} from attendance.`);
}

module.exports = { registerStudent, setViolation, removeStudent };
