import test from 'node:test'
import {journey as mediaJourney} from './record-media.mjs'
test('PORT-009: scoped immutable record media resume, version, retain originals and export/restore',()=>mediaJourney())
import {journey as inspectionJourney} from './mobile-inspections.mjs'
test('WORK-011: structured entry/exit findings preserve disputes and refuse unsupported deductions',()=>inspectionJourney())
