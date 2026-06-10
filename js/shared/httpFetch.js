/**
 * Browser fetch helper — Nagwa APIs support CORS (allow-origin: *).
 * Always try direct fetch first; fall back to same-origin /proxy or configured proxy.
 */

export const NAGWA_DIRECT_HOSTS = new Set([
  'admin.classes.nagwa.com',
  'qms-api.nagwa.com',
  '12digit.nagwa.com',
]);

export function hostFromUrl(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export function shouldBypassProxy(url) {
  return NAGWA_DIRECT_HOSTS.has(hostFromUrl(url));
}

function sameOriginProxyBase() {
  if (typeof window === 'undefined' || !window.location?.origin) return '';
  const { protocol, origin } = window.location;
  if (protocol !== 'http:' && protocol !== 'https:') return '';
  return `${origin}/proxy`;
}

function proxyGetUrl(proxyBase, targetUrl) {
  return `${proxyBase.replace(/\/$/, '')}?url=${encodeURIComponent(targetUrl)}`;
}

async function fetchViaProxy(proxyBase, url, init = {}) {
  const method = init.method || 'GET';
  const headers = init.headers || {};
  const proxyUrl = proxyGetUrl(proxyBase, url);

  if (method === 'GET' || method === 'HEAD') {
    return fetch(proxyUrl, { method, headers, signal: init.signal });
  }
  return fetch(proxyUrl, { method, headers, body: init.body, signal: init.signal });
}

/**
 * @param {() => string} getProxyUrl
 * @returns {typeof fetch}
 */
export function createAppFetch(getProxyUrl) {
  return async function appFetch(url, init = {}) {
    const nagwaDirect = shouldBypassProxy(url);

    if (nagwaDirect) {
      try {
        return await fetch(url, { ...init, credentials: 'omit', mode: 'cors' });
      } catch (directErr) {
        const configured = (getProxyUrl() || '').trim().replace(/\/$/, '');
        const sameOrigin = sameOriginProxyBase();
        const fallbacks = [configured, sameOrigin].filter((p, i, arr) => p && arr.indexOf(p) === i);

        for (const proxyBase of fallbacks) {
          try {
            return await fetchViaProxy(proxyBase, url, init);
          } catch {
            /* try next */
          }
        }
        throw directErr;
      }
    }

    const proxy = (getProxyUrl() || '').trim().replace(/\/$/, '');
    if (!proxy || url.startsWith(proxy)) {
      return fetch(url, init);
    }

    return fetchViaProxy(proxy, url, init);
  };
}

/**
 * @param {typeof fetch} fetchFn
 */
export async function probeMetasessionApi(fetchFn, apiKey) {
  const url = 'https://admin.classes.nagwa.com/api/v1/metasessions/414140197345/';
  const response = await fetchFn(url, {
    method: 'GET',
    headers: {
      'X-API-KEY': apiKey,
      Accept: 'application/json',
    },
  });
  return response.ok;
}
