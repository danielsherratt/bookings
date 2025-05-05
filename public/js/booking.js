// public/js/booking.js

const TYPE      = document.getElementById('type');
const ZOOM_DIV  = document.getElementById('zoom-controls');
const INP_DIV   = document.getElementById('inperson-controls');
const DAY1      = document.getElementById('day');
const TIME      = document.getElementById('time');
const DAY2      = document.getElementById('day2');
const SLOT_BTNS = document.querySelectorAll('.slot-btn');
const FIND      = document.getElementById('find');
const RESULTS   = document.getElementById('results');
const FORM_WR   = document.getElementById('booking-form');
const TNAME     = document.getElementById('teacher-name');
const POPUP     = document.getElementById('confirmation-popup');
const CLOSE     = POPUP.querySelector('.close-btn');
const FORM      = document.getElementById('form');

let selectedTeacher, selDate, selStart, selEnd;
let selectedSlot = 'am';

// Helpers
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
  m+=30; if(m>=60){ h++; m-=60; }
  return `${pad(h)}:${pad(m)}`;
}
async function safeFetchJson(url){
  try {
    const res = await fetch(url);
    if(!res.ok||res.status===204) return [];
    const text = await res.text();
    return text? JSON.parse(text): [];
  } catch(err){
    console.error(`safeFetchJson ${url} error`,err);
    return [];
  }
}

// Find available teachers
async function findTeachers(){
  RESULTS.textContent = 'Loading…';
  document.getElementById('available-heading').style.display = 'none';

  // Determine window
  let dow, start, end;
  if(TYPE.value==='zoom'){
    dow   = +DAY1.value;
    start = TIME.value;
    end   = slotEnd(start);
  } else {
    dow = +DAY2.value;
    if(selectedSlot==='am'){ start='08:30'; end='12:30'; }
    else                { start='12:30'; end='16:30'; }
  }

  // Compute next date
  const now = new Date();
  now.setDate(now.getDate()+((dow+7-now.getUTCDay())%7));
  selDate  = now;
  selStart = start;
  selEnd   = end;
  const iso = now.toISOString().slice(0,10);

  // Fetch all data
  const [teachers, unavail, bookings] = await Promise.all([
    safeFetchJson('/api/teachers'),
    safeFetchJson('/api/unavailability'),
    safeFetchJson(`/api/bookings?date=${iso}`)
  ]);

  // Filter
  const avail = teachers.filter(t=>{
    if(unavail.some(u=>
      u.teacher_id===t.id &&
      u.day_of_week===dow &&
      !(end<=u.start_time||start>=u.end_time)
    )) return false;
    if(bookings.some(b=>
      b.teacher_id===t.id &&
      !(end<=b.start_time||start>=b.end_time)
    )) return false;
    return true;
  });

  if(!avail.length){
    RESULTS.innerHTML = '<p>No teachers available.</p>';
    return;
  }

  document.getElementById('available-heading').style.display='block';
  RESULTS.innerHTML = avail.map(t=>
    `<button data-id="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');

  // Select teacher
  RESULTS.querySelectorAll('button').forEach(btn=>{
    btn.addEventListener('click',()=>{
      selectedTeacher={id:+btn.dataset.id,name:btn.dataset.name};
      TNAME.textContent=btn.dataset.name;
      FORM_WR.style.display='block';
    });
  });
}

// Re-run on any change
TYPE.addEventListener('change',()=>{
  ZOOM_DIV.style.display = TYPE.value==='zoom' ? 'block' : 'none';
  INP_DIV.style.display  = TYPE.value==='inperson' ? 'block' : 'none';
  findTeachers();
});
DAY1.addEventListener('change', findTeachers);
TIME.addEventListener('change', findTeachers);
DAY2.addEventListener('change', findTeachers);
SLOT_BTNS.forEach(btn=>{
  btn.addEventListener('click',()=>{
    SLOT_BTNS.forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    selectedSlot = btn.dataset.slot;
    findTeachers();
  });
});

// Initialize
populateTimes();
TYPE.dispatchEvent(new Event('change'));
SLOT_BTNS[0].click();
FIND.addEventListener('click', findTeachers);

// Close popup + reload
CLOSE.addEventListener('click',()=>{
  POPUP.style.display='none';
  window.location.reload();
});

// Form submit
FORM.addEventListener('submit', async e=>{
  e.preventDefault();
  const f = e.target;
  // Build payload
  const payload = {
    teacher_id:   selectedTeacher.id,
    date:         selDate.toISOString().slice(0,10),
    start_time:   selStart,
    end_time:     selEnd,
    parent_name:  f.parent_name.value,
    parent_email: f.parent_email.value,
    student_name: f.student_name.value,
    school_name:  f.school_name.value,
    booking_type: TYPE.value              // direct read
  };
  console.log('Booking payload:', payload);

  const res = await fetch('/api/bookings',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify(payload)
  });
  console.log('Booking API status:', res.status);
  const txt = await res.text();
  console.log('Booking API response body:', txt);

  POPUP.style.display='flex';
  FORM_WR.style.display='none';
  RESULTS.innerHTML='';
});
