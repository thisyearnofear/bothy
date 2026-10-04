export default function BriefSpecimen() {
  return <figure className="brief-specimen frame">
    <figcaption className="specimen-heading">
      <span className="eyebrow">The deliverable</span>
      <span className="docref">Illustrative layout · synthetic example</span>
    </figcaption>
    <div className="specimen-chain" aria-label="Example exposure chain">
      <div><span className="docref">Disruption</span><strong>Gallium delay</strong></div>
      <div><span className="docref">Dependency</span><strong>RF component</strong></div>
      <div><span className="docref">Programme</span><strong>Sample platform</strong></div>
    </div>
    <dl className="specimen-record">
      <div><dt>Evidence</dt><dd>Stored dependency row + source version</dd></div>
      <div><dt>Gap</dt><dd>Inventory, alternates and delivery timing unverified</dd></div>
      <div><dt>Decision</dt><dd>Reviewer authorizes a check, not an intervention</dd></div>
      <div><dt>Task</dt><dd>Named owner + due date + retained finding</dd></div>
    </dl>
    <p className="hint specimen-foot">An exposure chain is not proof of a stoppage. This example is not a captured case.</p>
  </figure>;
}
