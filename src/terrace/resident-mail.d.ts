declare module '*modules/mail/index.mjs' {
 export function createMailSender(config:{provider:string;mode:string;apiKey?:string;accountId?:string;relayUrl?:string},dependencies?:{fetch:(url:RequestInfo|URL,init?:RequestInit)=>Promise<Response>}):{send:(message:Parameters<NonNullable<ReturnType<typeof import('../mail.server.mjs').operatorMail>>['send']>[0])=>Promise<{provider:string;status:string;providerMessageId:string|null}>}
 export type DeliveryEvent={deliveryId:string|null;provider:string;providerMessageId:string;recipients:string[]}
 export function createD1EventStore(options:{db:D1Database}):unknown
 export function createDeliveryEventIntake(options:{provider?:string;tenantId:string;eventNamespace:string;key:string;clock:()=>number;store:unknown;authorize:(event:DeliveryEvent)=>Promise<boolean>}):{ingestWebhook(input:{rawBody:Uint8Array;headers:Headers}):Promise<unknown>}
}
