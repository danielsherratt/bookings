// public/js/admin.js

document.addEventListener('DOMContentLoaded', () => {
  // Attach the add-unavailability handler
  document.getElementById('add-unavail').onclick = async () => {
    try {
      const tId = Number(document.getElementById('teacher-unavail').value);
      const checkboxes = document.querySelectorAll('#admin-form input[type=checkbox]:checked');
      const days = Array.from(checkboxes).map(cb => Number(cb.value));
      const start = document.getElementById('start-unavail').value;
      const end = document.getElementById('end-unavail').value;

      if (!days.length) {
        console.warn('No days selected for unavailability');
        return;
      }

      for (const d of days) {
        const res = await fetch('/api/unavailability', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teacher_id: tId, day_of_week: d, start_time: start, end_time: end })
        });
        if (!res.ok) {
          const errText = await res.text();
          console.error('Failed to add unavailability:', res.status, errText);
        }
      }

      console.log('Unavailability added successfully');
      reloadAdmin();
    } catch (err) {
      console.error('Error in add-unavailability handler:', err);
    }
  };

  // Initial load
  reloadAdmin();
});

async function reloadAdmin() {
  // Fetch all data
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch('/api/bookings').then(r => r.json())
  ]);

  // Build teacher map
  const teacherMap = Object.fromEntries(teachers.map(t => [t.id, t.name]));

  // Populate teacher dropdown for unavailability
  const tu = document.getElementById('teacher-unavail');
  tu.innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  // Render Unavailability table
  const ut = document.getElementById('unavail-table');
  const dayNames = {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday'};
  ut.innerHTML = unavail.map(u => `
    <tr>
      <td>${u.id}</td>
      <td>${u.teacher_name}</td>
      <td>${dayNames[u.day_of_week]}</td>
      <td>${u.start_time}–${u.end_time}</td>
      <td><button class="delete-unavail-btn" data-id="${u.id}">Delete</button></td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-unavail-btn').forEach(btn => {
    btn.onclick = async () => {
      await fetch('/api/unavailability', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({id: Number(btn.dataset.id)})
      });
      reloadAdmin();
    };
  });

  // Render Bookings table (teacher names via map)
  const bt = document.getElementById('bookings-table');
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  bt.innerHTML = bookings.map(b => `
    <tr>
      <td>${b.id}</td>
      <td>${teacherMap[b.teacher_id] || 'Unknown'}</td>
      <td>${weekdayNames[new Date(b.booking_date).getUTCDay()]}</td>
      <td>${b.start_time}–${b.end_time}</td>
      <td>${b.parent_name}</td>
      <td>${b.parent_email}</td>
      <td>${b.student_name}</td>
      <td>${b.school_name}</td>
      <td><button class="delete-booking-btn" data-id="${b.id}">Delete</button></td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      await fetch('/api/bookings', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({id: Number(btn.dataset.id)})
      });
      reloadAdmin();
    };
  });

  // Render Teachers table
  const tt = document.getElementById('teachers-table');
  tt.innerHTML = teachers.map(t => `
    <tr>
      <td>${t.id}</td>
      <td>${t.name}</td>
      <td><button class="delete-teacher-btn" data-id="${t.id}">Delete</button></td>
    </tr>
  `).join('');
  document.querySelectorAll('.delete-teacher-btn').forEach(btn => {
    btn.onclick = async () => {
      if (!confirm('Delete this teacher and all their bookings?')) return;
      await fetch('/api/teachers', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({id: Number(btn.dataset.id)})
      });
      reloadAdmin();
    };
  });

  // Add Teacher form
  document.getElementById('add-teacher-form').onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById('new-teacher-name').value.trim();
    if (!name) return;
    await fetch('/api/teachers', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({name})
    });
    document.getElementById('new-teacher-name').value = '';
    reloadAdmin();
  };
}
