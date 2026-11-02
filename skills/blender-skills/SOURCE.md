# Source
Repo: https://github.com/arjun988/blender-skills
Branch: main, commit 8f778d2405a214b508d4c7d80742be8e43acdd52
Copied: 2026-10-31
Subpaths: .claude/skills/ (94 skill dirs plus the shared references/ doc set), docs/BLENDER_MCP_SETUP.md, LICENSE (MIT)
Skipped: .cursor/skills/ (byte-identical duplicate of .claude/skills), .claude-plugin/ (marketplace manifests), .mcp.json and .cursor/mcp.json (MCP launcher config that spawns `uvx blender-mcp`; setup is documented, not vendored), site/ (upstream Next.js docs site), assets/ (logo), README.md, QUICKSTART.md, SKILLS_GUIDE.md, CLAUDE.md, CONTRIBUTING.md, CHANGELOG.md, ROADMAP.md, version.json, .gitignore.
Note: start at blender-director/SKILL.md for any Blender asset task; it routes to the specialist skills and the shared references/ docs (asset pipeline, MCP integration, validation, polycount budgets). The skills are prompt packs only — pure markdown, no code — and drive Blender through the BlenderMCP addon plus a `uvx blender-mcp` server the user configures; without that connection they degrade to manual UI guidance.
