import type {Bindings} from '../auth.server'
import type {Context,Row} from './core'
import {integrationData,integrationOwner} from './integration-health'
import {PHOTO_LIMIT} from './work'
import {DOCUMENT_LIMIT} from './documents'
import {CHUNK,MEDIA_LIMIT,MEDIA_DOCUMENT_LIMIT} from './field-evidence-media'
import {LEASE_SOURCE_LIMIT} from './lease-source'
import {ARCHIVE_LIMIT} from './data'

// Requirements are disclosures of the current contract, never an activation or verification service.
const dependencies = [
 {id:'payments',title:'Payment providers and banking',clauses:['BOUND-001','PAY-002','PAY-003','ACCT-002','ACCT-018'],implementation:'Hosted test-card transport exists. ACH collection, verified bank settlement and outbound payment rails remain unavailable or unqualified.',required:'A contracted processor and manager bank, provider onboarding and identity checks, authorized account and scope, receiving-bank mappings and bank origination agreements are required. Funds remain with the bank or processor.'},
 {id:'bank-feeds',title:'Bank feeds and accounting',clauses:['ACCT-005','ACCT-015'],implementation:'Plaid and QuickBooks Online connections are unavailable.',required:'Authorized bank consent and Plaid access, or authorized QuickBooks OAuth with reviewed account mappings, are required. A manual statement import establishes no provider connection.'},
 {id:'screening',title:'Applicant screening',clauses:['LEASE-008','LEASE-009','PORT-008'],implementation:'TransUnion screening is unavailable; native income review is documentary only.',required:'TransUnion onboarding, an authorized screening agreement, applicant consent, restricted report access and reviewed disclosure and adverse-action contents are required. Counsel review remains outstanding.'},
 {id:'marketplaces',title:'Rental marketplace distribution',clauses:['LEASE-002','LEASE-003','LEASE-004'],implementation:'Zillow, Apartments.com, Zumper and RentCafe adapters are unavailable.',required:'Each marketplace needs its own supported partner path, account permission and distribution entitlement. Approved native vacancy information is not provider-confirmed publication.'},
 {id:'insurance',title:'Insurance partner',clauses:['OPS-005','BOUND-002'],implementation:'MSI enrollment and provider coverage verification are unavailable.',required:'MSI or an authorized insurance partner must establish its account, agreement and scope for quotes, enrollment, coverage and claims handoff. External proof is not insurer approval; Terrace is not the insurer.'},
 {id:'tax',title:'Tax filing partner',clauses:['ACCT-014','BOUND-002'],implementation:'Nelco filing and provider acceptance tracking are unavailable.',required:'An authorized Nelco filing account and agreement, reconciled tax-year data and explicit human filing review are required. Tax advice remains with the buyer’s accountant.'},
 {id:'signing',title:'Electronic signing',clauses:['LEASE-011'],implementation:'Inkwell or DocuSign electronic execution is unavailable; staff-recorded signed originals are separate evidence.',required:'Authorized signing-provider access, signer consent, identity evidence and a completed artifact and certificate are required. Uploading a signed PDF does not verify electronic execution.'},
 {id:'communications',title:'Mail, messaging and postal delivery',clauses:['OPS-004','PORTAL-005','PORTAL-009'],implementation:'Existing mail transports expose bounded diagnostics. Live sender qualification, Twilio paging and Lob delivery remain unqualified.',required:'The selected mail account needs authorized sending scope and a verified sender; Twilio and Lob require their own authorized accounts and entitlements. Accepted mail is not delivery, a person reached or physical service.'},
 {id:'native',title:'Native app distribution',clauses:['PORTAL-008'],implementation:'Native iOS and Android applications and device qualification are unavailable.',required:'Native distribution qualification, permissioned push, device-session revocation and real suspend and resume evidence remain required. Responsive web screens establish no native-device or store qualification.'},
] as const

