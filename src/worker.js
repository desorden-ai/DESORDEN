const SAT_API_ORIGIN = 'https://sat-api.desorden.cat';

const LAB_OPERATOR_NAME_BOOTSTRAP = `
// LAB compatibility bootstrap. Remove once lab.js contains its own helper.
globalThis.operatorName = globalThis.operatorName || function operatorName(operatorId) {
  if (!operatorId) return '—';
  try {
    const options = document.querySelectorAll('#job-operator option');
    for (const option of options) {
      if (option.value === operatorId) return option.textContent || operatorId;
    }
  } catch (_) {}
  return operatorId;
};
`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Proxy LAB and SAT API requests directly to the canonical SAT API.
    if (
      url.pathname === '/lab/api' ||
      url.pathname.startsWith('/lab/api/') ||
      url.pathname === '/api' ||
      url.pathname.startsWith('/api/')
    ) {
      const targetUrl = new URL(url.pathname + url.search, SAT_API_ORIGIN);
      const newHeaders = new Headers(request.headers);
      newHeaders.delete('Host');

      const proxyReq = new Request(targetUrl.toString(), {
        method: request.method,
        headers: newHeaders,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
        redirect: 'manual',
      });

      const upstream = await fetch(proxyReq);
      const headers = new Headers(upstream.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers,
      });
    }

    // Serve lab.js with a tiny compatibility bootstrap so stale/static LAB
    // clients cannot crash on the previously missing operatorName helper.
    if (url.pathname === '/lab/lab.js') {
      const asset = await env.ASSETS.fetch(request);
      if (!asset.ok) return asset;
      const source = await asset.text();
      const headers = new Headers(asset.headers);
      headers.set('Content-Type', 'application/javascript; charset=utf-8');
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return new Response(`${LAB_OPERATOR_NAME_BOOTSTRAP}\n${source}`, {
        status: asset.status,
        headers,
      });
    }

    // Avoid stale LAB HTML after production fixes.
    if (url.pathname === '/lab/' || url.pathname === '/lab/index.html') {
      const asset = await env.ASSETS.fetch(request);
      const headers = new Headers(asset.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      return new Response(asset.body, {
        status: asset.status,
        statusText: asset.statusText,
        headers,
      });
    }

    // Serve static assets from public/ (including /lab/).
    return env.ASSETS.fetch(request);
  },
};
