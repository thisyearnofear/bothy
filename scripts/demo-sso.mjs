import express from 'express';
import { Provider, errors } from 'oidc-provider';
import { generateKeyPair, exportJWK } from 'jose';
import { randomBytes } from 'node:crypto';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

// Disposable protocol rehearsal only. Never bind beyond loopback or use buyer data.
if (process.env.NODE_ENV === 'production') throw new Error('Local demo identity is forbidden in production');
const issuer = 'http://127.0.0.1:9099';
const resource = 'http://127.0.0.1:8798';
const secret = randomBytes(32).toString('hex');
const { privateKey } = await generateKeyPair('RS256', { extractable: true });
const jwk = await exportJWK(privateKey);
jwk.kid = 'disposable-demo'; jwk.alg = 'RS256'; jwk.use = 'sig';
const accounts = new Set(['analyst', 'reviewer', 'owner']);
const provider = new Provider(issuer, {
  clients: [{ client_id: 'bothy-demo-web', client_secret: secret, token_endpoint_auth_method: 'client_secret_post', redirect_uris: ['http://127.0.0.1:3001/api/auth/callback'], response_types: ['code'], grant_types: ['authorization_code'], application_type: 'web' }],
  jwks: { keys: [jwk] },
  pkce: { required: () => true },
  features: { devInteractions: { enabled: false }, resourceIndicators: {
    enabled: true,
    getResourceServerInfo: async (_ctx, requested) => {
      if (requested !== resource) throw new errors.InvalidTarget();
      return { scope: 'openid profile email', audience: 'bothy-demo-api', accessTokenFormat: 'jwt', jwt: { sign: { alg: 'RS256' } }, accessTokenTTL: 600 };
    },
  } },
  findAccount: async (_ctx, id) => accounts.has(id) ? { accountId: id, claims: async () => ({ sub: id }) } : undefined,
  interactions: { url: (_ctx, interaction) => `/interaction/${interaction.uid}` },
});
const app = express();
app.get('/interaction/:uid', async (req, res, next) => {
  try {
    const { prompt } = await provider.interactionDetails(req, res);
    res.set('Cache-Control', 'no-store');
    if (prompt.name === 'login') {
      // Fixed disposable accounts, no passwords or production identity claim.
      res.send(`<!doctype html><title>Bothy local demo sign-in</title><h1>Disposable local demo identity</h1><p>Protocol rehearsal only. Choose a fixed synthetic role account.</p>${[...accounts].map(id => `<form method="post" action="/interaction/${encodeURIComponent(req.params.uid)}/login"><button name="account" value="${id}">Sign in as ${id}</button></form>`).join('')}`);
    } else if (prompt.name === 'consent') {
      res.send(`<!doctype html><title>Authorize local demo</title><h1>Authorize Bothy local demo</h1><form method="post" action="/interaction/${encodeURIComponent(req.params.uid)}/confirm"><button>Authorize demo session</button></form>`);
    } else res.status(400).send('Unsupported demo interaction');
  } catch (e) { next(e); }
});
app.post('/interaction/:uid/login', express.urlencoded({ extended: false }), async (req, res, next) => {
  try {
    const details = await provider.interactionDetails(req, res);
    if (details.prompt.name !== 'login' || !accounts.has(req.body.account)) return res.sendStatus(400);
    await provider.interactionFinished(req, res, { login: { accountId: req.body.account } }, { mergeWithLastSubmission: false });
  } catch (e) { next(e); }
});
app.post('/interaction/:uid/confirm', async (req, res, next) => {
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
app.use(provider.callback());
const server = app.listen(9099, '127.0.0.1');
const data = await mkdtemp(join(tmpdir(), 'bothy-sso-demo-'));
const common = {
  ...process.env, NODE_ENV: 'development',
  BOTHY_OIDC_ALLOW_LOCAL_DEMO: 'true', BOTHY_OIDC_ISSUER: issuer,
  BOTHY_OIDC_JWKS_URL: `${issuer}/jwks`, BOTHY_OIDC_AUDIENCE: 'bothy-demo-api',
  BOTHY_OIDC_PRINCIPALS: JSON.stringify({ analyst: ['analyst'], reviewer: ['reviewer'], owner: ['action-owner'] }),
  BOTHY_SSO_AUTHORIZE_URL: `${issuer}/auth`, BOTHY_SSO_TOKEN_URL: `${issuer}/token`,
  BOTHY_SSO_CLIENT_ID: 'bothy-demo-web', BOTHY_SSO_CLIENT_SECRET: secret,
  BOTHY_SSO_AUDIENCE: 'bothy-demo-api', BOTHY_SSO_RESOURCE: resource,
  BOTHY_SSO_REDIRECT_URI: 'http://127.0.0.1:3001/api/auth/callback',
  BOTHY_SESSION_SECRET: randomBytes(48).toString('hex'),
  BOTHY_DATA_DIR: data, DATABASE_URL: 'postgres://unused:unused@127.0.0.1:59999/unused',
  AGENT_HOST: '127.0.0.1', AGENT_URL: resource,
  PUBLIC_WEB_URL: 'http://127.0.0.1:3001', WEB_ORIGIN: 'http://127.0.0.1:3001',
};
const children = [
  spawn('npm', ['-w', '@bothy/agent', 'run', 'start'], { env: { ...common, PORT: '8798' }, stdio: 'inherit', detached: true }),
  spawn('npm', ['-w', '@bothy/web', 'run', 'dev', '--', '--hostname', '127.0.0.1', '--port', '3001'], { env: common, stdio: 'inherit', detached: true }),
];
console.log('Disposable SSO provider: http://127.0.0.1:9099; web: http://127.0.0.1:3001/defense');
console.log('Secrets and signing keys are ephemeral; no buyer identities configured.');
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* child already exited */ } }
  }
  server.close();
  setTimeout(() => process.exit(0), 1000);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, stop);
for (const child of children) { child.on('error', stop); child.on('exit', stop); }
server.on('error', stop);
