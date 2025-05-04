import jwt from 'jsonwebtoken';

export async function onRequestPost({ request, env }) {
  const { username, password } = await request.json();
  if (
    username === env.ADMIN_USER &&
    password === env.ADMIN_PASS
  ) {
    const token = jwt.sign({ user: username }, env.JWT_SECRET, { expiresIn: '2h' });
    return new Response(null, {
      status: 302,
      headers: {
        'Set-Cookie': `admin_token=${token}; HttpOnly; Path=/; Max-Age=7200`,
        'Location': '/admin.html'
      }
    });
  }
  return new Response('Unauthorized', { status: 401 });
}