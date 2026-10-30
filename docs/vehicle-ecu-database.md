# JCS vehicle / ECU / read-write reference data

## Coverage today

- The original `ecu_catalogue` is retained: ~39 provisional JCS vehicle references in production.
- `vehicle_ecu_references` contains **94 curated vehicle/engine/ECU variants represented by 142 vendor connection-mode records**, across 14 manufacturers and 54 ECU-family labels.
- Initial reference: Magic Motorsport FLEX's publicly published **v4.8.0.0 historical vehicle list**. The snapshot is NOT current 2026 support and cannot be treated as a guarantee that a licensed or cloned tool can access any particular ECU.
- Current vendor directories: https://www.alientech-tools.com/en/vehicles , https://www.autotuner.com/pages/compatibility , https://magicmotorsport.us/?page_id=49390 .

## Evidence types and what they mean

1. `historic_vendor_list`: vehicle, ECU family, programming device and OBD/Bench/Boot/BDM connection shown in an older vendor list. **Read/write function is unknown** unless separately documented.
2. `current_vendor_list`: the same fields checked against the current official manufacturer application list, with source URL and review date.
3. `exact_hw_sw_verified`: in-house technical review with exact ECU HW/SW identifiers and verified licensed tool protocol; do not infer from model/engine alone.

Do NOT automatically say "safe", "supported", "full backup" or "best tool" based on engine-code, family name or a vendor's OBD label. Many ECUs have virtual reads, password/unlock prerequisites, limited segments, patching and firmware-specific restrictions. Boot, Bench and OBD can each have different risk and recovery characteristics.

## Input schema for licensed imports

Use `scripts/import-authorized-vehicle-ecu-json.mjs` with **vendor data you have permission to reproduce**. JSON array records:

```json
[{
  "make": "Volkswagen",
  "model": "Golf",
  "generation": "VI",
  "engine_code": "CFFB",
  "engine_label": "2.0 TDI CR",
  "power_ps": 140,
  "listed_year": 2012,
  "ecu_manufacturer": "Bosch",
  "ecu_family": "EDC17C46",
  "tool_name": "Magic Motorsport FLEX",
  "connection_method": "OBD",
  "read_capability": "unknown",
  "write_capability": "unknown",
  "coverage_status": "historic_vendor_list",
  "source_url": "https://www.magicmotorsport.com/wp-content/uploads/2020/06/Vehicle-List-Software-Flex-ECU-OBD-Bench-ver.4.8.0.0.pdf",
  "source_label": "Flex legacy vehicle reference",
  "source_year": 2020
}]
```

To inspect without writing:
```sh
node scripts/import-authorized-vehicle-ecu-json.mjs records.json --dry-run
```

To import after licensing and technical review:
```sh
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import-authorized-vehicle-ecu-json.mjs records.json --apply
```

Never put service keys in source control or client-facing environment variables. The importer caps input at 30,000 per run, validates each record, rejects duplicate identities, and upserts in batches. It does not automatically elevate records to exact ECU verification. If supplier permits a direct machine-readable export, obtain their written permission or contractual data feed; do not scrape/copy their entire proprietary application database.

## Search design

Customer-facing: `/dashboard/vehicle-ecu-search` for make, model, generation, engine code, ECU family, tool name and existing ECU part numbers. Every sourced result shows the manufacturer URL, snapshot year, and read/write operation status individually.

- Do not expand a single listed model year into a claimed production range.
- Show **multiple alternative ECU families** for one engine if source lists several. Example: VW Golf VII CLHB lists Bosch EDC17C64 and Continental PCR2.1 variants.
- Engine code only suggests ECU type. The technician must read the ECU ID/label (hardware number, software number) and use current vendor protocols before writing.
- In future: separate exact ECU identity table, protocols with vendor revision/date and verification history, and an admin review queue for imports.

## Release validation

- Migrations exist on **test** and test query confirmed 142 rows, 14 makes, 54 ECU labels.
- Verify source query results for AXR, ASZ, BPX, CAYC, CFFB, MED9.1, and Ford/BMW/Peugeot makes.
- Confirm unauthenticated API returns 401, customer cannot mutate tables, and service key is never exposed.
- Validate login, pagination, method filtering, source links, phone layout and no-results messaging.
- Apply migrations to production **before merging**. Run the Vercel production build and verify user-facing results after deploy.
