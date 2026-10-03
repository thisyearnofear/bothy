import { q } from "./db";

/**
 * Only approved assessments may leave the external sender. Log-only mode does
 * not mark an email sent; queued rows remain available for real delivery.
 * Run on a schedule (cron / Coolify scheduled job / AgentCore Scheduler later).
 */
const RESEND_URL = "https://api.resend.com/emails";

interface DigestDeps {
  query: typeof q;
  fetch: typeof fetch;
  env: NodeJS.ProcessEnv;
  log: (message: string) => void;
}

export async function sendDigest(limit = 20, deps: DigestDeps = {
  query: q, fetch: globalThis.fetch, env: process.env, log: console.log,
}): Promise<{ sent: number; skipped: number; logged: number }> {
  const { rows } = await deps.query(
    `SELECT n.id, n.target, n.route_id, n.scenario, n.label, n.assessment_id, a.draft, a.score, a.confidence,
       a.status AS assessment_status
     FROM notifications n JOIN assessments a ON a.id = n.assessment_id
     WHERE n.status = 'queued' AND a.status = 'approved' ORDER BY n.id LIMIT $1`,
    [limit]
  );
  let sent = 0;
  let logged = 0;
  const apiKey = deps.env.RESEND_API_KEY;
  const from = deps.env.DIGEST_FROM ?? "Bothy <alerts@bothy.trustfall.xyz>";
  const appBase = deps.env.PUBLIC_APP_URL ?? "https://bothy.trustfall.xyz";
  for (const r of rows as Record<string, unknown>[]) {
    if (r.assessment_status !== "approved") continue;
    const id = r.id as number;
    const subject = `Bothy: ${r.route_id} is ${r.label} (score ${Number(r.score).toFixed(2)})`;
    const body = [
      `Bothy community-risk digest`,
      ``,
      `Route: ${r.route_id} — ${r.label} (score ${Number(r.score).toFixed(2)}, confidence ${Number(r.confidence).toFixed(2)})`,
      ``,
      String(r.draft ?? ""),
      ``,
      `Approved case: ${appBase}/case/${r.assessment_id}`,
      ``,
      `Bothy drafts; a duty officer approves. Reply STOP to unsubscribe.`,
    ].join("\n");
    try {
      if (apiKey) {
        const res = await deps.fetch(RESEND_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from, to: [r.target as string], subject, text: body }),
        });
        if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
      } else {
        deps.log(`[digest:log-only] approved notification ${id}; no email dispatched`);
        logged++;
        continue;
      }
      await deps.query(`UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`, [id]);
      sent++;
    } catch (e) {
      await deps.query(`UPDATE notifications SET status = 'failed', error = $2 WHERE id = $1`, [id, String((e as Error)?.message ?? e)]);
    }
  }
  return { sent, skipped: rows.length - sent, logged };
}
