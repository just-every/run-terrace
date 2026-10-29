/** Native, prepare-only Terrace surface. The descriptor is generated from these declarations. */
export const capabilities = ['tools','policy','pause','audit','idempotency'];
export const specialist = 'Residential portfolio steward';
export const notTools = [
 { clauses:['PORTAL-008'],reason:'device' },
 { clauses:['SAFE-001','ROLE-001'],reason:'screen' },
 { clauses:['OPS-008'],reason:'connector' },
 { clauses:['TER-009','MOVE-001','MOVE-002','MOVE-003','MOVE-004','MOVE-005','MOVE-006','MOVE-007','MOVE-008','MOVE-009','MOVE-010','MOVE-011'],reason:'import-door' },
 { clauses:['TER-012','SAFE-007','SAFE-008','SAFE-009','BOUND-004','OPEN-001','DEMO-001'],reason:'installation' },
];
const string = { type:'string',minLength:1 }, amount = {type:'string',pattern:'^\\d+(\\.\\d{1,2})?$'}, day = {type:'string',format:'date'};
const schema = (properties,required=Object.keys(properties)) => ({type:'object',properties,required,additionalProperties:false});
const define = (name,action,readOnly,clauses,properties={},required,extra={}) => ({name:`terrace.${name}`,action,scope:readOnly?'terrace:read':'terrace:prepare',readOnly,classes:readOnly?['standard']:['standard','sensitive'],clauses,inputSchema:schema(properties,required),outputSchema:{type:'object'},...extra});
export const specs = [
 define('company.get','company.read',true,['PORT-001']),
 define('portfolio.get','portfolio.read',true,['ROLE-001','AGENT-008']),
 define('leases.get','tenancy.read',true,['TER-002','PORT-005'],{tenancyId:string}),
 define('work.get','work.read',true,['WORK-002','WORK-004','WORK-006'],{jobId:string}),
 define('workloads.get','agent.read',true,['AGENT-008'],{workloadId:string}),
 define('charges.preview','charges.preview',true,['PAY-001'],{month:{type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'}}),
 define('work.prepare','maintenance.prepare',false,['TER-008','WORK-003','AGENT-001'],{tenancyId:string,title:string,dueDate:day,estimate:amount,vendorId:string,trade:string,tradeName:string,tradeEmail:{type:'string',format:'email'},scope:string,checklist:string,assetId:string,costClass:{type:'string',enum:['operating','capital']}},['tenancyId','title','dueDate','estimate']),
 define('work.revise','maintenance.revise',false,['WORK-003'],{jobId:string,version:{type:'integer',minimum:1},title:string,scope:string,checklist:string,estimate:amount,dueDate:day,costClass:{type:'string',enum:['operating','capital']}},['jobId','version']),
 define('quotes.add','quote.add',false,['WORK-003'],{jobId:string,vendorId:string,vendorName:string,vendorEmail:{type:'string',format:'email'},scope:string,availableDate:day,amount,tax:amount},['jobId','scope','availableDate','amount']),
 define('renewals.prepare','renewal.prepare',false,['TER-003','AGENT-005'],{tenancyId:string,endDate:day,rent:amount,source:string,renewalId:string,deadline:day,marketRent:amount,marketRentDate:day,marketRentSource:string,vacantDays:{type:'integer',minimum:0},makeReadyCost:amount,makeReadySource:string,leasingCost:amount,leasingSource:string},['tenancyId','endDate','rent','source']),
 define('arrears.prepare','arrears.prepare',false,['TER-005','AGENT-004'],{tenancyId:string,message:string,followUpDate:day}),
 define('corrections.prepare','correction.prepare',false,['ACCT-011','AGENT-003'],{tenancyId:string,kind:{type:'string',enum:['charge','receipt']},reason:string,dueDate:day,amount,description:string,reference:string,chargeId:string,receivedDate:day,method:{type:'string',enum:['ach','card','cash','check','other']}},['tenancyId','kind','reason','amount','reference']),
 define('workloads.execute','agent.execute',false,['AGENT-008','AGENT-005'],{workloadId:string,version:{type:'integer',minimum:1}}),
];
