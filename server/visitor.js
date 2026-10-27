import { randomBytes, createHash } from 'node:crypto';

// The cookie is a bearer credential. Store only its hash in ownership records;
// never include either value in case responses, exports, or public links.
export function visitorSession(secure = false) {
  const cookieName = secure ? '__Host-qingdun_visitor' : 'qingdun_visitor';
  return (req, res, next) => {
    res.set('Cache-Control', 'private, no-store');
    const entries = (req.get('cookie') || '').split(';').map(part => part.trim());
    let token = entries.find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1);
    if (!/^[a-f0-9]{64}$/.test(token || '')) {
      token = randomBytes(32).toString('hex');
      res.cookie(cookieName, token, { httpOnly: true, sameSite: 'strict', secure, path: '/', maxAge: 365 * 24 * 60 * 60 * 1000 });
    }
    req.visitorId = createHash('sha256').update(token).digest('hex');
    next();
  };
}
