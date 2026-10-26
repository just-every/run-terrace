declare module '*modules/mail/index.mjs' {
 export type DeliveryEvent={deliveryId:string|null;provider:string;providerMessageId:string;recipients:string[]}
 export function createD1EventStore(options:{db:D1Database}):unknown
 export function createDeliveryEventIntake(options:{provider?:string;tenantId:string;eventNamespace:string;key:string;clock:()=>number;store:unknown;authorize:(event:DeliveryEvent)=>Promise<boolean>}):{ingestWebhook(input:{rawBody:Uint8Array;headers:Headers}):Promise<unknown>}
}
