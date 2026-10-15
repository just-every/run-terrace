# Terrace fonts

Fraunces (variable optical size and weight, softness 50) and Manrope (variable weight) are self-hosted Latin WOFF2 subsets from Google Fonts. Each font directory contains its SIL Open Font License 1.1. No page requests a third-party font service.

`fonts.css` declares each face once. `rer-theme.css` assigns the heading and body roles for the site, native auth/setup documents, Lobby and app. The root and native documents preload Manrope through `src/base/font-head.ts`.
