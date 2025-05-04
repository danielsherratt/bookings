async function load(path){ return fetch(`data/${path}`).then(r=>r.json()); }
function saveJSON(json){ document.getElementById('out').value = JSON.stringify(json, null, 2); }

document.addEventListener('DOMContentLoaded', async () => {
  const teachers = await load('teachers.json');
  let unavail = await load('unavailability.json');

  const selT = document.getElementById('teacher');
  teachers.forEach(t=>{
    const o = document.createElement('option');
    o.value = t.id; o.textContent = t.name;
    selT.append(o);
  });

  saveJSON(unavail);

  document.getElementById('add').onclick = () => {
    const tId = +selT.value;
    const days = [...document.querySelectorAll('input[type=checkbox]:checked')]
                 .map(cb=>+cb.value);
    const start = document.getElementById('start').value;
    const end   = document.getElementById('end').value;

    days.forEach(d => {
      unavail.push({ teacher_id:tId, day_of_week:d, start_time:start, end_time:end });
    });
    saveJSON(unavail);
    alert('Added! Now copy the JSON above back into data/unavailability.json');
  };
});