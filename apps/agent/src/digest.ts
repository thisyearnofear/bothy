import { q } from "./db";

/**
 * Digest sender: flips queued notifications to sent via Resend (or logs the
 * email body when no RESEND_API_KEY is set, so the demo never hard-fails).
 * Run on a schedule (cron / Coolify scheduled job / AgentCore Scheduler later).
 */
const RESEND_URL = "https://api.resend.com/emails";

export async function sendDigest(limit = 20): Promise<{ sent: number; skipped: number }> {
  const { rows } = await q(
    `SELECT n.id, n.target, n.route_id, n.scenario, n.label, n.assessment_id, a.draft, a.score, a.confidence
     FROM notifications n JOIN assessments a ON a.id = n.assessment_id
     WHERE n.status = 'queued' ORDER BY n.id LIMIT $1`,
    [limit]
  );
  let sent = 0;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.DIGEST_FROM ?? "Bothy <alerts@bothy.trustfall.xyz>";
  const appBase = process.env.PUBLIC_APP_URL ?? "https://bothy.trustfall.xyz";
  for (const r of rows as Record<string, unknown>[]) {
    const id = r.id as number;
    const subject = `Bothy: ${r.route_id} is ${r.label} (score ${Number(r.score).toFixed(2)})`;
    const body = [
      `Bothy community-risk digest`,
      ``,
      `Route: ${r.route_id} — ${r.label} (score ${Number(r.score).toFixed(2)}, confidence ${Number(r.confidence).toFixed(2)})`,
      ``,
      String(r.draft ?? ""),
      ``,
      `Review and sign: ${appBase}/case/${r.assessment_id}`,
      ``,
      `Bothy drafts; a duty officer approves. Reply STOP to unsubscribe.`,
    ].join("\n");
    try {
      if (apiKey) {
        const res = await fetch(RESEND_URL, {
          method: "POST",
          headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
          body: JSON.stringify({ from, to: [r.target as string], subject, text: body }),
        });
        if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`);
      } else {
        console.log(`[digest:log-only] to=${r.target} subject=${JSON.stringify(subject)}\n${body}\n---`);
      }
      await q(`UPDATE notifications SET status = 'sent', sent_at = now() WHERE id = $1`, [id]);
      sent++;
    } catch (e) {
      await q(`UPDATE notifications SET status = 'failed', error = $2 WHERE id = $1`, [id, String((e as Error)?.message ?? e)]);
    }
  }
  // Touch the assessment so the case page can show digest state (best-effort).
  return { sent, skipped: rows.length - sent };
}
