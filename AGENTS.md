# TeachSheet AI — Codex Instructions

## Project identity

TeachSheet AI is a lightweight educational SaaS for teachers.

Its role is:
"The digital assistant for teachers"

## Technology rules

* Use HTML, CSS, and modular JavaScript only.
* Do not add React, Vue, Angular, Next.js, or any framework.
* Do not add unnecessary dependencies.
* Keep Firebase modular SDK only.
* Preserve lightweight performance.

## Architecture rules

* Keep responsibilities separated.

* Parser logic belongs in:
  js/core/parser.js

* Core math generation belongs in:
  js/core/generator.js

* Subject generators belong in:
  js/generators/

* UI rendering belongs in:
  js/ui/preview.js

* PDF export belongs in:
  js/export/pdf.js

* Storage belongs in:
  js/core/storage.js

* Authentication belongs in:
  js/auth/

## Product rules

* Every feature must improve the teacher workflow.

* Avoid decorative features without practical value.

* Worksheets must remain:

  * printable
  * clean
  * classroom-ready

* PDF output must remain A4 friendly.

* Preserve:

  * page numbering
  * answer sheet generation
  * save/load behavior
  * template switching
  * worksheet identity layer

## Development workflow

Before editing:

1. Inspect the relevant files first.
2. Explain briefly what will change.
3. Avoid rewriting unrelated files.

## Testing checklist

After every significant change, test:

* Generate worksheet
* Preview
* PDF export
* Save project
* Load project
* Template switching
* Page numbering
* Answer sheet
* Console errors

## Git workflow

* Commit only after tests pass.
* Use clear commit messages.
* Push only after successful tests.
* If testing is incomplete, do not claim production readiness.

## Code style

* Keep code readable.
* Prefer small focused changes.
* Avoid massive rewrites.
* Preserve modular architecture.

## Product vision

TeachSheet AI is evolving toward:
"An AI-powered digital assistant for teachers"

The priority is:

* real classroom usefulness
* printable educational quality
* teacher productivity
* stable workflows
