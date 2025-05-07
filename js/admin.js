// public/js/admin.js

// Flags for filtering bookings
let prefShowZoom = true;
let prefShowInperson = true;

document.addEventListener('DOMContentLoaded', async () => {
  // 1) Load & apply preferences (including show/hide and classification)
  await loadPreferences();

  // 2) Wire up Preferences form
  document.getElementById('preferences-form').onsubmit = savePreferences;

  // 3) Wire up other forms/buttons
  document.getElementById('add-teacher-form').onsubmit = addTeacher;
  document.getElementById('add-unavail').onclick       = addUnavailability;
  document.getElementById('export-csv').onclick        = exportBookingsCSV;

  // 4) Initial data load
  reloadAdmin();
});

async function loadPreferences() {
  try {
    const res = await fetch('/api/preferences');
    if (!res.ok) return;
    const p = await res.json();

    // Apply colour scheme
    document.documentElement.style.setProperty('--primary-color',   p.primary_color);
    document.documentElement.style.setProperty('--secondary-color', p.secondary_color);

    // Populate the Preferences form fields
    document.getElementById('pref-classification').value    = p.staff_classification;
    document.getElementById('pref-primary-color').value     = p.primary_color;
    document.getElementById('pref-secondary-color').value   = p.secondary_color;
    document.getElementById('pref-page-heading').value      = p.page_heading;
    document.getElementById('pref-zoom-duration').value     = p.zoom_duration;
    document.getElementById('pref-inperson-duration').value = p.inperson_duration;

    // Show/hide flags
    prefShowZoom      = !!p.show_zoom;
    prefShowInperson  = !!p.show_inperson;
    document.getElementById('pref-show-zoom').checked      = prefShowZoom;
    document.getElementById('pref-show-inperson').checked  = prefShowInperson;

    // Update headings & labels with classification
    const cls = p.staff_classification;
    document.getElementById('manage-teachers-heading')
            .textContent = `Manage ${cls}s`;
    document.getElementById('unavail-heading')
            .textContent = `Set ${cls} Unavailability`;
    document.getElementById('existing-unavail-heading')
            .textContent = `Existing ${cls} Unavailability`;
    document.getElementById('existing-bookings-heading')
            .textContent = `Existing Bookings`;
    document.getElementById('new-teacher-name')
            .placeholder = `${cls} Name`;
    document.querySelector('label[for="teacher-unavail"]')
            .textContent = `${cls}:`;

    // Update table headers for the three tables
    document.getElementById('th-manage-teacher').textContent  = cls;
    document.getElementById('th-unavail-teacher').textContent = cls;
    document.getElementById('th-bookings-teacher').textContent= cls;

  } catch (e) {
    console.error('Could not load preferences', e);
  }
}

async function savePreferences(e) {
  e.preventDefault();
  const payload = {
    staff_classification: document.getElementById('pref-classification').value.trim(),
    primary_color:        document.getElementById('pref-primary-color').value,
    secondary_color:      document.getElementById('pref-secondary-color').value,
    page_heading:         document.getElementById('pref-page-heading').value.trim(),
    zoom_duration:        parseInt(document.getElementById('pref-zoom-duration').value, 10),
    inperson_duration:    parseInt(document.getElementById('pref-inperson-duration').value, 10),
    show_zoom:            document.getElementById('pref-show-zoom').checked ? 1 : 0,
    show_inperson:        document.getElementById('pref-show-inperson').checked ? 1 : 0
  };
  await fetch('/api/preferences', {
    method: 'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  alert('Preferences saved.');
  // Re-apply preferences and refresh data
  await loadPreferences();
  reloadAdmin();
}

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
  const nt = document.getElementById('teachers-table');
  // If no Staff, show a single row with "No Staff"
  if (!teachers.length) {
    nt.innerHTML = '<tr><td colspan="11">No one works here yet <i class="fa-solid fa-face-sad-tear"></i></td></tr>';
    return;
  }
  const tt = document.getElementById('teachers-table');
  tt.innerHTML = teachers.map(t => `
    <tr>
      <td>${t.name}</td>
      <td>${t.location || ''}</td>
      <td>
        <button class="delete-teacher-btn" data-id="${t.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-teacher-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this teacher and all related data?')) return;
      await fetch('/api/teachers', {
        method: 'DELETE',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id:+btn.dataset.id })
      });
      reloadAdmin();
    };
  });
}

function renderUnavailability(unavail, teacherMap) {
  const uv = document.getElementById('unavail-table');
  // If no unavailablity set, show a single row with "Everyones working"
  if (!unavail.length) {
    uv.innerHTML = '<tr><td colspan="11">Everyones Working! <i class="fa-solid fa-thumbs-up"></i></td></tr>';
    return;
  }
  const ut = document.getElementById('unavail-table');
  const dayNames = {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday'};
  ut.innerHTML = unavail.map(u => `
    <tr>
      <td>${teacherMap[u.teacher_id] || u.teacher_name}</td>
      <td>${dayNames[u.day_of_week]}</td>
      <td>${u.start_time}–${u.end_time}</td>
      <td>
        <button class="delete-unavail-btn" data-id="${u.id}"><i class="fa-solid fa-trash"></i></button>
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-unavail-btn').forEach(btn => {
    btn.onclick = async () => {
      await fetch('/api/unavailability', {
        method:'DELETE',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id:+btn.dataset.id })
      });
      reloadAdmin();
    };
  });
}

