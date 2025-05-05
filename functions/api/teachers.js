// functions/api/teachers.js

// Note: Uses fetch() to send cancellation emails via Mailgun.
// Ensure MAILGUN_API_KEY, MAILGUN_DOMAIN, SENDER_EMAIL, ADMIN_EMAIL are set.

export async function onRequest({ request, env }) {
  const DB = env.DB;
  const mgUrl = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;
  const auth  = 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`);

  // 1) GET all teachers
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT id, name, location
         FROM Teachers`
    ).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2) POST a new teacher
  if (request.method === 'POST') {
    const { name, location } = await request.json();
    await DB.prepare(
      `INSERT INTO Teachers (name, location)
         VALUES (?, ?)`
    )
    .bind(name, location)
    .run();
    return new Response(null, { status: 201 });
  }

  // 3) PUT to update a teacher’s location (or other fields if you extend)
  if (request.method === 'PUT') {
    const { id, location } = await request.json();
    await DB.prepare(
      `UPDATE Teachers
         SET location = ?
       WHERE id = ?`
    )
    .bind(location, id)
    .run();
    return new Response(null, { status: 204 });
  }

  // 4) DELETE a teacher (cascade bookings & unavailability + notify parents)
  if (request.method === 'DELETE') {
    const { id } = await request.json();

    // a) Fetch that teacher’s future bookings
    const { results: bookings } = await DB.prepare(
      `SELECT id, parent_name, parent_email,
              student_name, school_name,
              booking_date, start_time, end_time
         FROM Bookings
        WHERE teacher_id = ?`
    ).bind(id).all();

    // b) Delete related unavailability and bookings
    await DB.prepare(
      `DELETE FROM TeacherUnavailability
        WHERE teacher_id = ?`
    ).bind(id).run();
    await DB.prepare(
      `DELETE FROM Bookings
        WHERE teacher_id = ?`
    ).bind(id).run();

    // c) Delete the teacher record
    await DB.prepare(
      `DELETE FROM Teachers
        WHERE id = ?`
    ).bind(id).run();

    // d) Notify each parent their booking was cancelled
    await Promise.all(bookings.map(b => {
      const params = new URLSearchParams();
      params.append('from', env.SENDER_EMAIL);
      params.append('to', b.parent_email);
      params.append('subject', 'Your Booking Has Been Cancelled');
      params.append('text',
        `Hi ${b.parent_name},\n\n` +
        `Unfortunately, your booking on ${b.booking_date} at ${b.start_time} ` +
        `with our teacher has been cancelled.\n\n` +
        `We apologize for the inconvenience.\n`
      );
      return fetch(mgUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
    }));

    return new Response(null, { status: 204 });
  }

  // 5) All other methods not allowed
  return new Response('Method Not Allowed', { status: 405 });
}
