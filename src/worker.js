const LAB_USERNAME = 'desorden';
const LAB_PASSWORD_SHA256 = '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4';

function unauthorized() {
  return new Response('Autenticación requerida', {
    status: 401,
    headers: {
      'WWW-Authenticate': 'Basic realm="DESORDEN LAB", charset="UTF-8"',
      'Cache-Control': 'no-store',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}

function decodeBasicAuth(headerValue) {
  if (!headerValue || !headerValue.startsWith('Basic ')) return null;
  try {
    const decoded = atob(headerValue.slice(6));
    const separator = decoded.indexOf(':');
    if (separator < 0) return null;
    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function constantTimeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

async function isLabAuthorized(request) {
  const credentials = decodeBasicAuth(request.headers.get('Authorization'));
  if (!credentials) return false;
  if (!constantTimeEqual(credentials.username, LAB_USERNAME)) return false;
  const providedHash = await sha256Hex(credentials.password);
  return constantTimeEqual(providedHash, LAB_PASSWORD_SHA256);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const isLabRequest = url.pathname === '/lab' || url.pathname.startsWith('/lab/');

    if (isLabRequest && !(await isLabAuthorized(request))) {
      return unauthorized();
    }

    return env.ASSETS.fetch(request);
  },
};
