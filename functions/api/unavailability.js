export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list all unavailability records
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT u.id, u.teacher_id, t.name AS teacher_name, u.day_of_week, u.start_time, u.end_time
       FROM TeacherUnavailability u
       JOIN Teachers t ON u.teacher_id = t.id`
    ).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: add new unavailability
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

  // DELETE: remove an unavailability record by ID
  if (request.method === 'DELETE') {
    let id;
    try {
      ({ id } = await request.json());
      console.log('Deleting unavailability with id=', id);
      const result = await DB.prepare(
        `DELETE FROM TeacherUnavailability WHERE id = ?`
      )
      .bind(id)
      .run();

      // `result` in D1 `.run()` doesn’t return rowCount; let's verify by selecting
      const { results: verify } = await DB.prepare(
        `SELECT COUNT(*) AS cnt FROM TeacherUnavailability WHERE id = ?`
      ).bind(id).all();

      if (verify[0].cnt === 0) {
        console.log(`Deletion confirmed: record ${id} gone.`);
        return new Response(null, { status: 204 });
      } else {
        console.error(`Deletion failed: record ${id} still exists.`);
        return new Response('Deletion failed', { status: 500 });
      }

    } catch (e) {
      console.error('Error in DELETE /api/unavailability:', e);
      return new Response('Bad Request', { status: 400 });
    }
  }

  // All other methods not allowed
  return new Response('Method Not Allowed', { status: 405 });
}