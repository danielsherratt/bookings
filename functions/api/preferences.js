// functions/api/preferences.js

export async function onRequest(context) {
  const { request, env } = context;
  const DB = env.DB;

  // GET current preferences
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT staff_classification, primary_color, secondary_color
         FROM Preferences
        WHERE id = 1`
    ).all();
    const prefs = results[0] || {
      staff_classification: 'Teacher',
      primary_color:        '#00625f',
      secondary_color:      '#6bbaae'
    };
    return new Response(JSON.stringify(prefs), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST (or PUT) to update preferences
  if (request.method === 'POST') {
    const { staff_classification, primary_color, secondary_color } = await request.json();
    await DB.prepare(
      `INSERT INTO Preferences
         (id, staff_classification, primary_color, secondary_color)
       VALUES (1, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         staff_classification = excluded.staff_classification,
         primary_color        = excluded.primary_color,
         secondary_color      = excluded.secondary_color`
    )
    .bind(staff_classification, primary_color, secondary_color)
    .run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
