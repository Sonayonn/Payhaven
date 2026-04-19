<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Project conventions
Before writing code for this project, read `CONVENTIONS.md` in the repo root. It captures hard-won rules for:
- Umbra SDK usage (treat `.d.ts` files as the spec, not the docs)
- Money validation at trust boundaries
- Secret handling (keypairs, API keys)
- Known doc-drift in the Umbra SDK
