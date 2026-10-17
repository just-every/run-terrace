import { contractPageHtml } from '../base/contract-page'
import { runPageHtml,siteNotFoundHtml,type SiteBuild,type SiteContext } from '../base/run-site'
import { identity } from '../identity'
import { homeHtml } from './home'
import { docsPages } from './docs'
import { run,repository } from './run'
export function sitePages({contract}:Partial<SiteContext>={}):SiteBuild {
 return {
  pages:[{path:'/',html:homeHtml(repository)},{path:'/run',html:runPageHtml(identity,run,contract)},...(contract?[{path:'/contract',html:contractPageHtml(identity,run,contract)}]:[]),...docsPages(repository),{path:'/404',html:siteNotFoundHtml(identity,run,contract)}],
  assets:['rer-theme.css','landing.css','docs.css','brand','fonts'],
 }
}
