import type { DatabaseSync } from "node:sqlite";
import type { AnchorKind, AnchorMoment, AnchorRecord, AnchorState } from "../../../packages/shared/src/anchor";
import { postReceipt, type ArweaveResult } from "./integrations/arweave";

// AnchorStore: durable record of evidence-anchor attempts in the loop SQLite
// database — the same store that survives restarts on venue floors with no
// tunnel. One row per (kind, subjectId, moment): it starts `pending`, then
// resolves to `anchored` (txId/url) or `failed` (reason) once Arweave answers.
// `anchored` is terminal — re-anchoring a cached assessment must not spend AR
// again — while `failed` is retried on the next call.

interface Row {
  kind: string;
  subject_id: string;
  moment: string;
  state: string;
  digest: string;
  tx_id: string | null;
  url: string | null;
  gateway: string;
  receipt: string;
  reason: string | null;
  at: string;
}

type Poster = (receipt: Record<string, unknown>, tags: Record<string, string>) => Promise<ArweaveResult>;

const toRecord = (r: Row): AnchorRecord => ({
  kind: r.kind as AnchorKind,
  subjectId: r.subject_id,
  moment: r.moment as AnchorMoment,
  state: r.state as AnchorState,
  digest: r.digest,
  ...(r.tx_id ? { txId: r.tx_id } : {}),
  ...(r.url ? { url: r.url } : {}),
  gateway: r.gateway,
  receipt: JSON.parse(r.receipt) as Record<string, unknown>,
  ...(r.reason ? { reason: r.reason } : {}),
  at: r.at,
});

export class AnchorStore {
  constructor(
    private db: DatabaseSync,
    private post: Poster = postReceipt,
  ) {
    db.exec(`CREATE TABLE IF NOT EXISTS evidence_anchors (
      kind TEXT NOT NULL,
      subject_id TEXT NOT NULL,
      moment TEXT NOT NULL,
      state TEXT NOT NULL,
      digest TEXT NOT NULL,
      tx_id TEXT,
      url TEXT,
      gateway TEXT NOT NULL,
      receipt TEXT NOT NULL,
      reason TEXT,
      at TEXT NOT NULL,
      PRIMARY KEY (kind, subject_id, moment)
    )`);
  }

  list(kind: AnchorKind, subjectId: string): AnchorRecord[] {
    const rows = this.db
      .prepare(`SELECT * FROM evidence_anchors WHERE kind = ? AND subject_id = ? ORDER BY rowid`)
      .all(kind, subjectId) as unknown as Row[];
    return rows.map(toRecord);
  }

  get(kind: AnchorKind, subjectId: string, moment: AnchorMoment): AnchorRecord | null {
    const row = this.db
      .prepare(`SELECT * FROM evidence_anchors WHERE kind = ? AND subject_id = ? AND moment = ?`)
      .get(kind, subjectId, moment) as unknown as Row | undefined;
    return row ? toRecord(row) : null;
  }

  // Writes the `pending` row synchronously so a client's first poll already
  // sees the attempt, then resolves it against Arweave. Never throws: every
  // failure lands as a `failed` row so the UI can report honestly and retry.
  async anchor(
    kind: AnchorKind,
    subjectId: string,
    moment: AnchorMoment,
    digest: string,
    extras: Record<string, unknown>,
  ): Promise<AnchorRecord> {
    try {
      const existing = this.get(kind, subjectId, moment);
      if (existing?.state === "anchored") return existing;
      // A fresh pending row means another call is already posting — don't
      // spend AR twice for the same key.
      if (existing?.state === "pending" && Date.now() - Date.parse(existing.at) < 60_000) {
        return existing;
      }

      const at = new Date().toISOString();
      const receipt = { v: 2, app: "bothy", kind, subjectId, moment, digest, at, ...extras };
      this.db
        .prepare(
          `INSERT INTO evidence_anchors (kind, subject_id, moment, state, digest, tx_id, url, gateway, receipt, reason, at)
           VALUES (?, ?, ?, 'pending', ?, NULL, NULL, ?, ?, NULL, ?)
           ON CONFLICT (kind, subject_id, moment) DO UPDATE SET
             state = 'pending', digest = excluded.digest, tx_id = NULL, url = NULL,
             receipt = excluded.receipt, reason = NULL, at = excluded.at`,
        )
        .run(kind, subjectId, moment, digest, "https://arweave.net", JSON.stringify(receipt), at);

      const result = await this.post(receipt, {
        Kind: kind,
        Moment: moment,
        Subject: subjectId,
        Digest: digest,
      });

      if (result.posted) {
        this.db
          .prepare(
            `UPDATE evidence_anchors SET state = 'anchored', tx_id = ?, url = ?, gateway = ?, reason = NULL
             WHERE kind = ? AND subject_id = ? AND moment = ?`,
          )
          .run(result.txId ?? "", result.url ?? "", result.gateway, kind, subjectId, moment);
      } else {
        this.db
          .prepare(
            `UPDATE evidence_anchors SET state = 'failed', reason = ?, gateway = ?
             WHERE kind = ? AND subject_id = ? AND moment = ?`,
          )
          .run(result.reason ?? "post failed", result.gateway, kind, subjectId, moment);
      }
      return this.get(kind, subjectId, moment)!;
    } catch (e) {
      // Even the bookkeeping failed — report failed state without throwing.
      const reason = e instanceof Error ? e.message : String(e);
      try {
        this.db
          .prepare(
            `INSERT INTO evidence_anchors (kind, subject_id, moment, state, digest, gateway, receipt, reason, at)
             VALUES (?, ?, ?, 'failed', ?, ?, ?, ?, ?)
             ON CONFLICT (kind, subject_id, moment) DO UPDATE SET
               state = 'failed', reason = excluded.reason, at = excluded.at`,
          )
          .run(kind, subjectId, moment, digest, "https://arweave.net", "{}", reason, new Date().toISOString());
      } catch { /* database itself is down — nothing more to record */ }
      return {
        kind,
        subjectId,
        moment,
        state: "failed",
        digest,
        gateway: "https://arweave.net",
        receipt: {},
        reason,
        at: new Date().toISOString(),
      };
    }
  }

  // Fire-and-forget: background anchoring must never reject unhandled (the
  // server's async wrapper does not cover detached promises).
  anchorInBackground(
    kind: AnchorKind,
    subjectId: string,
    moment: AnchorMoment,
    digest: string,
    extras: Record<string, unknown>,
  ): void {
    void this.anchor(kind, subjectId, moment, digest, extras).catch(() => {});
  }
}
