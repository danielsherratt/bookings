async function reloadAdmin() {
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch('/api/bookings').then(r => r.json())
  ]);

  // Teacher dropdown
  const sel = document.getElementById('teacher');
  sel.innerHTML = teachers
    .map(t => `<option value="${t.id}">${t.name}</option>`)
    .join('');

  // Render Unavailability
  const unavailBody = document.querySelector('#unavail-table tbody');
  const dayNames = {1:'Monday',2:'Tuesday',3:'Wednesday',4:'Thursday',5:'Friday'};
  unavailBody.innerHTML = unavail.map(u => {
    const teacher = teachers.find(t => t.id === u.teacher_id)?.name || 'Unknown';
    const day = dayNames[u.day_of_week] || u.day_of_week;
    return `
      <tr>
        <td>${teacher}</td>
        <td>${day}</td>
        <td>${u.start_time}–${u.end_time}</td>
        <td><button class="delete-unavail-btn" data-id="${u.id}">Delete</button></td>
      </tr>
    `;
  }).join('');

  // Delete unavailability handlers
  document.querySelectorAll('.delete-unavail-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id);
      if (!confirm(`Delete unavailability #${id}?`)) return;
      await fetch('/api/unavailability', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      reloadAdmin();
    };
  });

  // Render Bookings with parent_email
  const tbody = document.querySelector('#bookings-table tbody');
  const weekdayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  tbody.innerHTML = bookings.map(b => {
    const teacherName = teachers.find(t => t.id === b.teacher_id)?.name || 'Unknown';
    const dateObj = new Date(b.booking_date);
    const dayName = weekdayNames[dateObj.getUTCDay()];
    return `
      <tr>
        <td>${teacherName}</td>
        <td>${dayName}</td>
        <td>${b.start_time}–${b.end_time}</td>
        <td>${b.parent_name}</td>
        <td>${b.parent_email}</td>
        <td>${b.student_name}</td>
        <td>${b.school_name}</td>
        <td><button class="delete-booking-btn" data-id="${b.id}">Delete</button></td>
      </tr>
    `;
  }).join('');

  // Delete booking handlers
  document.querySelectorAll('.delete-booking-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = Number(btn.dataset.id);
      if (!confirm(`Delete booking #${id}?`)) return;
      await fetch('/api/bookings', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id })
      });
      reloadAdmin();
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  reloadAdmin();

  // Add unavailability (unchanged)
  document.getElementById('add-unavail').onclick = async () => {
    const tId = Number(document.getElementById('teacher').value);
    const days = [...document.querySelectorAll('input[type=checkbox]:checked')]
      .map(cb => Number(cb.value));
    const start = document.getElementById('start').value;
    const end   = document.getElementById('end').value;

    await Promise.all(days.map(d =>
      fetch('/api/unavailability', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ teacher_id: tId, day_of_week: d, start_time: start, end_time: end })
      })
    ));
    alert('Unavailability added!');
    reloadAdmin();
  };
});