export async function setupReadiness(c:Context,env:Bindings,diagnostics?:Row){
 integrationOwner(c)
 const data=diagnostics??await integrationData(c,env)
 return {
  activationReady:false,authorityVerified:false,
  notice:'Read-only setup disclosures. Required agreements and authorized credentials remain unverified. Configuration presence, successful exchanges and owner-reported entitlement establish neither verified authority nor activation readiness. This page cannot connect, activate or execute a provider operation.',
  dependencies:dependencies.map(d=>({...d,agreement:'unverified',authorizedCredentials:'unverified',authorityVerified:false,activationReady:false})),
  integrations:(data.providers as Row[]).map((p:Row)=>({provider:p.provider,configurationPresent:p.configured,lastSuccessfulExchange:p.lastSuccess,ownerReportedEntitlement:p.metadata?.entitlement??'unknown',authorityVerified:false,activationReady:false})),
  limitsNotice:'These are upload validation ceilings, not guaranteed storage capacities. D1 row limits can refuse smaller unchunked document and signed-lease originals. No storage maximum is qualified here.',
  limits:[
   {id:'inspection-photo',label:'Direct inspection photo',maxBytes:PHOTO_LIMIT,scope:'JPEG or PNG through the inspection photo upload.'},
   {id:'tenancy-document',label:'Tenancy document',maxBytes:DOCUMENT_LIMIT,scope:'Each lease, application, screening, notice, tax or PHA document; no video through this door.'},
   {id:'signed-lease',label:'Signed lease source',maxBytes:LEASE_SOURCE_LIMIT,scope:'Each staff-recorded original PDF.'},
   {id:'record-visual',label:'Record photo or video',maxBytes:MEDIA_LIMIT,scope:'Each inspection, work or invoice image or video through chunked media upload.'},
   {id:'record-document',label:'Record document',maxBytes:MEDIA_DOCUMENT_LIMIT,scope:'Each non-image, non-video work or invoice original through chunked media upload.'},
   {id:'media-chunk',label:'Media upload chunk',maxBytes:CHUNK,scope:'Each chunk of a record original; the whole-original limit still applies.'},
   {id:'web-archive',label:'Browser archive restore',maxBytes:ARCHIVE_LIMIT,scope:'Each backup or later erasure journal uploaded here. Use rer import for larger archives; this is not a storage quota or an export limit.'},
  ],
  costs:{
   assumptions:(data.providers as Row[]).map((p:Row)=>({provider:p.provider,usdCentsPerThousand:p.metadata?.cents_per_thousand??null,asOf:p.metadata?.cost_as_of??null,observedRequests:p.requests,estimatedUsdCents:p.metadata?.cents_per_thousand==null?null:Math.round(p.requests*p.metadata.cents_per_thousand/1000)})),
   measuredStorageBilling:null,measuredExternalFees:null,
   notice:'Storage and external fees are unknown. Your infrastructure and provider accounts bill you. Operation counts and owner assumptions are estimates, not measured billable usage, contracted rates or a total operating cost.',
   sources:[
    {label:'Cloudflare Workers pricing',url:'https://developers.cloudflare.com/workers/platform/pricing/'},
    {label:'Cloudflare D1 pricing',url:'https://developers.cloudflare.com/d1/platform/pricing/'},
    {label:'Cloudflare R2 pricing',url:'https://developers.cloudflare.com/r2/pricing/'},
    {label:'Resend pricing',url:'https://resend.com/pricing'},
    {label:'Stripe pricing',url:'https://stripe.com/pricing'},
    {label:'SendGrid pricing',url:'https://sendgrid.com/en-us/pricing'},
   ],
  },
  capacity:{
   clause:'SAFE-009',qualified:false,receipt:null,
   reference:'One Cloudflare Worker with D1 and R2 as rer deploy provisions it.',
   dataset:{units:500,properties:60,leases:600,owners:150,residents:1200,vendors:250,historyMonths:24},
   notice:'Reference measurements are unavailable. Date, commit, dataset receipt and measured timings are unknown. Local readiness runs do not qualify as hosted reference capacity.',
   targets:[
    {id:'rent-posting',label:'Monthly rent posting for every lease',boundMs:60000,measuredMs:null},
    {id:'rent-roll',label:'As-of rent roll for all units',boundMs:5000,measuredMs:null},
    {id:'bank-matching',label:'One bank month of about 1,500 lines auto-matched',boundMs:30000,measuredMs:null},
    {id:'reconciliation',label:'Three-way reconciliation view',boundMs:5000,measuredMs:null},
    {id:'owner-statements',label:'Complete 150-owner statement batch',boundMs:600000,measuredMs:null},
    {id:'delinquency',label:'Delinquency report',boundMs:5000,measuredMs:null},
    {id:'interactive',label:'Staff and portal pages at p95',boundMs:1500,measuredMs:null},
   ],
  },
 }
}
export type SetupReadiness = Awaited<ReturnType<typeof setupReadiness>>