function renderBookings(bookings, teacherMap, locationMap) {
  const bt = document.getElementById('bookings-table');
  // Apply show/hide filters
  const filtered = bookings.filter(b => 
    b.booking_type === 'zoom' ? prefShowZoom : prefShowInperson
  );
  if (!filtered.length) {
    bt.innerHTML = '<tr><td colspan="11">No Bookings <i class="fa-solid fa-face-sad-tear"></i></td></tr>';
    return;
  }
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  bt.innerHTML = filtered.map(b => {
    const day  = weekdayNames[new Date(b.booking_date).getUTCDay()];
    const time = `${b.start_time}–${b.end_time}`;
    const type = b.booking_type === 'zoom' ? 'Zoom' : 'In Person';
    const loc  = type==='Zoom' ? 'Zoom' : (b.booking_location || locationMap[b.teacher_id]||'');
    return `
      <tr>
        <td>${teacherMap[b.teacher_id] || b.teacher_name}</td>
        <td>${day}</td>
        <td>${time}</td>
        <td>${type}</td>
        <td>${loc}</td>
        <td>${b.parent_name}</td>
        <td><a href="mailto:${b.parent_email}">${b.parent_email}</a></td>
        <td>${b.student_name}</td>
        <td>${b.school_name}</td>
        <td>
          <button class="delete-booking-btn" data-id="${b.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>
    `;
  }).join('');
  document.querySelectorAll('.delete-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this booking?')) return;
      await fetch('/api/bookings', {
        method:'DELETE',
        headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ id:+btn.dataset.id })
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
  const days = Array.from(document.querySelectorAll('input[name="unavail-day"]:checked'))
                    .map(cb => +cb.value);
  const start_time = document.getElementById('start-unavail').value;
  const end_time   = document.getElementById('end-unavail').value;
  if (!days.length) return alert('Select at least one day.');
  await Promise.all(days.map(day =>
    fetch('/api/unavailability', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ teacher_id, day_of_week:day, start_time, end_time })
    })
  ));
  reloadAdmin();
}

async function exportBookingsCSV() {
  const [bookings, teachers] = await Promise.all([
    fetch('/api/bookings').then(r=>r.json()),
    fetch('/api/teachers').then(r=>r.json())
  ]);
  if (!bookings.length) return alert('No bookings to export.');
  const teacherMap = Object.fromEntries(teachers.map(t=>[t.id,t.name]));
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const headers = ['ID','Teacher','Day','Start Time','End Time','Type','Location','Parent','Email','Student','School'];
  const rows = bookings.map(b => {
    const day = weekdayNames[new Date(b.booking_date).getUTCDay()];
    const type = b.booking_type==='zoom'?'Zoom':'In Person';
    const loc  = type==='Zoom'?'Zoom':(b.booking_location||'');
    return [
      b.id,
      teacherMap[b.teacher_id]||b.teacher_name,
      day,
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
    r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')
  ).join('\n');
  const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bookings_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
