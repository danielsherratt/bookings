// public/js/booking.js

const TYPE          = document.getElementById('type');
const ZOOM_DIV      = document.getElementById('zoom-controls');
const INP_DIV       = document.getElementById('inperson-controls');
const DAY1          = document.getElementById('day');
const TIME          = document.getElementById('time');
const DAY2          = document.getElementById('day2');
const SLOT_SELECT   = document.getElementById('slot-select');
const LOC_SELECT    = document.getElementById('location-select');
const FIND          = document.getElementById('find');
const RESULTS       = document.getElementById('results');
const FORM_WR       = document.getElementById('booking-form');
const TNAME         = document.getElementById('teacher-name');
const POPUP         = document.getElementById('confirmation-popup');
const CLOSE         = POPUP.querySelector('.close-btn');
const FORM          = document.getElementById('form');

let selectedTeacher, selDate, selStart, selEnd;

// Utility: pad two digits
function pad(n) { return String(n).padStart(2,'0'); }

// Convert "HH:MM" → "h:MM AM/PM"
function format12(hm) {
  let [h, m] = hm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${pad(m)} ${ampm}`;
}

// Populate the <select id="time"> with 30-min slots from 8:30 to 16:00
function populateTimes() {
  TIME.innerHTML = '';
  for (let h = 8; h <= 16; h++) {
    [0,30].forEach(m => {
      if (h === 16 && m > 0) return;
      const value = `${pad(h)}:${pad(m)}`;
      const label = format12(value);
      TIME.innerHTML += `<option value="${value}">${label}</option>`;
    });
  }
}

// As before: compute end = 30min after start
function slotEnd(start) {
  let [h,m] = start.split(':').map(Number);
  m += 30; if (m >= 60) { h++; m -= 60; }
  return `${pad(h)}:${pad(m)}`;
}

async function safeFetchJson(url) {
  try {
    const res = await fetch(url);
    if (!res.ok || res.status === 204) return [];
    const text = await res.text();
    return text ? JSON.parse(text) : [];
  } catch {
    return [];
  }
}

// Pull distinct locations from /api/teachers
async function populateLocations() {
  const teachers = await safeFetchJson('/api/teachers');
  const locations = [...new Set(
    teachers.map(t => t.location).filter(l => l)
  )];
  LOC_SELECT.innerHTML = locations
    .map(l => `<option value="${l}">${l}</option>`)
    .join('');
}

// Main availability search
async function findTeachers() {
  RESULTS.textContent = 'Loading…';
  document.getElementById('available-heading').style.display = 'none';

  let dow, start, end;
  if (TYPE.value === 'zoom') {
    dow   = +DAY1.value;
    start = TIME.value;
    end   = slotEnd(start);
  } else {
    dow = +DAY2.value;
    if (SLOT_SELECT.value === 'am') {
      start = '08:30'; end = '12:30';
    } else {
      start = '12:30'; end = '16:30';
    }
  }

  const dateObj = new Date();
  dateObj.setDate(dateObj.getDate() + ((dow + 7 - dateObj.getUTCDay()) % 7));
  selDate  = dateObj;
  selStart = start;
  selEnd   = end;
  const isoDate = dateObj.toISOString().slice(0,10);

  const [teachers, unavail, bookings] = await Promise.all([
    safeFetchJson('/api/teachers'),
    safeFetchJson('/api/unavailability'),
    safeFetchJson(`/api/bookings?date=${isoDate}`)
  ]);

  // Filter out unavailable/unbooked
  let avail = teachers.filter(t => {
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

  // If in-person, filter by selected location
  if (TYPE.value === 'inperson') {
    avail = avail.filter(t => t.location === LOC_SELECT.value);
  }

  if (!avail.length) {
    RESULTS.innerHTML = '<p>No teachers available.</p>';
    return;
  }

  document.getElementById('available-heading').style.display = 'block';
  RESULTS.innerHTML = avail.map(t =>
    `<button class="teacher-btn" data-id="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');

  RESULTS.querySelectorAll('.teacher-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // mark selection
      RESULTS.querySelectorAll('.teacher-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');

      selectedTeacher = { id:+btn.dataset.id, name:btn.dataset.name };
      TNAME.textContent = btn.dataset.name;
      FORM_WR.style.display = 'block';
    });
  });
}

// Re-run on controls change
TYPE.addEventListener('change', () => {
  ZOOM_DIV.style.display = TYPE.value === 'zoom' ? 'block' : 'none';
  INP_DIV.style.display  = TYPE.value === 'inperson' ? 'block' : 'none';
  findTeachers();
});
DAY1.addEventListener('change', findTeachers);
TIME.addEventListener('change', findTeachers);
DAY2.addEventListener('change', findTeachers);
SLOT_SELECT.addEventListener('change', findTeachers);
LOC_SELECT.addEventListener('change', findTeachers);

// Close popup reloads
CLOSE.addEventListener('click', () => window.location.reload());

// Booking form submission
FORM.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    teacher_id:       selectedTeacher.id,
    date:             selDate.toISOString().slice(0,10),
    start_time:       selStart,
    end_time:         selEnd,
    parent_name:      f.parent_name.value,
    parent_email:     f.parent_email.value,
    student_name:     f.student_name.value,
    school_name:      f.school_name.value,
    booking_type:     TYPE.value,
    booking_location: TYPE.value === 'inperson' ? LOC_SELECT.value : 'Zoom'
  };

  const res = await fetch('/api/bookings', {
    method:  'POST',
    headers: { 'Content-Type':'application/json' },
    body:    JSON.stringify(payload)
  });

  // Show success or conflict
  const msg = res.status === 201
    ? 'Booking created successfully!'
    : 'Sorry, the booking has already been taken';
  POPUP.querySelector('.modal-content p').textContent = msg;

  POPUP.style.display   = 'flex';
  FORM_WR.style.display = 'none';
  RESULTS.innerHTML     = '';
});

// Initialize
(async function init() {
  populateTimes();
  await populateLocations();
  TYPE.dispatchEvent(new Event('change'));
})();
