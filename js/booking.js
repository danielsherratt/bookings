const DAY = document.getElementById('day');
const TIME = document.getElementById('time');
const FIND = document.getElementById('find');
const RESULTS = document.getElementById('results');
const FORM_WRAPPER = document.getElementById('booking-form');
const TEACHER_NAME_SPAN = document.getElementById('teacher-name');
let selectedTeacher = null;
let selectedDate = null;
let selectedStart = null;

function populateTimes() {
  TIME.innerHTML = '';
  const pad = n => n.toString().padStart(2,'0');
  for (let h=8; h<=16; h++) {
    for (let m of [0,30]) {
      if (h===16 && m>0) break;
      const t = `${pad(h)}:${pad(m)}`;
      TIME.innerHTML += `<option value="${t}">${t}</option>`;
    }
  }
}

async function loadJSON(path) {
  return fetch(`data/${path}`).then(r=>r.json());
}

function slotEndTime(start) {
  let [h,m] = start.split(':').map(Number);
  m += 30;
  if (m >= 60) { h++; m -=60; }
  return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
}

async function findTeachers() {
  RESULTS.innerHTML = 'Loading…';
  const [teachers, unavail, bookings] = await Promise.all([
    loadJSON('teachers.json'),
    loadJSON('unavailability.json'),
    loadJSON('bookings.json')
  ]);

  const dow = +DAY.value;
  const start = TIME.value;
  const end = slotEndTime(start);
  selectedDate = new Date();
  selectedDate.setDate(
    selectedDate.getDate() + ((dow + 7 - selectedDate.getDay()) % 7)
  );
  selectedStart = start;

  const avail = teachers.filter(t => {
    const bad = unavail.some(u =>
      u.teacher_id===t.id &&
      u.day_of_week===dow &&
      !(end <= u.start_time || start >= u.end_time)
    );
    if (bad) return false;
    const clash = bookings.some(b =>
      b.teacher_id===t.id &&
      b.date === selectedDate.toISOString().slice(0,10) &&
      !(end <= b.start_time || start >= b.end_time)
    );
    return !clash;
  });

  if (!avail.length) {
    RESULTS.innerHTML = '<p>No teachers available.</p>';
    return;
  }

  RESULTS.innerHTML = avail.map(t =>
    `<button class="teacher-btn" data-id="${t.id}" data-name="${t.name}">
       ${t.name}
     </button>`
  ).join('');
  document.querySelectorAll('.teacher-btn').forEach(btn => {
    btn.onclick = () => {
      selectedTeacher = { id:+btn.dataset.id, name:btn.dataset.name };
      TEACHER_NAME_SPAN.textContent = btn.dataset.name;
      FORM_WRAPPER.style.display = 'block';
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  populateTimes();
  FIND.onclick = findTeachers;

  document.getElementById('form').onsubmit = e => {
    e.preventDefault();
    const data = {
      teacher_id: selectedTeacher.id,
      date: selectedDate.toISOString().slice(0,10),
      start_time: selectedStart,
      end_time: slotEndTime(selectedStart),
      parent_name: e.target.parent_name.value,
      student_name: e.target.student_name.value,
      school_name: e.target.school_name.value
    };
    console.log('Booking data:', data);
    alert('Booking submitted! (demo only)');
  };
});