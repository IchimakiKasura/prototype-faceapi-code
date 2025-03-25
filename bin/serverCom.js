const socket = io();

function fakeButton(name)
{
    socket.emit('fakeStudent', name);
}

/*
    if addRemove is true means it has violated, if its set to false
    then the violation is removed, its better this way than adding another
    function with the same process
*/
function setViolation(name, violation, bool) {
    socket.emit('setViolation', {
        name: name,
        violation: violation,
        bool: bool
    });
}

function addStudent(name)
{
    document.querySelectorAll(".student").forEach(el => el.classList.remove("selected"));
    let time = new Date().toLocaleString().replace(',', ' @');
    let imgSource = window.studentData[name].pictures[0]
    document.querySelector('#name_slot').textContent = name;
    document.querySelector('#studentPicture').src = imgSource;
    document.querySelector('#grade_section_slot').textContent = window.studentData[name].information['GradeSection']
    document.querySelector('#student_id_slot').textContent = window.studentData[name].information['ID']
    document.querySelector('#toe_slot').textContent = time

    document.querySelector(".scrollList").insertAdjacentHTML('afterbegin', template(name, time, imgSource, false, false, false));
}

// If the page was reset
async function LoadCurrentHistory() {
    try {
        const currentDate = new Date().toLocaleDateString().replaceAll('/','-');
        const res = await fetch(`/${currentDate}.xlsx`);
        
        if (res.status == 404) {
            return console.warn('NEW DAY DETECTED: Attendance for today will be created automatically.');
        }

        const attendanceData = await res.json();
        const historyContainer = document.querySelector(".scrollList");

        Object.keys(attendanceData).forEach(name => {
            const picture = window.studentData[name]?.pictures[0] || "default.jpg";
            const { time, violations } = attendanceData[name];

            historyContainer.innerHTML += template(
                name, 
                time,  // Now displays the correct recorded time
                picture, 
                violations.uniform, 
                violations.haircut, 
                violations.late
            );
        });

    } catch (error) {
        console.log('No history yet');
    }
}

function template(name, time, picture, uniform, haircut, late)
{
    return `
    <div id="studentContainer">
        <div class="student" time="${time}" uniform="${uniform}" haircut="${haircut}" late="${late}">
            <img height="50px" alt="studentPicture" src="${picture}">
            <p style="font-weight: bold;">${name}</p>
            <p style="font-weight: bold;"> |&nbsp;&nbsp;&nbsp;${window.studentData[name].information.GradeSection}</p>
            <p style="font-weight: bold;"> |&nbsp;&nbsp;&nbsp;${time.split('@')[1]}</p>
            </div>
    </div>`;
}