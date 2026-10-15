import { runPageHtml,siteNotFoundHtml,type SiteBuild } from '../base/run-site'
import { identity } from '../identity'
import { homeHtml } from './home'
import { docsPages } from './docs'
import { run,repository } from './run'
export function sitePages():SiteBuild {
 return {
  pages:[{path:'/',html:homeHtml(repository)},{path:'/run',html:runPageHtml(identity,run)},...docsPages(repository),{path:'/404',html:siteNotFoundHtml(identity,run)}],
  assets:['rer-theme.css','landing.css','docs.css','brand','fonts'],
 }
}
