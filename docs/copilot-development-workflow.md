# Copilot Development Workflow

Before generating code:

1. Read architecture documents.
2. Read frontend-design-rules.md.
3. Follow project folder structure.
4. Generate production-ready code.
5. Use TypeScript strict typing.
6. Prefer server components where possible.
7. Use feature-based architecture.

Never:

* Duplicate logic
* Ignore localization
* Ignore RTL support
* Bypass Supabase services
* Create large monolithic files

All generated code must:

* Pass ESLint
* Pass TypeScript build
* Follow feature module boundaries
