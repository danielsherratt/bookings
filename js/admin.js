async function reload(){
  const [teachers, unavail] = await Promise.all([
    fetch('/api/teachers').then(r=>r.json()),
    fetch('/api/unavailability').then(r=>r.json())
  ]);
  // teacher <select>
  const sel = document.getElementById('teacher');
  sel.innerHTML = teachers.map(t=>`<option value="${t.id}">${t.name}</option>`).join('');
  document.getElementById('out').textContent = JSON.stringify(unavail, null, 2);
}

document.addEventListener('DOMContentLoaded', ()=>{
  reload();
  document.getElementById('add').onclick = async ()=>{
    const tId = +document.getElementById('teacher').value;
    const days = [...document.querySelectorAll('input[type=checkbox]:checked')].map(cb=>+cb.value);
    const start = document.getElementById('start').value;
    const end   = document.getElementById('end').value;

    await Promise.all(days.map(d=>
      fetch('/api/unavailability', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({teacher_id:tId, day_of_week:d, start_time:start, end_time:end})
      })
    ));
    alert('Added!');
    reload();
  };
});
