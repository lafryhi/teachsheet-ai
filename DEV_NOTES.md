# DEV_NOTES

## Current project status

TeachSheet AI is currently a modular frontend application with:

- Structured prompt parsing
- Multiple worksheet generators
- Template switching
- Preview rendering with pagination
- Answer sheet support
- PDF export
- Local project save and load
- Firebase Authentication
- Dashboard support
- Worksheet identity and printable metadata
- Pedagogical math progression and classroom printable math refinements

## Last stable features

- Prompt Engine v2 for multiple worksheet types
- Local save and load system
- Firebase email/password authentication
- Google sign-in support, subject to Firebase Authorized Domains
- Worksheet templates engine
- Printable worksheet identity layer
- Page numbering in preview and PDF
- Vertical and horizontal math operation layouts
- Multi-page worksheet preview and PDF export
- Improved answer sheet clarity

## Testing checklist

After any significant change, verify:

- Generate worksheet
- Preview rendering
- PDF export
- Save project
- Load project
- Template switching
- Page numbering
- Answer sheet generation
- Console errors

Recommended prompt checks:

- `grade 2 + addition + 20 questions`
- `grade 2 + vertical addition + practice + 20 questions`
- `grade 3 + horizontal subtraction + review + 25 questions`
- `grade 4 + vertical multiplication + challenge + 20 questions`
- `grade 4 + horizontal division + remediation + 15 questions`
- `grammar + verbs + 15 questions`
- `reading + short passage + 5 questions`
- `tracing + letter A`
- `coloring + animals`

## Known issues

- Google Login on deployed environments depends on correct Firebase Authorized Domains setup.
- The app is static and browser-based, so some testing paths such as file download behavior are best verified in a real browser.
- `README.txt` is a legacy starter note and is no longer the main developer guide.

## Next recommended steps

1. Keep documentation in sync with the current modular structure.
2. Add lightweight repeatable browser test scripts for regression checking.
3. Review Firebase production auth settings whenever the deployed domain changes.
4. Continue improving worksheet educational quality before adding broader feature scope.
5. Preserve stability before introducing new product areas.
