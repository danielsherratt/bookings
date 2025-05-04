export async function onRequest({ env }) {
  const { results } = await env.DB.prepare(`SELECT id, name FROM Teachers`).all();
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  });
}