import Inspector from "./Inspector";

/** Keep the actual claim as the source; never substitute the graph illustration. */
export default function SandboxClaim({ claim, index, onInspect }: { claim: string; index: number; onInspect?: () => void }) {
  const fields = Object.fromEntries(claim.split("; ").flatMap((part) => {
    const split = part.indexOf(": ");
    return split > 0 ? [[part.slice(0, split), part.slice(split + 2)]] : [];
  }));
  const chain = ["p.name", "c.name", "g.name"].every((key) => fields[key]);
  return <li className="sandbox-claim">
    {chain ? <div className="claim-chain">{[["Platform", "p.name"], ["Component", "c.name"], ["Material", "g.name"]].map(([label, key]) => <div key={key}><span className="docref">{label}</span><strong>{fields[key]}</strong></div>)}</div> : <p>{claim}</p>}
    {chain && <p className="hint">Grouped claim fields, not direct edges.</p>}
    <Inspector label={`Inspect finding ${index + 1}`} title={`Sandbox finding ${index + 1}`} onOpen={onInspect}><p className="mono">{claim}</p><p className="hint">This is the sandbox brief&apos;s claim. The sandbox can use fixture evidence if the requested capture cannot be drafted. It is not proof of a real programme dependency.</p></Inspector>
  </li>;
}
