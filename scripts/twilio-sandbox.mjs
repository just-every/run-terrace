// Run with the held TEST pair through the named-key injector. This command
// proves the real provider adapter; native authority and routing are exercised
// through the public doors in ./tests/messages.mjs with the allowed edge fake.
import {sendTwilio} from '../src/terrace/twilio.ts'
const magic='+15005550006'
const {TWILIO_ACCOUNT_SID:accountSid,TWILIO_AUTH_TOKEN:authToken}=process.env
if(!accountSid||!authToken)throw Error('Inject the held Twilio TEST credential pair')
for(const channel of ['sms','voice']){
 let receiptStatus=null
 const result=await sendTwilio({accountSid,authToken,from:magic},{to:magic,body:'Terrace provider test.',channel},async(url,options)=>{
  const form=new URLSearchParams(options.body)
  if(new URL(url).origin!=='https://api.twilio.com'||form.get('From')!==magic||form.get('To')!==magic||form.has('StatusCallback'))throw Error('sandbox_boundary')
  const response=await fetch(url,options);receiptStatus=response.status;return response
 })
 console.log(JSON.stringify({channel,proof:'Twilio TEST API boundary',receiptStatus,outcome:result.outcome,errorCode:result.errorCode,handsetContacted:false}))
 if(result.outcome!=='accepted')process.exitCode=1
}
