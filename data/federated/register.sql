-- Registers the in-repo ops extract (inventory-contracts.csv) as a Zetaris
-- filestore table. The CSV must first be reachable by the Zetaris driver:
-- on the VPS stack it goes into the shared customer-data volume at
-- /home/zetaris/customer-data/shared/ (see scripts/federation.sh push).
CREATE LIGHTNING DATABASE BOTHY_OPS DESCRIBE BY "Bothy ops extracts - analyst-side data the graph never ingested";

CREATE LIGHTNING FILESTORE TABLE inventory_contracts FROM BOTHY_OPS FORMAT CSV OPTIONS (
  PATH "/home/zetaris/customer-data/shared/inventory-contracts.csv",
  header "true",
  inferSchema "true"
);

-- Verify: SELECT * FROM BOTHY_OPS.inventory_contracts LIMIT 10;
