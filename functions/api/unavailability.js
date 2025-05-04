export async function onRequest({ request, env }) {
  const DB = env.DB;
  if (request.method === 'GET') {
    const { results } = await DB.prepare(`SELECT * FROM TeacherUnavailability`).all();
    return new Response(JSON.stringify(results), { headers: { 'Content-Type':'application/json' } });
  }
  if (request.method === 'POST') {
    const { teacher_id, day_of_week, start_time, end_time } = await request.json();
    await DB.prepare(
      `INSERT INTO TeacherUnavailability
         (teacher_id, day_of_week, start_time, end_time)
       VALUES (?, ?, ?, ?)`
    )
    .bind(teacher_id, day_of_week, start_time, end_time)
    .run();
    return new Response(null, { status: 201 });
  }
  return new Response('Method Not Allowed', { status: 405 });
}
