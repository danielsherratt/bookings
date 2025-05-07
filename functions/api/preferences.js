// functions/api/preferences.js

export async function onRequest({ request, env }) {
  const DB = env.DB;

  // GET: return all preferences
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT staff_classification, primary_color, secondary_color,
              page_heading, zoom_duration, inperson_duration
         FROM Preferences
        WHERE id = 1`
    ).all();
    const p = results[0];
    return new Response(JSON.stringify(p), {
      headers: { 'Content-Type':'application/json' }
    });
  }

  // POST: upsert all preferences
  if (request.method === 'POST') {
    const {
      staff_classification,
      primary_color,
      secondary_color,
      page_heading,
      zoom_duration,
      inperson_duration
    } = await request.json();

    await DB.prepare(
      `INSERT INTO Preferences
         (id, staff_classification, primary_color, secondary_color,
          page_heading, zoom_duration, inperson_duration)
       VALUES (1,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         staff_classification = excluded.staff_classification,
         primary_color        = excluded.primary_color,
         secondary_color      = excluded.secondary_color,
         page_heading         = excluded.page_heading,
         zoom_duration        = excluded.zoom_duration,
         inperson_duration    = excluded.inperson_duration`
    )
    .bind(
      staff_classification,
      primary_color,
      secondary_color,
      page_heading,
      zoom_duration,
      inperson_duration
    )
    .run();

    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status:405 });
}
