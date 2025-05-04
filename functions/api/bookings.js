export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

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
              `Your booking on ${date} at ${start_time} has been submitted, a Ko Taku Reo Admin will reach out to confirm shortly!

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

    // 4) Send both emails via MailerLite API
    const send = payload => fetch(
      'https://api.mailerlite.com/api/v2/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.MAILERLITE_API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    await Promise.all([ send(parentPayload), send(adminPayload) ]);

    return new Response(null, { status: 201 });
  }

  // Preserve your other methods (GET, DELETE, etc.) unchanged
  return new Response('Method Not Allowed', { status: 405 });
}