const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const attendanceFile = path.join(__dirname, 'bin/database/attendance', `${new Date().toLocaleDateString().replaceAll('/','-')}.xlsx`);

function readAttendance() {
    if (!fs.existsSync(attendanceFile)) return {};

    const workbook = XLSX.readFile(attendanceFile);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: false });

    // Convert array to object with names as keys
    return jsonData.reduce((acc, row) => {
        acc[row.NAME] = {
            gradeSection: row.SECTION,
            time: row.TIME || "Unknown Time", // Ensure time exists
            violations: {
                uniform: row.VIOLATIONS.includes("uniform"),
                late: row.VIOLATIONS.includes("late"),
                haircut: row.VIOLATIONS.includes("haircut")
            }
        };
        return acc;
    }, {});
}

function writeAttendance(data) {
    const jsonArray = Object.keys(data).map(name => ({
        NAME: name,
        SECTION: data[name].gradeSection,
        TIME: data[name].time,
        VIOLATIONS: Object.keys(data[name].violations)
            .filter(v => data[name].violations[v])
            .join(", ")
    }));

    const worksheet = XLSX.utils.json_to_sheet(jsonArray);

    // Set all columns to a width of 25
    worksheet['!cols'] = Array(4).fill({ wch: 25 });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");

    XLSX.writeFile(workbook, attendanceFile);
}

function registerStudent(name, section) {
    let attendance = readAttendance();

    if (attendance[name]) return false;

    attendance[name] = {
        gradeSection: section,
        time: new Date().toLocaleString().replace(',', ' @'), // Save timestamp
        violations: { uniform: false, late: false, haircut: false }
    };

    writeAttendance(attendance);
    console.log(`${name} is present.`);
    return true;
}

function setViolation(name, violationType, bool) {
    let attendance = readAttendance();

    if (!attendance[name]) return false;

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