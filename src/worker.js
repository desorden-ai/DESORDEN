const SAT_API_ORIGIN = 'https://sat-api.desorden.cat';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy LAB and SAT API requests directly to the canonical SAT API
    if (
      url.pathname === '/lab/api' ||
      url.pathname.startsWith('/lab/api/') ||
      url.pathname === '/api' ||
      url.pathname.startsWith('/api/')
    ) {
      const targetUrl = new URL(url.pathname + url.search, SAT_API_ORIGIN);
      const newHeaders = new Headers(request.headers);
      newHeaders.set('Host', 'sat-api.desorden.cat');

      const proxyReq = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'manual',
      });

      return fetch(proxyReq);
    }

    // Serve static assets from public/ (including /lab/)
    return env.ASSETS.fetch(request);
  },
};

