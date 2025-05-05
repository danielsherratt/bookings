// functions/api/bookings.js

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list bookings (with teacher_name & booking_type)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const baseQuery = `
      SELECT
        b.id,
        b.teacher_id,
        t.name   AS teacher_name,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.parent_name,
        b.parent_email,
        b.student_name,
        b.school_name,
        b.booking_type
      FROM Bookings b
      JOIN Teachers t ON b.teacher_id = t.id
    `;
    const stmt = date
      ? DB.prepare(baseQuery + ' WHERE booking_date = ?').bind(date)
      : DB.prepare(baseQuery);
    const { results } = await stmt.all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: create booking (now binding booking_type)
  if (request.method === 'POST') {
    const {
      teacher_id,
      date,
      start_time,
      end_time,
      parent_name,
      parent_email,
      student_name,
      school_name,
      booking_type
    } = await request.json();

    await DB.prepare(
      `INSERT INTO Bookings
         (teacher_id, booking_date, start_time, end_time,
          parent_name, student_name, school_name, parent_email, booking_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      teacher_id,
      date,
      start_time,
      end_time,
      parent_name,
      student_name,
      school_name,
      parent_email,
      booking_type   // ← this must match the new column
    )
    .run();

    // (…rest of your email‐sending logic here…)

    return new Response(null, { status: 201 });
  }

  // DELETE: remove a booking by ID
  if (request.method === 'DELETE') {
    const { id } = await request.json();
    await DB.prepare('DELETE FROM Bookings WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
