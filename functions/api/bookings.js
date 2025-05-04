// functions/api/bookings.js

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list bookings or filter by date (includes teacher_name)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const baseQuery = `
      SELECT
        b.id,
        b.teacher_id,
        t.name AS teacher_name,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.parent_name,
        b.parent_email,
        b.student_name,
        b.school_name
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

  // POST: create booking + send notifications via Mailgun with troubleshooting logs
  if (request.method === 'POST') {
    // Parse booking data
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

    // Insert into D1
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

    // Look up teacher name
    const { results: tRows } = await DB.prepare(
      'SELECT name FROM Teachers WHERE id = ?'
    ).bind(teacher_id).all();
    const teacherName = tRows[0]?.name || 'Unknown Teacher';

    // Compute day name
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = dayNames[new Date(date).getUTCDay()];

    // Mailgun setup
    const auth = 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`);
    const mgUrl = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;

    // Prepare parent email params
    const parentParams = new URLSearchParams();
    parentParams.append('from', env.SENDER_EMAIL);
    parentParams.append('to', parent_email);
    parentParams.append('subject', 'Your Booking Confirmation');
    parentParams.append('text',
      `Hi ${parent_name},\n\n` +
      `Your booking with ${teacherName} on ${dayName} at ${start_time} is confirmed.\n\n` +
      `Student: ${student_name}\nSchool: ${school_name}`
    );

    // Prepare admin email params
    const adminParams = new URLSearchParams();
    adminParams.append('from', env.SENDER_EMAIL);
    adminParams.append('to', env.ADMIN_EMAIL);
    adminParams.append('subject', 'New Booking Received');
    adminParams.append('text',
      `New booking details:\n` +
      `Teacher: ${teacherName}\nDay: ${dayName}\nTime: ${start_time}-${end_time}\n` +
      `Parent: ${parent_name} <${parent_email}>\nStudent: ${student_name}\nSchool: ${school_name}`
    );

    // Helper to send mail and log outcome
    async function sendMail(params, label) {
      try {
        const res = await fetch(mgUrl, {
          method: 'POST',
          headers: {
            'Authorization': auth,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        });
        if (!res.ok) {
          const text = await res.text();
          console.error(`[Mailgun:${label}] HTTP ${res.status}`, text);
        } else {
          console.log(`[Mailgun:${label}] sent successfully`);
        }
      } catch (err) {
        console.error(`[Mailgun:${label}] network error`, err);
      }
    }

    // Send both emails
    await Promise.all([
      sendMail(parentParams, 'parent'),
      sendMail(adminParams, 'admin')
    ]);

    return new Response(null, { status: 201 });
  }

  // DELETE: remove a booking by ID
  if (request.method === 'DELETE') {
    const { id } = await request.json();
    await DB.prepare('DELETE FROM Bookings WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }

  // Other methods not allowed
  return new Response('Method Not Allowed', { status: 405 });
}
