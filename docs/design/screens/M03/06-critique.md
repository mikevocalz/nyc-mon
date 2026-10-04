# M03 Sign in / Create account: critique

| §0C row | Score /10 | Evidence | Gap |
|---|---:|---|---|
| Delight and Fun | 5 | Deliberately quiet; delight is not this screen's job | Acceptable: the award rows are judged on M08/M12/M13 |
| Visuals and Graphics | 6 | Clean signage type on concrete, brand-correct providers | Nothing NYC-MON-specific on the page; a small `BrandWordmark` above the title could anchor it (test it, keep it under 32 pt high) |
| Interaction | 8 | Four providers in thumb reach, inline email, per-provider errors, no stacked modals, legal visible on SE | Intent switch must route through M04 (P1); easy to get wrong in implementation |
| Inclusivity | 8 | 48 pt targets, text errors, passkey state is not an error | VoiceOver order: title → switch → providers → legal; confirm in `07-a11y.md` |

## Blockers

1. `AuthProviderButton` with story (R3).
2. Apple and Google brand assets added to the repo (logo rule).
3. Verify `expo-apple-authentication` and the passkey client in `node_modules` before implementation (Law 2); ADR 0001 records the Better Auth passkey plugin.
4. P1 routing: platform must make "create" unreachable without a stored age answer.
