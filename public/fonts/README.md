# Terrace fonts

Self-hosted variable WOFF2 subsets (Latin and Latin Extended) from Google Fonts, each directory with its SIL Open Font License 1.1 (`OFL.txt`). No page requests a third-party font service.

| Face | Role | Licence | Source |
| --- | --- | --- | --- |
| Geist (100–900) | Headings, the Terrace wordmark, figures in cards | SIL OFL 1.1 | https://github.com/vercel/geist-font |
| Figtree (300–900) | Body text and UI | SIL OFL 1.1 | https://github.com/erikdkennedy/figtree |
| JetBrains Mono (100–800) | Commands and code | SIL OFL 1.1 | https://github.com/JetBrains/JetBrainsMono |

`rer-theme.css` declares each face once, beside the `--rer-*` theme tokens that assign the heading and body roles, so Base's installer serves the faces too. The theme grammar keeps everything else out of that file, so `fonts.css` sets the page font and holds Terrace's palette, the mono role and the rules that dress the native auth and setup documents and Base's Run pages. The run site, the native auth and setup documents, the Lobby and the app link both. The root and native documents preload Figtree through `src/base/font-head.ts`.
