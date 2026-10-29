import { PortabilityError } from '../modules/portability/index.mjs'

/** Keep archive refusals distinct from unexpected storage failures. */
export class ArchiveValidationError extends PortabilityError {
 constructor(message) { super('staged_validation'); this.message = message }
}
