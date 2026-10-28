# Agent door integration boundary

Terrace's shared agent and Business runtime source is pinned in `base-copies.json`.
It is not yet mounted in the production Worker. The native operations API remains
the supported agent entry point; see [the API guide](../API.md). This source copy
does not claim MCP discovery, company-policy enforcement, agent approvals or a
completed residential portfolio steward.

The authoritative people are `oa_operators`, with Terrace responsibility and
portfolio grants in `tt_staff_roles`, `tt_role_actions` and
`tt_role_portfolios`. A future Business binding must resolve signed owner and
team IDs to those durable native IDs, re-read current admission on each effect,
and preserve the native role and portfolio guards. An email match is not a
binding. Local credential authority remains separate and narrower than its
issuing person's authority.

Native prepare credentials can prepare maintenance, revisions, quotes, renewals,
arrears and close corrections, preview charges and execute their assigned
structured workload. They cannot approve, post money, send, change access or
satisfy a person's fresh sign-in proof. `agent.execute` additionally requires the
exact current credential assigned to the workload. The owner configures,
pauses, cancels and reassigns workloads; ownership alone does not authorize
execution as the assigned credential. Revocation and rotation fence the native
write, including execution after a queued claim. Preparation has no model or
provider cost and supplies no payment, signature, resident confirmation or
external delivery evidence.

Complete conformance must exercise both signed Business sponsorship and these
local credential boundaries against the real production schema. In particular,
a local-only workload execution needs a journey credential supplied privately
by the native fixture lifecycle. It must not be inferred from a Business token,
returned as tool or resource content, replaced by a synthetic person, or admitted
through a test-only production route. An owner initializer and an outbound
provider edge do not by themselves select the credential for a journey call.

Until that execution and conformance integration is complete, keep the runtime
unmounted and retain the existing people, session, Origin, CSRF, fresh-proof,
prepare-scope and workload-assignment checks. No contract status is advanced by
copying the runtime. The draft Agent surface remains a target mapping, with its
unsupported provider and complete-workflow capabilities still open.
