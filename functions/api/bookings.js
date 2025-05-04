// functions/api/bookings.js
export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list all bookings or filter by date
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

  // POST: create booking and send emails via MailerLite
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

    // 3) Prepare MailerLite payloads
    const parentPayload = {
      from: { email: env.ADMIN_EMAIL },
      to:    [{ email: parent_email }],
      subject: 'Your Booking Confirmation',
      plain:  `Hi ${parent_name},

` +
              `Your booking on ${date} at ${start_time} has been confirmed.

` +
              `Teacher ID: ${teacher_id}
Student: ${student_name}
School: ${school_name}`
    };

    const adminPayload = {
      from: { email: env.ADMIN_EMAIL },
      to:    [{ email: env.ADMIN_EMAIL }],
      subject: 'New Booking Received',
      plain:  `New booking details:
` +
              `Teacher ID: ${teacher_id}
Date: ${date}
Time: ${start_time}-${end_time}
` +
              `Parent: ${parent_name} <${parent_email}>
Student: ${student_name}
School: ${school_name}`
    };

    // 4) Send both emails via MailerLite API, with logging
    const send = async payload => {
      const res = await fetch(
        'https://api.mailerlite.com/api/v2/email/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`
          },
          body: JSON.stringify(payload)
      });
      // Log response for debugging
      if (!res.ok) {
        const text = await res.text();
        console.error('MailerLite send error:', res.status, text);
      }
      return res;
    };

    // Execute sends
    await Promise.all([ send(parentPayload), send(adminPayload) ]);

    return new Response(null, { status: 201 });
  }

  // DELETE: remove a booking by ID
  if (request.method === 'DELETE') {
    const { id } = await request.json();
    await DB.prepare(`DELETE FROM Bookings WHERE id = ?`).bind(id).run();
    return new Response(null, { status: 204 });
  }

  // All other methods not allowed
  return new Response('Method Not Allowed', { status: 405 });
}