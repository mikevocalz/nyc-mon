# Public source and asset boundary — approval required

The competition requires a working public, openly licensed repository with source, setup and required assets. Current repository visibility does not authorize changing the game's ownership or licensing. Preserve existing copyright notices; an upstream notice is not itself evidence of an ownership defect.

**No repository visibility or license change is made by this PR. No archive is automatically published.**

The proposed public product is the focused text-first companion: reviewed provider integration, OAuth/MCP client, care-tool contract, explicit memory schema/store/controls, tests and reproducible local setup. It reuses the current backend. It is not acceptable to publish a hollow UI that requires inaccessible private game code to run.

## Review before export

- Enumerate the complete dependency closure of the NVIDIA page, server, existing MCP service, Payload auth/API and shared UI/types. Review each original/third-party component and preserve its notices.
- Provide a truly runnable public backend and a legitimate test-data creation flow using existing account and Mon APIs. Do not invent another auth or save system to bypass this review.
- Exclude unrelated mobile/world implementation, unpublished characters/rigs, private GLB models, music/voice recordings, proprietary media, map datasets requiring separate terms, environment files, tokens, database dumps and real user data.
- Review the shared kit's transitive asset imports. A text-only UI or tree-shaken build alone does NOT prove its source/assets are safe to redistribute.
- Supply THIRD_PARTY_NOTICES and an owner-approved license scoped to the actual public package. Do not replace the commercial repository's root license as a shortcut.
- Run a fresh-clone installation, migrations on a disposable database, adult-account setup and the complete agent test using only public instructions and the reviewer's own secret values.
- Verify the public source is the same tested revision as the demo and evidence. Preserve hashes; do not ship unrelated main-branch changes after freezing the submission.

If the dependency closure cannot be legally published in time, that is an eligibility blocker requiring a real scope decision, not a checkbox to waive. `tooling/nvidia/submission-manifest.json` remains unapproved until this work is actually verified.
