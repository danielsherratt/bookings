async function reloadAdmin() {
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch('/api/bookings').then(r => r.json())
  ]);

  // Teacher Unavail dropdown
  const tu = document.getElementById('teacher-unavail');
  tu.innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  // Unavailability table
  const ut = document.getElementById('unavail-table');
  const days = {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday'};
  ut.innerHTML = unavail.map(u =>
    `<tr>
      <td>${u.teacher_name}</td>
      <td>${days[u.day_of_week]}</td>
      <td>${u.start_time}–${u.end_time}</td>
      <td><button class="delete-unavail-btn" data-id="${u.id}">Delete</button></td>
    </tr>`
  ).join('');

  document.querySelectorAll('.delete-unavail-btn').forEach(btn => btn.onclick = async () => {
    await fetch('/api/unavailability', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:+btn.dataset.id}) });
    reloadAdmin();
  });

  // Bookings table
  const bt = document.getElementById('bookings-table');
  bt.innerHTML = bookings.map(b =>
    `<tr>
      <td>${b.teacher_name}</td>
      <td>${new Date(b.booking_date).toLocaleDateString('en-US', { weekday:'long' })}</td>
      <td>${b.start_time}–${b.end_time}</td>
      <td>${b.parent_name}</td>
      <td><a href="mailto:${b.parent_email}">${b.parent_email}</a></td>
      <td>${b.student_name}</td>
      <td>${b.school_name}</td>
      <td><button class="delete-booking-btn" data-id="${b.id}">Delete</button></td>
    </tr>`
  ).join('');

  document.querySelectorAll('.delete-booking-btn').forEach(btn => btn.onclick = async () => {
    await fetch('/api/bookings', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:+btn.dataset.id}) });
    reloadAdmin();
  });

  // Teachers table
  const tt = document.getElementById('teachers-table');
  tt.innerHTML = teachers.map(t =>
    `<tr>
      <td>${t.name}</td>
      <td><button class="delete-teacher-btn" data-id="${t.id}">Delete</button></td>
    </tr>`
  ).join('');

  document.querySelectorAll('.delete-teacher-btn').forEach(btn => btn.onclick = async () => {
    if (!confirm('Delete this teacher and all their bookings?')) return;
    await fetch('/api/teachers', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:+btn.dataset.id}) });
    reloadAdmin();
  });

  // Add teacher form
  document.getElementById('add-teacher-form').onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById('new-teacher-name').value.trim();
    if (!name) return;
    await fetch('/api/teachers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name}) });
    document.getElementById('new-teacher-name').value = '';
    reloadAdmin();
  };
}

document.addEventListener('DOMContentLoaded', reloadAdmin);