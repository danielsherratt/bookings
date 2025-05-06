// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {

    // ——— Preferences ———
    const prefForm  = document.getElementById('preferences-form');
    const inpClass  = document.getElementById('pref-classification');
    const inpPrimary   = document.getElementById('pref-primary-color');
    const inpSecondary = document.getElementById('pref-secondary-color');
  
    // Fetch and populate preferences, then apply CSS variables & labels
    fetch('/api/preferences')
      .then(r => r.json())
      .then(p => {
        inpClass.value     = p.staff_classification;
        inpPrimary.value   = p.primary_color;
        inpSecondary.value = p.secondary_color;
        applyPreferences(p);
      });


  // Wire up Preferences form
  document.getElementById('preferences-form').onsubmit = savePreferences;

  // Wire up other forms/buttons
  document.getElementById('add-teacher-form').onsubmit = addTeacher;
  document.getElementById('add-unavail').onclick    = addUnavailability;
  document.getElementById('export-csv').onclick     = exportBookingsCSV;

  // Initial data load
  reloadAdmin();
});

async function reloadAdmin() {
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch('/api/bookings').then(r => r.json())
  ]);

  const teacherMap  = Object.fromEntries(teachers.map(t => [t.id, t.name]));
  const locationMap = Object.fromEntries(teachers.map(t => [t.id, t.location]));

  renderTeachers(teachers);
  renderUnavailability(unavail, teacherMap);
  renderBookings(bookings, teacherMap, locationMap);

  // Populate teacher dropdown for Unavailability
  document.getElementById('teacher-unavail').innerHTML =
    teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
}

function renderTeachers(teachers) {
  const tt = document.getElementById('teachers-table');
  tt.innerHTML = teachers.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.name}</td>
      <td>${t.location || ''}</td>
      <td>
        <button class="delete-teacher-btn" data-id="${t.id}">Delete</button>
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-teacher-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this teacher and all related data?')) return;
      await fetch('/api/teachers', {
        method: 'DELETE',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ id: +btn.dataset.id })
      });
      reloadAdmin();
    };
  });
}

function renderUnavailability(unavail, teacherMap) {
  const ut = document.getElementById('unavail-table');
  const dayNames = {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday'};
  ut.innerHTML = unavail.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${teacherMap[u.teacher_id] || u.teacher_name}</td>
      <td>${dayNames[u.day_of_week]}</td>
      <td>${u.start_time}–${u.end_time}</td>
      <td>
        <button class="delete-unavail-btn" data-id="${u.id}">Delete</button>
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-unavail-btn').forEach(btn => {
    btn.onclick = async () => {
      await fetch('/api/unavailability', {
        method: 'DELETE',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ id: +btn.dataset.id })
      });
      reloadAdmin();
    };
  });
}

function renderBookings(bookings, teacherMap, locationMap) {
  const bt = document.getElementById('bookings-table');
  if (!bookings.length) {
    bt.innerHTML = '<tr><td colspan="11">No bookings</td></tr>';
    return;
  }
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  bt.innerHTML = bookings.map(b => {
    const dayName = weekdayNames[new Date(b.booking_date).getUTCDay()];
    const time    = `${b.start_time}–${b.end_time}`;
    const type    = b.booking_type === 'zoom' ? 'Zoom' : 'In Person';
    const loc     = type === 'Zoom'
      ? 'Zoom'
      : (b.booking_location || locationMap[b.teacher_id] || '');
    return `
      <tr>
        <td>${b.id}</td>
        <td>${teacherMap[b.teacher_id] || b.teacher_name}</td>
        <td>${dayName}</td>
        <td>${time}</td>
        <td>${type}</td>
        <td>${loc}</td>
        <td>${b.parent_name}</td>
        <td>${b.parent_email}</td>
        <td>${b.student_name}</td>
        <td>${b.school_name}</td>
        <td>
          <button class="delete-booking-btn" data-id="${b.id}">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
  document.querySelectorAll('.delete-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this booking?')) return;
      await fetch('/api/bookings', {
        method: 'DELETE',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id: +btn.dataset.id })
      });
      reloadAdmin();
    };
  });
}

async function addTeacher(e) {
  e.preventDefault();
  const name     = document.getElementById('new-teacher-name').value.trim();
  const location = document.getElementById('new-teacher-location').value.trim();
  if (!name || !location) return alert('Provide both name and location.');
  await fetch('/api/teachers', {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ name, location })
  });
  e.target.reset();
  reloadAdmin();
}

async function addUnavailability() {
  const teacher_id = +document.getElementById('teacher-unavail').value;
  const days = Array.from(
    document.querySelectorAll('input[name="unavail-day"]:checked')
  ).map(cb => +cb.value);
  const start_time = document.getElementById('start-unavail').value;
  const end_time   = document.getElementById('end-unavail').value;
  if (!days.length) return alert('Select at least one day.');
  await Promise.all(days.map(day =>
    fetch('/api/unavailability', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ teacher_id, day_of_week: day, start_time, end_time })
    })
  ));
  reloadAdmin();
}

async function exportBookingsCSV() {
  const [bookings, teachers] = await Promise.all([
    fetch('/api/bookings').then(r => r.json()),
    fetch('/api/teachers').then(r => r.json())
  ]);
  if (!bookings.length) return alert('No bookings to export.');

  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const headers = ['ID','Teacher','Day','Start Time','End Time','Type','Location','Parent','Email','Student','School'];

  const rows = bookings.map(b => {
    const dayName = weekdayNames[new Date(b.booking_date).getUTCDay()];
    const type    = b.booking_type === 'zoom' ? 'Zoom' : 'In Person';
    const loc     = type === 'Zoom' ? 'Zoom' : (b.booking_location || '');
    return [
      b.id,
      teacherMap[b.teacher_id] || b.teacher_name,
      dayName,
      b.start_time,
      b.end_time,
      type,
      loc,
      b.parent_name,
      b.parent_email,
      b.student_name,
      b.school_name
    ];
  });

  const csv = [headers, ...rows].map(r =>
    r.map(cell => {
      const field = cell != null ? String(cell) : '';
      return `"${field.replace(/"/g,'""')}"`;
    }).join(',')
  ).join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `bookings_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function savePreferences(e) {
  e.preventDefault();
  const staff_classification = document.getElementById('pref-classification').value.trim();
  const primary_color        = document.getElementById('pref-primary-color').value;
  const secondary_color      = document.getElementById('pref-secondary-color').value;
  await fetch('/api/preferences', {
    method: 'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ staff_classification, primary_color, secondary_color })
  });
  alert('Preferences saved.');
}
