# Service boundaries and specialist partners: exact terms

The exact terms of the clauses in the “Service boundaries and specialist partners” area of [CONTRACT.md](../../../CONTRACT.md). Each clause there is the requirement; the terms below define it.

## BOUND-003 — Coordinate emergency and physical work with people

Exact semantics: WORK-001’s safety cases carry this boundary. Terrace delivers the approved guidance to staff who read it to the caller, alerts people by the installation’s email (a sign-in link, labeled with the provider’s outcome) and an urgent queue, takes acknowledgement only from the named on-call person or backup, and keeps the case open until the owner or a portfolio manager records field-work evidence and the resident’s follow-up; an email the provider accepted is never shown as a person reached or as emergency assistance. Escalation reaches people by the installation’s email and the in-app urgent queue; timed SMS/voice paging is WORK-001’s and PORTAL-005’s (ct ruling 18:50Z).

## BOUND-004 — Stay residential: no commercial leases, CAM or HOA dues

In Terrace tenancy CSV v1 the optional `lease_type` column marks a row: empty or `residential` (any letter case) imports, and any other value is held as a rejected exception naming that value, so the reviewed file cannot be approved and nothing from it loads until the row is removed. Each incumbent importer (MOVE-002 through MOVE-007) inherits this hold for the lease or property type its source carries before it ships (MOVE-001).
