export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy /lab/api and subpaths to canonical SAT API backend
    if (url.pathname === '/lab/api' || url.pathname.startsWith('/lab/api/')) {
      const targetUrl = new URL(request.url);
      targetUrl.hostname = 'sat-api.desorden.cat';
      targetUrl.protocol = 'https:';
      targetUrl.port = '';

      if (targetUrl.pathname === '/lab/api/photos' || targetUrl.pathname.startsWith('/lab/api/photos/')) {
        targetUrl.pathname = targetUrl.pathname.replace('/lab/api/photos', '/lab/api/office/photos');
      }

      const upstreamReq = new Request(targetUrl.toString(), request);
      return fetch(upstreamReq);
    }

    // Serve static assets for all other routes including /lab and /lab/*
    return env.ASSETS.fetch(request);
  },
};
