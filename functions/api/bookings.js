export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list bookings (optionally filtered by date)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const stmt = date
      ? DB.prepare(`SELECT * FROM Bookings WHERE booking_date = ?`).bind(date)
      : DB.prepare(`SELECT * FROM Bookings`);
    const { results } = await stmt.all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: create a new booking
  if (request.method === 'POST') {
    const {
      teacher_id,
      date,
      start_time,
      end_time,
      parent_name,
      parent_email,
      student_name,
      school_name
    } = await request.json();

    await DB.prepare(
      `INSERT INTO Bookings
         (teacher_id, booking_date, start_time, end_time,
          parent_name, student_name, school_name, parent_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      teacher_id,
      date,
      start_time,
      end_time,
      parent_name,
      student_name,
      school_name,
      parent_email
    )
    .run();

    return new Response(null, { status: 201 });
  }

  // DELETE: remove a booking
  if (request.method === 'DELETE') {
    const { id } = await request.json();
    await DB.prepare(`DELETE FROM Bookings WHERE id = ?`).bind(id).run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}