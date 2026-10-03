// Hosted demo identity provider: fixed synthetic analyst/reviewer/owner accounts
// with NO passwords. It is only safe because the reverse proxy gates
// /idp/interaction/* behind an invite passphrase (deploy/Caddyfile). Do not
// publish this service without that gate, and never use it with real data.
import express from 'express';
import { Provider, errors } from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { readFile, writeFile } from 'node:fs/promises';

const need = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
};
const issuer = need('BOTHY_OIDC_ISSUER'); // e.g. https://bothy.example.com/idp
const mount = new URL(issuer).pathname.replace(/\/$/, '');
const resource = need('BOTHY_SSO_RESOURCE');
const audience = need('BOTHY_SSO_AUDIENCE');
const clientId = need('BOTHY_SSO_CLIENT_ID');
const clientSecret = need('BOTHY_SSO_CLIENT_SECRET');
const redirectUri = need('BOTHY_SSO_REDIRECT_URI');
const cookieKey = need('BOTHY_IDP_COOKIE_KEY');
const keyFile = process.env.IDP_KEY_FILE ?? '/data/jwk.json';

// Signing key persists so access tokens survive restarts.
let jwk;
try {
  jwk = JSON.parse(await readFile(keyFile, 'utf8'));
} catch {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  jwk = await exportJWK(privateKey);
  jwk.kid = 'bothy-demo-' + Date.now(); jwk.alg = 'RS256'; jwk.use = 'sig';
  await writeFile(keyFile, JSON.stringify(jwk), { mode: 0o600 });
}

const accounts = new Set(['analyst', 'reviewer', 'owner']);
const provider = new Provider(issuer, {
  clients: [{ client_id: clientId, client_secret: clientSecret, token_endpoint_auth_method: 'client_secret_post', redirect_uris: [redirectUri], response_types: ['code'], grant_types: ['authorization_code'], application_type: 'web' }],
  jwks: { keys: [jwk] },
  cookies: { keys: [cookieKey] },
  pkce: { required: () => true },
  features: { devInteractions: { enabled: false }, resourceIndicators: {
    enabled: true,
    getResourceServerInfo: async (_ctx, requested) => {
      if (requested !== resource) throw new errors.InvalidTarget();
      return { scope: 'openid profile email', audience, accessTokenFormat: 'jwt', jwt: { sign: { alg: 'RS256' } }, accessTokenTTL: 600 };
    },
  } },
  findAccount: async (_ctx, id) => accounts.has(id) ? { accountId: id, claims: async () => ({ sub: id }) } : undefined,
  interactions: { url: (_ctx, interaction) => `${mount}/interaction/${interaction.uid}` },
});
provider.proxy = true; // TLS terminates at the reverse proxy

const page = (title, body) => `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{background:#14161b;color:#c9ccd3;font:16px/1.5 system-ui;max-width:28rem;margin:4rem auto;padding:0 1.25rem}h1{color:#eee;font-weight:600;letter-spacing:-.03em}button{display:block;width:100%;margin:.6rem 0;padding:.85rem 1rem;background:none;border:1px solid #3a3d46;border-radius:.5rem;color:#eee;font:inherit;cursor:pointer}button:hover{border-color:#6cc3ee}small{color:#8a8d96}</style>${body}`;
const app = express();
app.disable('x-powered-by');
app.get(`${mount}/interaction/:uid`, async (req, res, next) => {
  try {
    const { prompt } = await provider.interactionDetails(req, res);
    res.set('Cache-Control', 'no-store');
    const uid = encodeURIComponent(req.params.uid);
    if (prompt.name === 'login') {
      res.send(page('Bothy demo sign-in', `<h1>Choose a demo role</h1><p>Synthetic role accounts for the Bothy prototype. No real identity or data.</p>${[...accounts].map(id => `<form method="post" action="${mount}/interaction/${uid}/login"><button name="account" value="${id}">Sign in as ${id}</button></form>`).join('')}<small>Invite-only. Protocol demonstration, not production authentication.</small>`));
    } else if (prompt.name === 'consent') {
      res.send(page('Authorize Bothy demo', `<h1>Authorize the Bothy demo session</h1><form method="post" action="${mount}/interaction/${uid}/confirm"><button>Authorize</button></form>`));
    } else res.status(400).send('Unsupported demo interaction');
  } catch (e) { next(e); }
});
app.post(`${mount}/interaction/:uid/login`, express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const details = await provider.interactionDetails(req, res);
    if (details.prompt.name !== 'login' || !accounts.has(req.body.account)) return res.sendStatus(400);
    await provider.interactionFinished(req, res, { login: { accountId: req.body.account } }, { mergeWithLastSubmission: false });
  } catch (e) { next(e); }
});
app.post(`${mount}/interaction/:uid/confirm`, async (req, res, next) => {
  try {
    const details = await provider.interactionDetails(req, res);
    if (details.prompt.name !== 'consent') return res.sendStatus(400);
    const grant = details.grantId ? await provider.Grant.find(details.grantId) : new provider.Grant({ accountId: details.session.accountId, clientId: details.params.client_id });
    if (details.prompt.details.missingOIDCScope) grant.addOIDCScope(details.prompt.details.missingOIDCScope.join(' '));
    if (details.prompt.details.missingOIDCClaims) grant.addOIDCClaims(details.prompt.details.missingOIDCClaims);
    for (const [indicator, scopes] of Object.entries(details.prompt.details.missingResourceScopes ?? {})) grant.addResourceScope(indicator, scopes.join(' '));
    const grantId = await grant.save();
    await provider.interactionFinished(req, res, { consent: { grantId } }, { mergeWithLastSubmission: true });
  } catch (e) { next(e); }
});
app.use(mount || '/', provider.callback());
app.listen(9099, '0.0.0.0');
