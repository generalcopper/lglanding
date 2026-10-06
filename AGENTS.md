# LG Trading website: source and deployment rules

The user requires that an obsolete local checkout must never overwrite the published website. This rule was confirmed on 7 October 2026 after a deployment omitted Picking and UBI ia.

- Repository: generalcopper/lglanding. Production Firebase project: lgtrading-landing. Public domain: https://www.lgtrading.it/.
- Before editing, fetch origin and compare origin/main with the actual live site and its /release.json manifest. Inspect the published commit, pending feature branches and worktree changes. A local folder or main alone is not proof that it contains every previously published feature.
- Merge all relevant published feature work into main before deploying. Never redeploy an old directory or overwrite live content just to ship one isolated change.
- Preserve the six cards in order: Bionee, iLovePaghe, Cedoly, Capannone 3D, UBI ia, Picking, including navigation, original videos and optimized logos, unless the user requests a change.
- Preserve the current black cookie bar, its choices and privacy/cookie policy content unless specifically asked to edit them.
- Production deployment uses the tracked GitHub Actions workflow from the newest main commit. Do not deploy directly from local feature branches or bypass scripts/prepare-release.mjs.
- The predeploy guard compares the live file hashes and source ancestry, blocks stale source, and writes public/release.json. If it fails, reconcile source with production before retrying; do not suppress the check.
- After deployment, verify the live manifest, HTML, cards, referenced assets and consent files. Record the exact commit in the task result.
- Do not rename existing files or open previews/canvas. If the user requests HTML/JS deliverables, provide a ZIP only.
