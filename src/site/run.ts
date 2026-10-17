import type { RunData } from '../base/run-site'
import metadata from '../../package.json'
export const repository = metadata.repository.url.replace(/\.git$/, '')
export const run: RunData = {
 name:'Terrace', repository,
 clone:'npx -y @runeditrun/rer dev just-every/run-terrace', folder:'run-terrace',
 requirements:'Runs on macOS, Linux or Windows with WSL2, with git. The installer brings Node when it is missing, and rer brings pnpm.',
 licence:'MIT', docs:true, hosted:[],
}
/** The demo the hero's "Try the demo" opens (deploy-demo.json). */
export const demo = 'https://demo.run-terrace.com/'
