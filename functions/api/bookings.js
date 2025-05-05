const TYPE    = document.getElementById('type');
const ZOOM_DIV = document.getElementById('zoom-controls');
const INP_DIV  = document.getElementById('inperson-controls');
const DAY1     = document.getElementById('day');
const TIME     = document.getElementById('time');
const DAY2     = document.getElementById('day2');
const SLOT_BTNS = document.querySelectorAll('.slot-btn');
const FIND     = document.getElementById('find');
const RESULTS  = document.getElementById('results');
const FORM_WR  = document.getElementById('booking-form');
const TNAME    = document.getElementById('teacher-name');
const POPUP    = document.getElementById('confirmation-popup');
const CLOSE    = POPUP.querySelector('.close-btn');

let selectedTeacher, selDate, selStart, selEnd;
let selectedSlot = 'am'; // default for in-person

function pad(n){ return n.toString().padStart(2,'0'); }
function populateTimes(){
  TIME.innerHTML = '';
  for(let h=8; h<=16; h++){
    [0,30].forEach(m => {
      if(h===16 && m>0) return;
      const t = `${pad(h)}:${pad(m)}`;
      TIME.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }
}
function slotEnd(s){
  let [h,m] = s.split(':').map(Number);
  m += 30;
  if(m>=60){ h++; m-=60; }
  return `${pad(h)}:${pad(m)}`;
}

// Toggle controls on type change
TYPE.onchange = () => {
  if(TYPE.value === 'zoom') {
    ZOOM_DIV.style.display = 'block';
    INP_DIV.style.display  = 'none';
  } else {
    ZOOM_DIV.style.display = 'none';
    INP_DIV.style.display  = 'block';
  }
};

// Slot button behavior
SLOT_BTNS.forEach(btn => {
  btn.onclick = () => {
    SLOT_BTNS.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedSlot = btn.dataset.slot; // 'am' or 'pm'
  };
});

// Main search
async function findTeachers(){
  RESULTS.textContent = 'Loading…';
  document.getElementById('available-heading').style.display = 'none';

  const teachers  = await fetch('/api/teachers').then(r=>r.json());
  const unavail   = await fetch('/api/unavailability').then(r=>r.json());

  let dow, start, end;

  if(TYPE.value === 'zoom'){
    dow   = +DAY1.value;
    start = TIME.value;
    end   = slotEnd(start);
  } else {
    dow = +DAY2.value;
    if(selectedSlot === 'am'){
      start = '08:30';
      end   = '12:30';
    } else {
      start = '12:30';
      end   = '16:30';
    }
  }

  // Compute next actual date
  selDate = new Date();
  selDate.setDate(
    selDate.getDate() + ((dow + 7 - selDate.getUTCDay()) % 7)
  );
  selStart = start;
  selEnd   = end;

  const bookings = await fetch(
    `/api/bookings?date=${selDate.toISOString().slice(0,10)}`
  ).then(r=>r.json());

  // Filter availability
  const avail = teachers.filter(t => {
    if(unavail.some(u =>
      u.teacher_id===t.id &&
      u.day_of_week===dow &&
      !(end <= u.start_time || start >= u.end_time)
    )) return false;
    if(bookings.some(b =>
      b.teacher_id===t.id &&
      !(end <= b.start_time || start >= b.end_time)
    )) return false;
    return true;
  });

  if(!avail.length){
    RESULTS.innerHTML = '<p>No teachers available.</p>';
    return;
  }

  document.getElementById('available-heading').style.display = 'block';
  RESULTS.innerHTML = avail.map(t =>
    `<button data-id="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');

  RESULTS.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      selectedTeacher = { id:+btn.dataset.id, name:btn.dataset.name };
      TNAME.textContent = btn.dataset.name;
      FORM_WR.style.display = 'block';
    };
  });
}

// Init
populateTimes();
findTeachers(); // optional auto-load?
FIND.onclick = findTeachers;
CLOSE.onclick = () => POPUP.style.display = 'none';

document.getElementById('form').onsubmit = async e => {
  e.preventDefault();
  const form = e.target;
  const data = {
    teacher_id:   selectedTeacher.id,
    date:         selDate.toISOString().slice(0,10),
    start_time:   selStart,
    end_time:     selEnd,
    parent_name:  form.parent_name.value,
    parent_email: form.parent_email.value,
    student_name: form.student_name.value,
    school_name:  form.school_name.value,
    booking_type: TYPE.value
  };
  await fetch('/api/bookings', {
    method: 'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(data)
  });
  POPUP.style.display = 'flex';
  FORM_WR.style.display = 'none';
  RESULTS.innerHTML = '';
};
