// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
  // Initial load
  reloadAdmin();

  // Add Teacher form
  document.getElementById('add-teacher-form').onsubmit = async e => {
    e.preventDefault();
    const name     = document.getElementById('new-teacher-name').value.trim();
    const location = document.getElementById('new-teacher-location').value.trim();
    if (!name || !location) {
      alert('Please provide both name and location.');
      return;
    }
    await fetch('/api/teachers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, location })
    });
    e.target.reset();
    reloadAdmin();
  };

  // Add Unavailability button
  document.getElementById('add-unavail').onclick = async () => {
    const teacher_id = +document.getElementById('teacher-unavail').value;
    const days = Array.from(
      document.querySelectorAll('input[name="unavail-day"]:checked')
    ).map(cb => +cb.value);
    const start_time = document.getElementById('start-unavail').value;
    const end_time   = document.getElementById('end-unavail').value;
    if (!days.length) {
      alert('Select at least one day.');
      return;
    }
    await Promise.all(days.map(day =>
      fetch('/api/unavailability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id, day_of_week: day, start_time, end_time })
      })
    ));
    reloadAdmin();
  };
});

async function reloadAdmin() {
  // Fetch all data
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch('/api/bookings').then(r => r.json())
  ]);

  // Map teacher id→name and id→location
  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));
  const locationMap = Object.fromEntries(teachers.map(t => [t.id, t.location]));

  // 1) Render Teachers table (static location)
  const tt = document.getElementById('teachers-table');
  tt.innerHTML = teachers.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.name}</td>
      <td>${t.location || ''}</td>
      <td>
        <button class="delete-teacher-btn" data-id="${t.id}">
          Delete
        </button>
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-teacher-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this teacher and all related data?')) return;
      await fetch('/api/teachers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: +btn.dataset.id })
      });
      reloadAdmin();
    };
  });

  // 2) Populate Unavailability form dropdown
  const selT = document.getElementById('teacher-unavail');
  selT.innerHTML = teachers.map(t =>
    `<option value="${t.id}">${t.name}</option>`
  ).join('');

  // 3) Render Unavailability table
  const ut = document.getElementById('unavail-table');
  const dayNames = {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday'};
  ut.innerHTML = unavail.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${teacherMap[u.teacher_id] || u.teacher_name}</td>
      <td>${dayNames[u.day_of_week]}</td>
      <td>${u.start_time}–${u.end_time}</td>
      <td>
        <button class="delete-unavail-btn" data-id="${u.id}">
          Delete
        </button>
      </td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-unavail-btn').forEach(btn => {
    btn.onclick = async () => {
      await fetch('/api/unavailability', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: +btn.dataset.id })
      });
      reloadAdmin();
    };
  });

  // 4) Render Bookings table with added Location column
  const bt = document.getElementById('bookings-table');
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  bt.innerHTML = bookings.map(b => {
    const day = weekdayNames[new Date(b.booking_date).getUTCDay()];
    const time = `${b.start_time}–${b.end_time}`;
    const type = b.booking_type === 'zoom' ? 'Zoom' : 'In Person';
    // If Zoom, location = "Zoom", otherwise use stored booking_location
    const loc = b.booking_type === 'zoom'
      ? 'Zoom'
      : (b.booking_location || locationMap[b.teacher_id] || '');
    return `
      <tr>
        <td>${b.id}</td>
        <td>${teacherMap[b.teacher_id] || b.teacher_name}</td>
        <td>${day}</td>
        <td>${time}</td>
        <td>${type}</td>
        <td>${loc}</td>
        <td>${b.parent_name}</td>
        <td>${b.parent_email}</td>
        <td>${b.student_name}</td>
        <td>${b.school_name}</td>
        <td>
          <button class="delete-booking-btn" data-id="${b.id}">
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join('');
  document.querySelectorAll('.delete-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this booking?')) return;
      await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: +btn.dataset.id })
      });
      reloadAdmin();
    };
  });
}
