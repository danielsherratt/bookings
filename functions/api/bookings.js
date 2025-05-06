// functions/api/bookings.js

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET: list bookings (with teacher_name & booking_location)
  if (request.method === 'GET') {
    const url = new URL(request.url);
    const date = url.searchParams.get('date');
    const baseQuery = `
      SELECT
        b.id,
        b.teacher_id,
        t.name        AS teacher_name,
        b.booking_date,
        b.start_time,
        b.end_time,
        b.parent_name,
        b.parent_email,
        b.student_name,
        b.school_name,
        b.booking_type,
        b.booking_location
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

  // POST: create booking with pre-checks and robust insert error handling
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

    // compute day-of-week for unavailability check
    const dayOfWeek = new Date(date).getUTCDay();

    // 1) Unavailability check
    const { results: ua } = await DB.prepare(
      `SELECT 1 FROM TeacherUnavailability
         WHERE teacher_id = ?
           AND day_of_week = ?
           AND NOT (end_time <= ? OR start_time >= ?)
         LIMIT 1`
    )
    .bind(teacher_id, dayOfWeek, start_time, end_time)
    .all();
    if (ua.length) {
      return new Response(
        JSON.stringify({ error: 'Sorry, the booking has already been taken' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 2) Existing booking check
    const { results: eb } = await DB.prepare(
      `SELECT 1 FROM Bookings
         WHERE teacher_id = ?
           AND booking_date = ?
           AND NOT (end_time <= ? OR start_time >= ?)
         LIMIT 1`
    )
    .bind(teacher_id, date, start_time, end_time)
    .all();
    if (eb.length) {
      return new Response(
        JSON.stringify({ error: 'Sorry, the booking has already been taken' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 3) Determine booking_location
    let bookingLocation;
    if (booking_type === 'zoom') {
      bookingLocation = 'Zoom';
    } else {
      const { results: locRows } = await DB.prepare(
        'SELECT location FROM Teachers WHERE id = ?'
      )
      .bind(teacher_id)
      .all();
      bookingLocation = locRows[0]?.location || '';
    }

    // 4) Insert booking — catch _any_ insert error as “taken”
    const insertSQL = `
      INSERT INTO Bookings
        (teacher_id, booking_date, start_time, end_time,
         parent_name, student_name, school_name,
         parent_email, booking_type, booking_location)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    try {
      await DB.prepare(insertSQL)
        .bind(
          teacher_id,
          date,
          start_time,
          end_time,
          parent_name,
          student_name,
          school_name,
          parent_email,
          booking_type,
          bookingLocation
        )
        .run();
    } catch (err) {
      console.error('Booking insert error:', err);
      return new Response(
        JSON.stringify({ error: 'Sorry, the booking has already been taken' }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 5) Send confirmation emails (Mailgun)
    const auth  = 'Basic ' + btoa(`api:${env.MAILGUN_API_KEY}`);
    const mgUrl = `https://api.mailgun.net/v3/${env.MAILGUN_DOMAIN}/messages`;

    async function sendMail(params) {
      await fetch(mgUrl, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });
    }

    // parent email
    const parentParams = new URLSearchParams();
    parentParams.append('from',    env.SENDER_EMAIL);
    parentParams.append('to',      parent_email);
    parentParams.append('subject', 'Your Booking Confirmation');
    parentParams.append('text',
      `Hi ${parent_name},\n\n` +
      `Your ${booking_type === 'zoom' ? 'Zoom session' : 'In Person'} is confirmed ` +
      `on ${date} at ${start_time} (Location: ${bookingLocation}).\n\n` +
      `Student: ${student_name}\nSchool: ${school_name}`
    );

    // admin copy
    const adminParams = new URLSearchParams();
    adminParams.append('from',    env.SENDER_EMAIL);
    adminParams.append('to',      env.ADMIN_EMAIL);
    adminParams.append('subject', 'New Booking Received');
    adminParams.append('text',
      `New booking:\n` +
      `Teacher ID: ${teacher_id}\n` +
      `Date: ${date}\nTime: ${start_time}–${end_time}\n` +
      `Type: ${booking_type}\nLocation: ${bookingLocation}\n` +
      `Parent: ${parent_name} <${parent_email}>\n` +
      `Student: ${student_name}\nSchool: ${school_name}`
    );

    await Promise.all([
      sendMail(parentParams),
      sendMail(adminParams)
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
