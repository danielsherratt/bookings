const DAY = document.getElementById('day'),
      TIME = document.getElementById('time'),
      FIND = document.getElementById('find'),
      RESULTS = document.getElementById('results'),
      FORM_WRAPPER = document.getElementById('booking-form'),
      TEACHER_NAME = document.getElementById('teacher-name');

let selectedTeacher, selectedDate, selectedStart;

function pad(n){return n.toString().padStart(2,'0');}
function populateTimes(){
  TIME.innerHTML = '';
  for (let h=8; h<=16; h++) {
    [0,30].forEach(m=>{
      if (h===16 && m>0) return;
      const t = `${pad(h)}:${pad(m)}`;
      TIME.innerHTML += `<option>${t}</option>`;
    });
  }
}
function slotEndTime(s){
  let [h,m]=s.split(':').map(Number);
  m+=30; if(m>=60){h++; m-=60;}
  return `${pad(h)}:${pad(m)}`;
}

async function findTeachers(){
  RESULTS.textContent = 'Loading…';
  const dow   = +DAY.value,
        start = TIME.value,
        end   = slotEndTime(start);

  // compute next date for that DOW
  selectedDate = new Date();
  selectedDate.setDate(
    selectedDate.getDate() + ((dow + 7 - selectedDate.getDay()) % 7)
  );
  selectedStart = start;

  // fetch from API
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r=>r.json()),
    fetch('/api/unavailability').then(r=>r.json()),
    fetch(`/api/bookings?date=${selectedDate.toISOString().slice(0,10)}`).then(r=>r.json())
  ]);

  const avail = teachers.filter(t=>{
    // check unavailability
    if (unavail.some(u=>
      u.teacher_id===t.id &&
      u.day_of_week===dow &&
      !(end<=u.start_time|| start>=u.end_time)
    )) return false;
    // check existing booking
    if (bookings.some(b=>
      b.teacher_id===t.id &&
      !(end<=b.start_time|| start>=b.end_time)
    )) return false;
    return true;
  });

  if (!avail.length) return RESULTS.innerHTML = '<p>No teachers available.</p>';
  RESULTS.innerHTML = avail.map(t=>
    `<button data-id="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');
  RESULTS.querySelectorAll('button').forEach(btn=>{
    btn.onclick = ()=>{
      selectedTeacher={id:+btn.dataset.id,name:btn.dataset.name};
      TEACHER_NAME.textContent=btn.dataset.name;
      FORM_WRAPPER.style.display='block';
    };
  });
}

document.addEventListener('DOMContentLoaded', ()=>{
  populateTimes();
  FIND.onclick = findTeachers;
  document.getElementById('form').onsubmit = async e=>{
    e.preventDefault();
    const body = {
      teacher_id:  selectedTeacher.id,
      date:        selectedDate.toISOString().slice(0,10),
      start_time:  selectedStart,
      end_time:    slotEndTime(selectedStart),
      parent_name: e.target.parent_name.value,
      student_name:e.target.student_name.value,
      school_name: e.target.school_name.value
    };
    await fetch('/api/bookings', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    alert('Booking created!');
    FORM_WRAPPER.style.display='none';
    RESULTS.innerHTML='';
  };
});
