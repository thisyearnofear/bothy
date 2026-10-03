/** Defense scenario catalogue: reviewed read-only queries.
 * Original queries were venue-tested; gallium-chain was validated locally on
 * 2026-10-03 at fa702a0364247caf. No CREATE/SET.
 */

import type { GraphScenario } from "../../../../packages/shared/src/types";

export const SCENARIOS: GraphScenario[] = [
  {
    id: "loitering-bom",
    title: "Loitering-munition mineral bill of materials",
    stakes: "Which raw minerals underpin the loitering-munition programme — the denial surface for export control.",
    graph: "supply_chain_deep",
    cypher:
      "MATCH (p:Platform {archetype:'Loitering munition'})-[:CONTAINS]->{8,8}(m:Mineral) RETURN DISTINCT p.name, m.name",
    kind: "blast-radius",
    howToRead: "Each row is one (platform variant, raw mineral) pair exactly 8 CONTAINS hops down the BoM.",
    eyAngle: "Lead with mineral count per variant; flag single-source-looking ores for the camera.",
  },
  {
    id: "gallium-exposure",
    title: "Primary-gallium platform exposure",
    stakes: "Every platform ultimately dependent on primary gallium — the chokepoint material for AESA radars and EW.",
    graph: "supply_chain_deep",
    cypher:
      "MATCH (p:Platform)-[:CONTAINS]->+(:Material {name:'Primary gallium'}) RETURN DISTINCT p.name LIMIT 50",
    kind: "material-exposure",
    howToRead: "One platform name per row; any depth of CONTAINS chain ending at Primary gallium.",
    eyAngle: "Count the platforms, then name the scariest three (AD assets, strike, ISR).",
  },
  {
    id: "gallium-chain",
    title: "Explain an illustrative gallium dependency",
    stakes: "Inspect a sampled synthetic platform-to-component chain; verify the real programme mapping separately.",
    graph: "supply_chain_deep",
    cypher: "MATCH (p:Platform)-[:CONTAINS]->(s:System)-[:CONTAINS]->(ss:Subsystem)-[:CONTAINS]->(a:Assembly)-[:CONTAINS]->(sa:Subassembly)-[:CONTAINS]->(c:Component)-[:CONTAINS]->(m:Material)-[:CONTAINS]->{1,4}(g:Material {name:'Primary gallium'}) RETURN DISTINCT p.name, p.archetype, s.name, ss.name, a.name, sa.name, c.name, c.family, m.name, g.name LIMIT 10",
    kind: "dependency-explanation",
    howToRead: "One sampled modeled chain per row. The last segment is bounded connectivity through 1–4 edges; intermediate material nodes are not returned. Platforms and parts are synthetic. Ten rows are not a total exposure count.",
  },
  {
    id: "chn-ownership",
    title: "NATO-HQ firms ultimately owned in China",
    stakes: "NATO-headquartered companies whose ownership chain terminates in CHN — leverage and takeover risk.",
    graph: "supply_chain_deep",
    cypher:
      "MATCH (:Country {nato_member:true})<-[:HEADQUARTERED_IN]-(c:Company)-[:SUBSIDIARY_OF]->+(u:Company {hq_country:'CHN'}) RETURN DISTINCT c.name, u.name LIMIT 20",
    kind: "ownership",
    howToRead: "Each row pairs a NATO-HQ company with its ultimate CHN parent.",
    eyAngle: "Read two pairs aloud; stress 'ultimate parent', not direct owner.",
  },
  {
    id: "taiwan-chokepoint",
    title: "Final-assembly primes fed via the Taiwan Strait",
    stakes: "Which final-assembly plants depend on shipments transiting the Taiwan Strait — the blockade scenario.",
    graph: "supply_chain_deep",
    cypher:
      "MATCH (s:Shipment)-[:TRANSITED]->(:Chokepoint {name:'Taiwan Strait'}), (s)-[:SHIPPED_TO]->(f:Facility)-[:SUPPLIES]->+(prime:Facility {facility_type:'final assembly plant'}) RETURN DISTINCT prime.name LIMIT 20",
    kind: "chokepoint",
    howToRead: "One final-assembly plant per row; all downstream of at least one Taiwan Strait transit.",
    eyAngle: "Name three primes, then ask what a 30-day closure does to output.",
  },
  {
    id: "sanctions-exposure",
    title: "Sanctioned-parent facilities supplying NATO",
    stakes: "Facilities under EU-sanctioned ownership that still feed NATO-country plants — the enforcement gap.",
    graph: "supply_chain_deep",
    cypher:
      "MATCH (f:Facility)-[:OPERATED_BY]->(:Company)-[:SUBSIDIARY_OF]->+(u:Company)-[:HEADQUARTERED_IN]->(:Country {eu_sanctions_target:true}), (f)-[:SUPPLIES]->(b:Facility)-[:LOCATED_IN]->(:Country {nato_member:true}) RETURN DISTINCT f.name, u.name, b.name LIMIT 20",
    kind: "sanctions",
    howToRead: "Each row: source facility, its sanctioned ultimate owner, and the NATO-country buyer plant.",
    eyAngle: "Pick one row and walk source → owner → buyer as the enforcement story.",
  },
  {
    id: "red-sea-d01",
    title: "Red Sea disruption D01 shipment impact",
    stakes: "Status breakdown of shipments hit by disruption D01 — delivered vs in-transit vs blocked right now.",
    graph: "supply_chain_deep",
    cypher:
      "MATCH (s:Shipment)-[:IMPACTED_BY]->(d:Disruption) WHERE d.disruption_id='D01' RETURN s.status, count(s)",
    kind: "disruption",
    howToRead: "One row per shipment status with its count; 'blocked' is the immediate casualty list.",
    eyAngle: "Lead with the blocked count, then the in-transit tail at risk.",
  },
  {
    id: "ukr-energy-near",
    title: "Ukrainian power-plant proximity pairs",
    stakes: "Which Ukrainian plants sit near each other — cascading-strike and grid-resilience picture.",
    graph: "power_plants",
    cypher:
      "MATCH (p:PowerPlant)-[e:NEAR]-(q:PowerPlant)-[:LOCATED_IN]->(co:Country) WHERE p.country_code='UKR' RETURN p.name, q.name, co.name, e.distance_km LIMIT 12",
    kind: "energy-proximity",
    howToRead: "Each row is a near-neighbour plant pair with distance_km; 0.0 means same-site units.",
    eyAngle: "Point at the closest pair; ask what one strike takes out.",
  },
  {
    id: "logistics-high-risk",
    title: "High-risk shipments by supplier country",
    stakes: "Where high-risk classified shipments concentrate by supplier country — the watch-list for interdiction.",
    graph: "logistics_risk",
    cypher:
      "MATCH (s:Shipment)-[:FROM_SUPPLIER]->(sup:Supplier)-[:LOCATED_IN]->(co:Country), (s)-[:CLASSIFIED_AS]->(:RiskClassification {name:'High Risk'}) RETURN co.name, count(s) ORDER BY count(s) DESC LIMIT 10",
    kind: "risk-concentration",
    howToRead: "One row per supplier country with its high-risk shipment count, worst first.",
    eyAngle: "Read the top three countries and counts; ask why they cluster.",
  },
];

export function getScenarioDef(id: string): GraphScenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}
