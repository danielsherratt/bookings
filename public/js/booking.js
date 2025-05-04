const DAY = document.getElementById('day');
const TIME = document.getElementById('time');
const FIND = document.getElementById('find');
const RESULTS = document.getElementById('results');
const FORM_WRAPPER = document.getElementById('booking-form');
const TEACHER_NAME = document.getElementById('teacher-name');
const AVAILABLE_HEADING = document.getElementById('available-heading');
const POPUP = document.getElementById('confirmation-popup');
const CLOSE_BTN = POPUP.querySelector('.close-btn');

let selectedTeacher, selectedDate, selectedStart;

function pad(n) {
  return n.toString().padStart(2, '0');
}

function populateTimes() {
  TIME.innerHTML = '';
  for (let h = 8; h <= 16; h++) {
    [0,30].forEach(m => {
      if (h === 16 && m > 0) return;
      const t = `${pad(h)}:${pad(m)}`;
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = t;
      TIME.appendChild(opt);
    });
  }
}

function slotEndTime(start) {
  let [h, m] = start.split(':').map(Number);
  m += 30;
  if (m >= 60) {
    h++;
    m -= 60;
  }
  return `${pad(h)}:${pad(m)}`;
}

async function findTeachers() {
  RESULTS.textContent = 'Loading…';
  AVAILABLE_HEADING.style.display = 'none';

  const dow = Number(DAY.value);
  const start = TIME.value;
  const end = slotEndTime(start);

  // Compute next date for that day-of-week
  selectedDate = new Date();
  selectedDate.setDate(
    selectedDate.getDate() + ((dow + 7 - selectedDate.getDay()) % 7)
  );
  selectedStart = start;

  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch(`/api/bookings?date=${selectedDate.toISOString().slice(0,10)}`).then(r => r.json())
  ]);

  const avail = teachers.filter(t => {
    if (unavail.some(u =>
      u.teacher_id === t.id &&
      u.day_of_week === dow &&
      !(end <= u.start_time || start >= u.end_time)
    )) return false;
    if (bookings.some(b =>
      b.teacher_id === t.id &&
      !(end <= b.start_time || start >= b.end_time)
    )) return false;
    return true;
  });

  if (!avail.length) {
    RESULTS.innerHTML = '<p>No teachers available.</p>';
    return;
  }

  AVAILABLE_HEADING.style.display = 'block';
  RESULTS.innerHTML = avail.map(t =>
    `<button data-id="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');

  RESULTS.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      selectedTeacher = { id: Number(btn.dataset.id), name: btn.dataset.name };
      TEACHER_NAME.textContent = btn.dataset.name;
      FORM_WRAPPER.style.display = 'block';
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  populateTimes();
  FIND.onclick = findTeachers;

  CLOSE_BTN.onclick = () => {
    POPUP.style.display = 'none';
  };

  document.getElementById('form').onsubmit = async e => {
    e.preventDefault();
    const data = {
      teacher_id:   selectedTeacher.id,
      date:         selectedDate.toISOString().slice(0,10),
      start_time:   selectedStart,
      end_time:     slotEndTime(selectedStart),
      parent_name:  e.target.parent_name.value,
      parent_email: e.target.parent_email.value,
      student_name: e.target.student_name.value,
      school_name:  e.target.school_name.value
    };

    await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(data)
    });

    // Show confirmation popup
    POPUP.style.display = 'flex';
    FORM_WRAPPER.style.display = 'none';
    RESULTS.innerHTML = '';
    AVAILABLE_HEADING.style.display = 'none';
  };
});