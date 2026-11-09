# SPECS HACKATHON ONLY — NEVER MERGE TO MAIN

This branch is for the SPECS hackathon and must remain separate from NYC-MON production.
- All changes in the specs branch only; no PR targeting main, no auto-merge, no release.
- The branch-only full-chat override for Baby Squeaklet must not leak into canonical speech rules.
- Do not commit credentials, OAuth access tokens, generated voice keys, or live users' content.
- Branch labels and this policy file are NOT branch protection. A repository admin should also configure a GitHub ruleset preventing a specs-to-main merge, which cannot be enforced by code in this branch.
