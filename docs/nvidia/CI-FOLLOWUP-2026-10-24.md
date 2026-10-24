# CI follow-up — October 24, 2026

GitHub standard CI run 40115173523 failed lint on the earlier submission-package head `da75e7a`. This is not a live-model or database failure, and it must not be described as a green hosted build.

The follow-up changes make receipt/text callback dispatch explicit, use the established spacing/touch-gap tokens, move memory schemas into the public `@acme/core/schemas` contract (no browser imports of Payload internals), and keep protocol handles in an instance store rather than reading/mutating React refs during render. Hook dependencies and the configuration-schema naming were corrected. The fixes are carried forward through every stacked feature branch without rewriting main or force-pushing.

Locally rerun after these changes: web-sim lint passed with zero errors/warnings; Payload lint passed with two existing array-style warnings in Amazon auth tests; web-sim and Payload typechecks passed; all 27 provider/integration tests passed. The earlier full-workspace validation record remains relevant, but GitHub-hosted reruns on the new heads must be read separately before merge. Do not turn an in-progress/absent check into success.

The live gate remains unchanged: no real Nebius credential was available to the isolated test process, so inference reports NOT_RUN. No production deployment, migration, final public export, video or Devpost submission was performed.
