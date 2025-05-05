// functions/api/teachers.js

export async function onRequest({ request, env }) {
  const DB = env.DB;

  // GET all teachers (with location)
  if (request.method === 'GET') {
    const { results } = await DB.prepare(
      `SELECT id, name, location
         FROM Teachers`
    ).all();
    return new Response(JSON.stringify(results), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // POST a new teacher (with location)
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

  // DELETE existing teacher
  if (request.method === 'DELETE') {
    const { id } = await request.json();
    // (Optionally cascade bookings/unavail here…)
    await DB.prepare(`DELETE FROM Teachers WHERE id = ?`)
            .bind(id)
            .run();
    return new Response(null, { status: 204 });
  }

  return new Response('Method Not Allowed', { status: 405 });
}
