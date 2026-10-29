import type { AgentDoorOptions, ToolDefinition } from '../../modules/agent-door/index.ts'
export const capabilities: NonNullable<AgentDoorOptions['capabilities']>
export const specialist: string
export const notTools: NonNullable<AgentDoorOptions['notTools']>
export const specs: Array<Pick<ToolDefinition,'name'|'scope'|'readOnly'|'classes'|'clauses'|'inputSchema'|'outputSchema'> & {action:string;inputSchema:{type:'object';properties:Record<string,unknown>;required:string[]}}>
