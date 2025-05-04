// functions/api/teachers.js
export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list teachers
  if (request.method === 'GET') {
    const { results } = await DB.prepare('SELECT id, name FROM Teachers ORDER BY name').all();
    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
  }

  // POST: add teacher
  if (request.method === 'POST') {
    const { name } = await request.json();
    await DB.prepare('INSERT INTO Teachers(name) VALUES(?)').bind(name).run();
    return new Response(null, { status: 201 });
  }

  // DELETE: remove teacher + cascade
  if (request.method === 'DELETE') {
    const { id } = await request.json();

    // Fetch bookings to notify parents
    const { results: bookings } = await DB.prepare(
      'SELECT * FROM Bookings WHERE teacher_id = ?'
    ).bind(id).all();

    const auth = 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`);
    const mgUrl = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;

    // Notify each parent
    for (const b of bookings) {
      const params = new URLSearchParams();
      params.append('from', env.SENDER_EMAIL);
      params.append('to', b.parent_email);
      params.append('subject', 'Booking Cancelled');
      params.append('text',
        `Hi ${b.parent_name},\n\n` +
        `Your booking has been cancelled due to teacher removal.`
      );
      await fetch(mgUrl, {
        method: 'POST',
        headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
    }

    // Cascade deletes
    await DB.prepare('DELETE FROM Bookings WHERE teacher_id = ?').bind(id).run();
    await DB.prepare('DELETE FROM TeacherUnavailability WHERE teacher_id = ?').bind(id).run();
    await DB.prepare('DELETE FROM Teachers WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}