# MOVE-013 frozen rubric — Mark checklist coverage only for proven replacement

Frozen by ct on 2026-11-04 from the MOVE-011 two-FIX split and sx-terrace-c-f82 gate-1 two blocking A findings (RL-101). These are requirements for a future review, not proof of implementation or a passed journey.

Review the built public `/docs/switch-checklists` page against the official-source inventory and each relevant replacement journey. A missing page, omitted workflow or unmet row fails the affected requirement.

| Acceptance | Required outcome | Review surface |
| --- | --- | --- |
| 1 | Every Covered row identifies the replacing Terrace clause and a passed replacement acceptance proving the same capability, including its actor, door, prerequisites and outcome. | Built public page and relevant replacement journey |
| 2 | Competing repair estimates is Covered only when several vendors can be asked for estimates before work approval and can submit their estimates through a vendor door without already-approved work. | Built public page and relevant replacement journey |
| 3 | Until that vendor-submitted pre-approval estimate door exists and its replacement acceptance passes, competing repair estimates appears as a named gap; WORK-003's staff-recorded quotes and an estimate door restricted to already-approved work do not qualify it as Covered. | Built public page and relevant replacement journey |

## Official-source comparison

[AppFolio's Vendor Portal guide](https://www.appfolio.com/help/vendor-portal) distinguishes requested estimates awaiting vendor submission and customer review from in-progress work. The frozen requirement covers requests to several vendors before work approval, their own estimate submissions and staff comparison. WORK-003's staff-entry journey and a door that requires approved work prove different prerequisites and cannot qualify the competing-estimates row as Covered. This source comparison is not Terrace execution evidence.
