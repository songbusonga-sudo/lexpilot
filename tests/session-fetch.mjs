// Node fetch has no cookie jar. Reuse one visitor per integration test, and
// share that visitor with Playwright when the test also drives a browser.
export function createSessionFetch(context) {
  let cookie = '';
  return async (url, options = {}) => {
    if (context) {
      cookie = (await context.cookies(url)).map(c => `${c.name}=${c.value}`).join('; ');
    }
    const headers = new Headers(options.headers);
    if (cookie) headers.set('cookie', cookie);
    const response = await globalThis.fetch(url, { ...options, headers });
    const value = response.headers.get('set-cookie');
    if (value) {
      cookie = value.split(';')[0];
      if (context) {
        const index = cookie.indexOf('=');
        await context.addCookies([{ name: cookie.slice(0, index), value: cookie.slice(index + 1), url: new URL(url).origin, httpOnly: true, sameSite: 'Strict' }]);
      }
    }
    return response;
  };
}
