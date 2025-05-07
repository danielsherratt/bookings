export async function onRequest({ request, env }) {
  const DB = env.DB;

  if (request.method === 'GET') {
    const { results } = await DB.prepare(`
      SELECT
        staff_classification,
        primary_color,
        secondary_color,
        page_heading,
        zoom_duration,
        inperson_duration,
        show_zoom,
        show_inperson
      FROM Preferences
      WHERE id = 1
    `).all();
    return new Response(JSON.stringify(results[0]), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (request.method === 'POST') {
    const {
      staff_classification,
      primary_color,
      secondary_color,
      page_heading,
      zoom_duration,
      inperson_duration,
      show_zoom,
      show_inperson
    } = await request.json();

    await DB.prepare(`
      INSERT INTO Preferences
        (id,
         staff_classification,
         primary_color,
         secondary_color,
         page_heading,
         zoom_duration,
         inperson_duration,
         show_zoom,
         show_inperson)
      VALUES (1,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        staff_classification = excluded.staff_classification,
        primary_color        = excluded.primary_color,
        secondary_color      = excluded.secondary_color,
        page_heading         = excluded.page_heading,
        zoom_duration        = excluded.zoom_duration,
        inperson_duration    = excluded.inperson_duration,
        show_zoom            = excluded.show_zoom,
        show_inperson        = excluded.show_inperson
    `)
    .bind(
      staff_classification,
      primary_color,
      secondary_color,
      page_heading,
      zoom_duration,
      inperson_duration,
      show_zoom   ? 1 : 0,
      show_inperson ? 1 : 0
    )
    .run();

    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
