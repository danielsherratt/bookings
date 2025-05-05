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

function pad(n) { return n.toString().padStart(2,'0'); }

function populateTimes() {
  TIME.innerHTML = '';
  for (let h = 8; h <= 16; h++) {
    [0,30].forEach(m => {
      if (h === 16 && m > 0) return;
      const t = `${pad(h)}:${pad(m)}`;
      TIME.innerHTML += `<option value="${t}">${t}</option>`;
    });
  }
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

async function populateLocations() {
  const teachers = await safeFetchJson('/api/teachers');
  const locations = [...new Set(
    teachers
      .map(t => t.location)
      .filter(loc => typeof loc === 'string' && loc.trim() !== '')
  )];
  LOC_SELECT.innerHTML = locations
    .map(loc => `<option value="${loc}">${loc}</option>`)
    .join('');
}

function slotEnd(s) {
  let [h,m] = s.split(':').map(Number);
  m += 30; if (m >= 60) { h++; m -= 60; }
  return `${pad(h)}:${pad(m)}`;
}

async function findTeachers() {
  RESULTS.textContent = 'Loading…';
  document.getElementById('available-heading').style.display = 'none';

  // Determine day & time window
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

  // Compute next actual date
  const now = new Date();
  now.setDate(now.getDate() + ((dow + 7 - now.getUTCDay()) % 7));
  selDate  = now;
  selStart = start;
  selEnd   = end;
  const iso = now.toISOString().slice(0,10);

  // Fetch data
  const [teachers, unavail, bookings] = await Promise.all([
    safeFetchJson('/api/teachers'),
    safeFetchJson('/api/unavailability'),
    safeFetchJson(`/api/bookings?date=${iso}`)
  ]);

  // Filter availability by schedule
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

  // If In Person, filter by selected location
  if (TYPE.value === 'inperson') {
    avail = avail.filter(t => t.location === LOC_SELECT.value);
  }

  if (!avail.length) {
    RESULTS.innerHTML = '<p>No teachers available.</p>';
    return;
  }

  document.getElementById('available-heading').style.display = 'block';
  RESULTS.innerHTML = avail
    .map(t => `<button data-id="${t.id}" data-name="${t.name}">${t.name}</button>`)
    .join('');

  RESULTS.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTeacher = { id:+btn.dataset.id, name:btn.dataset.name };
      TNAME.textContent = btn.dataset.name;
      FORM_WR.style.display = 'block';
    });
  });
}

// Re-run search on controls change
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

// Close popup and reload
CLOSE.addEventListener('click', () => {
  POPUP.style.display = 'none';
  window.location.reload();
});

// Handle booking form submission
FORM.addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const payload = {
    teacher_id:   selectedTeacher.id,
    date:         selDate.toISOString().slice(0,10),
    start_time:   selStart,
    end_time:     selEnd,
    parent_name:  f.parent_name.value,
    parent_email: f.parent_email.value,
    student_name: f.student_name.value,
    school_name:  f.school_name.value,
    booking_type: TYPE.value,
    booking_location: TYPE.value === 'inperson' ? LOC_SELECT.value : null
  };

  await fetch('/api/bookings', {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });

  POPUP.style.display = 'flex';
  FORM_WR.style.display = 'none';
  RESULTS.innerHTML = '';
});

// Initialization
(async function init() {
  populateTimes();
  await populateLocations();
  TYPE.dispatchEvent(new Event('change'));
})();
