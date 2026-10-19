// ROLE-003. Whoever prepared work never approves it, the owner included. The one exception is an installation
// where nobody else active could approve: the preparer's approval is then kept with the label below. The check
// is repeated inside the approval's D1 batch, so an approver invited meanwhile makes the self-approval fail.
import { guard, insist, one, type Context } from './core'

export const SELF_APPROVED = 'self-approved: no second person'
/** Active operators other than these preparers who hold the action (the owner holds every action; an admin not yet given a Terrace role becomes a portfolio manager). */
const others = "SELECT 1 FROM oa_operators o WHERE o.status='active' AND o.id NOT IN (?,?) AND (o.role='owner' OR EXISTS(SELECT 1 FROM tt_staff_roles r JOIN tt_role_actions k ON k.role=r.role WHERE r.operator_id=o.id AND k.action=?) OR (o.role='admin' AND NOT EXISTS(SELECT 1 FROM tt_staff_roles r WHERE r.operator_id=o.id) AND EXISTS(SELECT 1 FROM tt_role_actions k WHERE k.role='portfolio_manager' AND k.action=?)))"

/** The label for this approval (null for an independent approver) and the guard that keeps it true at write time. */
export async function independence(c: Context, action: string, preparers: (string | null | undefined)[]) {
 const [a, b = a] = preparers.filter(Boolean) as string[]
 if (!preparers.includes(c.actor.id)) return { label: null, guards: [] }
 const another = await one(c, others, a, b, action, action)
 insist(!another, 'preparer_cannot_approve', 'You prepared these terms. Another person with approval authority must approve them.', 403)
 return { label: SELF_APPROVED, guards: [guard(c, `NOT EXISTS(${others})`, a, b, action, action)] }
}
