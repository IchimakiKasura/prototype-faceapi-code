const socket = io();

window.addEventListener('load', LoadCurrentHistory);

function fakeButton(name)
{
    socket.emit('fakeStudent', name);
}

// if addRemove is true means it has violated, if its set to false
// then the violation is removed, its better this way than adding another
// function with the same process
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
    let imgSource = window.studentData[name].pictures[0]
    document.querySelector('#name_slot').textContent = name;
    document.querySelector('#studentPicture').src = imgSource;
    document.querySelector('#grade_section_slot').textContent = window.studentData[name].information['GradeSection']
    document.querySelector('#student_id_slot').textContent = window.studentData[name].information['ID']
    document.querySelector('#toe_slot').textContent = new Date().toLocaleString().replace(',', ' @')

    const template = `
    <div id="studentContainer">
        <div class="student selected" time="${new Date().toLocaleString().replace(',', ' @')}" uniform="false" haircut="false" late="false">
            <img height="50px" alt="studentPicture" src="${imgSource}">
            <p style="font-weight: bold;">${name}</p>
        </div>
    </div>`;

    document.querySelector(".scrollList").insertAdjacentHTML('afterbegin', template);
}

// If the page was reset
async function LoadCurrentHistory()
{
    try {
        const currentDate = new Date().toLocaleDateString().replaceAll('/','-');
        const res = await fetch(`/${currentDate}.json`)
        
        if(res.status == 404)
            return console.warn('NEW DAY DETECTED: Attendance for today is now being created.')

        const attendanceData = await res.json();

        const historyContainer = document.querySelector(".scrollList");

        
        Object.keys(attendanceData).forEach(name=>{

            const picture = window.studentData[name].pictures[0],
                haircut = attendanceData[name].violations.haircut,
                late = attendanceData[name].violations.late,
                uniform = attendanceData[name].violations.uniform,
                time = attendanceData[name].time;

            const template = `
                <div id="studentContainer">
                    <div class="student" time="${time}" uniform="${uniform}" haircut="${haircut}" late="${late}">
                        <img height="50px" alt="studentPicture" src="${picture}">
                        <p style="font-weight: bold;">${name}</p>
                    </div>
                </div>
            `;

            historyContainer.innerHTML += template;
        });

    } catch (error) {
        console.log('No history yet')
    }
}
