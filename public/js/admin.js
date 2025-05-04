async function reloadAdmin() {
  // Fetch teachers and unavailability
  const [teachers, unavail, bookings] = await Promise.all([
    fetch('/api/teachers').then(r => r.json()),
    fetch('/api/unavailability').then(r => r.json()),
    fetch('/api/bookings').then(r => r.json())
  ]);

  // Populate teacher select
  const sel = document.getElementById('teacher');
  sel.innerHTML = teachers.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

  // Show unavailability JSON
  document.getElementById('out-unavail').textContent = JSON.stringify(unavail, null, 2);

  // Populate bookings table
  const tbody = document.querySelector('#bookings-table tbody');
  tbody.innerHTML = bookings.map(b => {
    const teacherName = teachers.find(t => t.id === b.teacher_id)?.name || 'Unknown';
    return `
      <tr>
        <td>${b.id}</td>
        <td>${teacherName}</td>
        <td>${b.booking_date}</td>
        <td>${b.start_time}–${b.end_time}</td>
        <td>${b.parent_name}</td>
        <td>${b.student_name}</td>
        <td>${b.school_name}</td>
        <td><button class="delete-btn" data-id="${b.id}">Delete</button></td>
      </tr>
    `;
  }).join('');

  // Attach delete handlers
  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      if (!confirm(`Delete booking #${id}?`)) return;
      await fetch('/api/bookings', {
        method: 'DELETE',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ id: Number(id) })
      });
      reloadAdmin();
    };
  });
}

document.addEventListener('DOMContentLoaded', () => {
  reloadAdmin();

  // Add unavailability as before
  document.getElementById('add-unavail').onclick = async () => {
    const tId = +document.getElementById('teacher').value;
    const days = [...document.querySelectorAll('input[type=checkbox]:checked')].map(cb => +cb.value);
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