import type { RunData } from '../base/run-site'
import metadata from '../../package.json'
export const repository = metadata.repository.url.replace(/\.git$/, '')
export const run: RunData = {
 name:'Terrace', repository,
 clone:'npx -y @runeditrun/rer dev just-every/run-terrace', folder:'run-terrace',
 requirements:'Needs Node 22 or later and pnpm 10.12.4, on macOS, Linux or Windows with WSL2.',
 licence:'MIT', docs:true, hosted:[],
}
