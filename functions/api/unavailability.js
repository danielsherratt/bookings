// functions/api/unavailability.js
export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list all unavailability
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT u.id, t.name AS teacher_name, u.day_of_week, u.start_time, u.end_time
       FROM TeacherUnavailability u
       JOIN Teachers t ON u.teacher_id = t.id`
    ).all();
    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
  }

  // POST: add unavailability
  if (request.method === 'POST') {
    const { teacher_id, day_of_week, start_time, end_time } = await request.json();
    await DB.prepare(
      `INSERT INTO TeacherUnavailability (teacher_id, day_of_week, start_time, end_time)
       VALUES (?, ?, ?, ?)`
    ).bind(teacher_id, day_of_week, start_time, end_time).run();
    return new Response(null, { status: 201 });
  }

  // DELETE: remove unavailability by ID
  if (request.method === 'DELETE') {
    try {
      const { id } = await request.json();
      console.log('Deleting unavailability id=', id);
      await DB.prepare('DELETE FROM TeacherUnavailability WHERE id = ?').bind(id).run();
      return new Response(null, { status: 204 });
    } catch (e) {
      console.error('Delete error:', e);
      return new Response('Bad Request', { status: 400 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
}