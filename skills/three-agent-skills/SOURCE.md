# Source
Repo: https://github.com/emalorenzo/three-agent-skills
Branch: main, commit f950f95ae3b13581546e6d6d8b2f88a08eb3e577
Copied: 2026-10-16
Subpaths: skills/three-best-practices/, skills/r3f-best-practices/, THREE_BEST_PRACTICES.md, R3F_BEST_PRACTICES.md (the root compiled guides; r3f-best-practices/SKILL.md links to ../R3F_BEST_PRACTICES.md)
License: MIT declared in package.json and in each SKILL.md frontmatter, but the repo has no LICENSE file at this commit; nothing to copy. Check with the author before redistributing outside this repo.
Skipped: skills/*.zip (generated distribution artifacts, `zip -r {skill-name}.zip {skill-name}/` per upstream AGENTS.md), package.json, AGENTS.md, CLAUDE.md (symlink to AGENTS.md), README.md, .gitignore.
Note: `r3f-best-practices` is vendored because the pack ships as one unit, but it is intentionally unused — React Three Fiber is rejected in this repo. Lanes load `three-best-practices` only.
