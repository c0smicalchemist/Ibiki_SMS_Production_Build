addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(req) {
  // Production Ibiki server URL
  const MASTER_SERVER = 'https://ibiki.run.place';
  const upstreamUrl = MASTER_SERVER + '/api/webhook/textbelt';

  // Read the raw body first so we can forward it exactly as-is
  const rawBody = req.method === 'GET' || req.method === 'HEAD' ? null : await req.arrayBuffer();

  // Clone headers and add proxy marker
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    headers.set(key, value);
  }
  headers.set('x-proxy-forwarded', 'sms-proxy-worker');

  const init = {
    method: req.method,
    headers,
    body: rawBody,
    redirect: 'manual'
  };

  try {
    const resp = await fetch(upstreamUrl, init);
    // Mirror response status, headers and body back to the client
    const responseHeaders = new Headers(resp.headers);
    // Remove hop-by-hop header that might break clients
    responseHeaders.delete('transfer-encoding');

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'proxy_error', message: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
