// public/js/booking.js

const TYPE        = document.getElementById('type');
const ZOOM_DIV    = document.getElementById('zoom-controls');
const INP_DIV     = document.getElementById('inperson-controls');
const DAY1        = document.getElementById('day');
const TIME        = document.getElementById('time');
const DAY2        = document.getElementById('day2');
const SLOT_SELECT = document.getElementById('slot-select');
const LOC_SELECT  = document.getElementById('location-select');
const RESULTS     = document.getElementById('results');
const FORM_WR     = document.getElementById('booking-form');
const TNAME       = document.getElementById('teacher-name');
const POPUP       = document.getElementById('confirmation-popup');
const CLOSE       = POPUP.querySelector('.close-btn');
const FORM        = document.getElementById('form');

let selectedTeacher, selDate, selStart, selEnd;

// Helper to pad two digits
function pad(n){ return String(n).padStart(2,'0'); }

// Convert "HH:MM" → "h:MM AM/PM"
function format12(hm) {
  let [h,m] = hm.split(':').map(Number);
  const ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12 || 12;
  return `${h}:${pad(m)} ${ampm}`;
}

// Get zoom duration from preferences (fallback to 30)
function getZoomDuration() {
  return (window.bookingPrefs && bookingPrefs.zoom_duration) || 30;
}

// Populate the TIME dropdown from 8:30 to 16:30 in zoom_duration steps
function populateTimes() {
  TIME.innerHTML = '';
  const step = getZoomDuration();
  // start at 8:30 → minutes since midnight = 8*60+30
  let total = 8*60 + 30;
  const endTotal = 16*60 + 30;
  while (total <= endTotal) {
    const h = Math.floor(total/60);
    const m = total % 60;
    const val = `${pad(h)}:${pad(m)}`;
    TIME.innerHTML += `<option value="${val}">${format12(val)}</option>`;
    total += step;
  }
}

// Compute end time = start + zoom_duration minutes
function slotEnd(start) {
  const [h,m] = start.split(':').map(Number);
  const total = h*60 + m + getZoomDuration();
  const eh = Math.floor(total/60);
  const em = total % 60;
  return `${pad(eh)}:${pad(em)}`;
}

async function safeFetchJson(url) {
  try {
    const r = await fetch(url);
    if (!r.ok || r.status === 204) return [];
    const t = await r.text();
    return t ? JSON.parse(t) : [];
  } catch {
    return [];
  }
}

async function populateLocations() {
  const teachers = await safeFetchJson('/api/teachers');
  const locs = [...new Set(teachers.map(t=>t.location).filter(l=>l))];
  LOC_SELECT.innerHTML = locs.map(l=>`<option>${l}</option>`).join('');
}

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
    if (SLOT_SELECT.value==='am') {
      start = '08:30'; end = '12:30';
    } else {
      start = '12:30'; end = '16:30';
    }
  }

  const now = new Date();
  now.setDate(now.getDate() + ((dow + 7 - now.getUTCDay()) % 7));
  selDate  = now;
  selStart = start;
  selEnd   = end;
  const iso = now.toISOString().slice(0,10);

  const [teachers, unavail, bookings] = await Promise.all([
    safeFetchJson('/api/teachers'),
    safeFetchJson('/api/unavailability'),
    safeFetchJson(`/api/bookings?date=${iso}`)
  ]);

  let avail = teachers.filter(t => {
    if (unavail.some(u =>
      u.teacher_id===t.id &&
      u.day_of_week===dow &&
      !(end <= u.start_time || start >= u.end_time)
    )) return false;
    if (bookings.some(b =>
      b.teacher_id===t.id &&
      !(end <= b.start_time || start >= b.end_time)
    )) return false;
    return true;
  });

  if (TYPE.value==='inperson') {
    avail = avail.filter(t => t.location===LOC_SELECT.value);
  }

  if (!avail.length) {
    RESULTS.innerHTML = `<p>Sorry, no NZSL Tutor is available</p>`;
    return;
  }

  document.getElementById('available-heading').style.display = 'block';
  RESULTS.innerHTML = avail.map(t =>
    `<button class="teacher-btn" data-id="${t.id}" data-name="${t.name}">${t.name}</button>`
  ).join('');

  RESULTS.querySelectorAll('.teacher-btn').forEach(btn => {
    btn.onclick = () => {
      RESULTS.querySelectorAll('.teacher-btn').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedTeacher = { id:+btn.dataset.id, name:btn.dataset.name };
      document.getElementById('teacher-name').textContent = btn.dataset.name;
      FORM_WR.style.display = 'block';
    };
  });
}

// Re-run when type or controls change
TYPE.addEventListener('change', () => {
  ZOOM_DIV.style.display = TYPE.value==='zoom' ? 'block' : 'none';
  INP_DIV.style.display  = TYPE.value==='inperson' ? 'block' : 'none';
  findTeachers();
});
DAY1.addEventListener('change', findTeachers);
TIME.addEventListener('change', findTeachers);
DAY2.addEventListener('change', findTeachers);
SLOT_SELECT.addEventListener('change', findTeachers);
LOC_SELECT.addEventListener('change', findTeachers);

// Close popup & reload
POPUP.querySelector('.close-btn').onclick = () => window.location.reload();

// Submit booking
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
    booking_location: TYPE.value==='inperson' ? LOC_SELECT.value : 'Zoom'
  };

  const res = await fetch('/api/bookings', {
    method:  'POST',
    headers: { 'Content-Type':'application/json' },
    body:    JSON.stringify(payload)
  });

  POPUP.querySelector('p').textContent =
    res.status===201
      ? 'Success! Ko Taku Reo will be in touch to confirm the booking'
      : 'Sorry, the booking was just taken by someone else';
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
