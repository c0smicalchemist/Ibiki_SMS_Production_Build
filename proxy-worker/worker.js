/**
 * Cloudflare Worker - SMS Webhook Proxy
 * 
 * This worker receives webhooks from SMS providers and forwards them to your master server.
 * Supports: TextBelt, Anveo
 * Deploy this on multiple domains for redundancy.
 * 
 * Setup:
 * 1. Go to Cloudflare Dashboard → Workers & Pages → Create Worker
 * 2. Paste this code
 * 3. Add custom domain (e.g., sms-proxy-1.yourdomain.com)
 * 4. Set the MASTER_SERVER secret in Worker Settings → Variables
 */

// Configuration - Set this in Cloudflare Worker Settings → Environment Variables
// MASTER_SERVER = "https://ibiki.run.place"

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'ok',
        proxy: 'sms-webhook-proxy',
        providers: ['textbelt', 'anveo'],
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Debug endpoint - list recent webhook attempts (stored in KV if configured)
    if (url.pathname === '/debug/recent') {
      if (env.WEBHOOK_LOGS) {
        const logs = await env.WEBHOOK_LOGS.get('recent_webhooks', 'json') || [];
        return new Response(JSON.stringify({ logs }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ error: 'KV not configured' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // =============================================
    // ANVEO WEBHOOK HANDLER
    // URL format: /anveo/webhook?from=XXX&to=YYY&message=ZZZ
    // =============================================
    if (url.pathname === '/anveo/webhook') {
      try {
        const masterServer = env.MASTER_SERVER || 'https://ibiki.run.place';
        
        // Get params from query string (Anveo uses GET with placeholders)
        const from = url.searchParams.get('from') || '';
        const to = url.searchParams.get('to') || '';
        const message = url.searchParams.get('message') || '';
        
        // Log the webhook
        const logEntry = {
          timestamp: new Date().toISOString(),
          provider: 'anveo',
          from,
          to,
          message: message.substring(0, 200),
          ip: request.headers.get('CF-Connecting-IP') || 'unknown',
          proxy: url.hostname
        };
        
        if (env.WEBHOOK_LOGS) {
          try {
            const existing = await env.WEBHOOK_LOGS.get('recent_webhooks', 'json') || [];
            existing.unshift(logEntry);
            await env.WEBHOOK_LOGS.put('recent_webhooks', JSON.stringify(existing.slice(0, 50)));
          } catch (kvError) {
            console.error('KV log error:', kvError);
          }
        }
        
        // Forward to master server
        const response = await fetch(`${masterServer}/api/webhook/anveo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
            'X-Proxy-Domain': url.hostname
          },
          body: JSON.stringify({
            from,
            to,
            message,
            timestamp: new Date().toISOString()
          })
        });

        const responseBody = await response.text();
        
        return new Response(responseBody, {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        });

      } catch (error) {
        console.error('Anveo proxy error:', error);
        return new Response('OK', { status: 200 });
      }
    }

    // =============================================
    // TEXTBELT WEBHOOK HANDLER (legacy)
    // =============================================
    if (url.pathname !== '/api/webhook/textbelt') {
      return new Response('Not Found', { status: 404 });
    }

    // Only accept POST requests
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      // Get master server from environment variable
      const masterServer = env.MASTER_SERVER || 'https://ibiki.run.place';
      
      // Clone the request to forward to master
      const body = await request.text();
      
      // Log the webhook attempt to KV if configured
      const logEntry = {
        timestamp: new Date().toISOString(),
        ip: request.headers.get('CF-Connecting-IP') || 'unknown',
        userAgent: request.headers.get('User-Agent') || 'unknown',
        body: body.substring(0, 500), // First 500 chars
        proxy: url.hostname
      };
      
      if (env.WEBHOOK_LOGS) {
        try {
          const existing = await env.WEBHOOK_LOGS.get('recent_webhooks', 'json') || [];
          existing.unshift(logEntry);
          // Keep only last 50 entries
          await env.WEBHOOK_LOGS.put('recent_webhooks', JSON.stringify(existing.slice(0, 50)));
        } catch (kvError) {
          console.error('KV log error:', kvError);
        }
      }
      
      // Forward to master server
      const response = await fetch(`${masterServer}/api/webhook/textbelt`, {
        method: 'POST',
        headers: {
          'Content-Type': request.headers.get('Content-Type') || 'application/json',
          'X-Forwarded-For': request.headers.get('CF-Connecting-IP') || '',
          'X-Textbelt-Signature': request.headers.get('X-Textbelt-Signature') || '',
          'X-Textbelt-Timestamp': request.headers.get('X-Textbelt-Timestamp') || '',
          'X-Proxy-Domain': url.hostname, // Tell master which proxy received this
          'User-Agent': request.headers.get('User-Agent') || 'TextBelt-Webhook'
        },
        body: body
      });

      // Return master's response
      const responseBody = await response.text();
      
      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json'
        }
      });

    } catch (error) {
      console.error('Proxy error:', error);
      
      // Return success to TextBelt even if master is down
      // This prevents TextBelt from retrying and potentially flagging the domain
      return new Response(JSON.stringify({
        success: true,
        message: 'Webhook received (proxy)'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
};
