// functions/api/bookings.js
export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list bookings or filter by date
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const stmt = date
      ? DB.prepare('SELECT * FROM Bookings WHERE booking_date = ?').bind(date)
      : DB.prepare('SELECT * FROM Bookings');
    const { results } = await stmt.all();
    return new Response(JSON.stringify(results), { headers: { 'Content-Type': 'application/json' } });
  }

  // POST: create booking + send notifications via Mailgun
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

    // Insert booking
    await DB.prepare(
      `INSERT INTO Bookings
         (teacher_id, booking_date, start_time, end_time,
          parent_name, student_name, school_name, parent_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(teacher_id, date, start_time, end_time, parent_name, student_name, school_name, parent_email)
    .run();

    // Lookup teacher name
    const { results: tRows } = await DB.prepare(
      'SELECT name FROM Teachers WHERE id = ?'
    ).bind(teacher_id).all();
    const teacherName = tRows[0]?.name || 'Unknown Teacher';

    // Compute day name
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const dayName = days[new Date(date).getUTCDay()];

    // Mailgun credentials
    const auth = 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`);
    const mgUrl = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;

    // Prepare parent email
    const parentParams = new URLSearchParams();
    parentParams.append('from', env.SENDER_EMAIL);
    parentParams.append('to', parent_email);
    parentParams.append('subject', 'Your Booking Confirmation');
    parentParams.append('text',
      `Hi ${parent_name},\n\n` +
      `Your booking with ${teacherName} on ${dayName} at ${start_time} is confirmed.\n\n` +
      `Student: ${student_name}\nSchool: ${school_name}`
    );

    // Prepare admin email
    const adminParams = new URLSearchParams();
    adminParams.append('from', env.SENDER_EMAIL);
    adminParams.append('to', env.ADMIN_EMAIL);
    adminParams.append('subject', 'New Booking Received');
    adminParams.append('text',
      `New booking details:\n` +
      `Teacher: ${teacherName}\nDay: ${dayName}\nTime: ${start_time}-${end_time}\n` +
      `Parent: ${parent_name} <${parent_email}>\nStudent: ${student_name}\nSchool: ${school_name}`
    );

    // Send emails
    await Promise.all([
      fetch(mgUrl, { method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: parentParams }),
      fetch(mgUrl, { method: 'POST', headers: { 'Authorization': auth, 'Content-Type': 'application/x-www-form-urlencoded' }, body: adminParams })
    ]);

    return new Response(null, { status: 201 });
  }

  // DELETE: remove booking by ID
  if (request.method === 'DELETE') {
    const { id } = await request.json();
    await DB.prepare('DELETE FROM Bookings WHERE id = ?').bind(id).run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}