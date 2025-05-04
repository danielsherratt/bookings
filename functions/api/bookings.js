// functions/api/bookings.js
export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list all bookings or filter by date
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const stmt = date
      ? DB.prepare('SELECT * FROM Bookings WHERE booking_date = ?').bind(date)
      : DB.prepare('SELECT * FROM Bookings');
    const { results } = await stmt.all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST: create booking and send emails via Mailgun
  if (request.method === 'POST') {
    // 1) Parse booking data
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

    // 2) Insert into D1
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

    // 3) Prepare Mailgun auth and payloads
    const auth = 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`);

    // Parent email
    const parentParams = new URLSearchParams();
    parentParams.append('from', env.SENDER_EMAIL);
    parentParams.append('to', parent_email);
    parentParams.append('subject', 'Your Booking Confirmation');
    parentParams.append('text',
      `Hi ${parent_name},\n\n` +
      `Your booking on ${date} at ${start_time} has been confirmed.\n\n` +
      `Teacher ID: ${teacher_id}\nStudent: ${student_name}\nSchool: ${school_name}`
    );

    // Admin copy
    const adminParams = new URLSearchParams();
    adminParams.append('from', env.SENDER_EMAIL);
    adminParams.append('to', env.ADMIN_EMAIL);
    adminParams.append('subject', 'New Booking Received');
    adminParams.append('text',
      `New booking details:\n` +
      `Teacher ID: ${teacher_id}\nDate: ${date}\nTime: ${start_time}-${end_time}\n` +
      `Parent: ${parent_name} <${parent_email}>\nStudent: ${student_name}\nSchool: ${school_name}`
    );

    // 4) Send both via Mailgun
    const url = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;
    await Promise.all([
      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: parentParams
      }),
      fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: adminParams
      })
    ]);

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
