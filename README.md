# TeachSheet AI

TeachSheet AI is a lightweight educational SaaS for teachers.

Its purpose is simple: generate printable classroom worksheets quickly from structured inputs and short prompts, then preview, save, reload, and export them as A4-friendly PDFs.

## What the project includes

- Prompt-driven worksheet generation
- Multiple worksheet templates
- Math, grammar, reading, tracing, and coloring generators
- Real preview with pagination
- Answer sheet generation
- Save and load projects with LocalStorage
- Firebase Authentication
- PDF export with A4-oriented layout

## Tech stack

- HTML
- CSS
- Modular JavaScript
- Firebase modular SDK
- jsPDF via CDN

No framework, no bundler, and no backend service are required to run the current app locally.

## Run the project locally

This project is a static frontend app, so you only need a local HTTP server.

### Option 1: Python

```powershell
cd C:\Users\LAFRYHIELMOSTAFA\Desktop\teachsheet-ai
python -m http.server 8123
```

If `python` is not available:

```powershell
py -m http.server 8123
```

Then open:

[http://localhost:8123/index.html](http://localhost:8123/index.html)

### Option 2: VS Code Live Server

If you use the Live Server extension in VS Code:

1. Open the project folder.
2. Right-click `index.html`.
3. Choose `Open with Live Server`.

## Local development workflow

1. Start the local server.
2. Open the app in Chrome or Edge.
3. Use the prompt input or settings form.
4. Generate a worksheet.
5. Check preview, page numbering, and answer sheet.
6. Save the project.
7. Reload the page and load the project again.
8. Export the worksheet to PDF.

## Quick manual test flow

Use prompts such as:

- `grade 2 + addition + 20 questions`
- `grade 2 + vertical addition + practice + 20 questions`
- `grade 3 + horizontal subtraction + review + 25 questions`
- `grammar + verbs + 15 questions`
- `reading + short passage + 5 questions`
- `tracing + letter A`
- `coloring + animals`

For each test, verify:

- Worksheet generation works
- Preview renders correctly
- Page numbering is correct
- Answer sheet appears when expected
- Template switching works
- Save and load work after refresh
- PDF downloads successfully
- No browser console errors appear

## Firebase configuration

Firebase config lives in:

`js/auth/firebase.js`

Before testing authentication in a fresh environment, verify:

1. The Firebase web app config is present and correct.
2. `Email/Password` is enabled in Firebase Authentication.
3. `Google` sign-in is enabled if you want Google Login.
4. `localhost` is added to Firebase Authorized Domains.
5. Your production domain is also added to Firebase Authorized Domains if you test deployed auth.

Important notes:

- The app uses the Firebase modular SDK only.
- This project currently stores saved worksheet projects in LocalStorage, scoped by the authenticated user or guest scope.

## Git workflow

Basic workflow:

```powershell
cd C:\Users\LAFRYHIELMOSTAFA\Desktop\teachsheet-ai
git status
git add .
git commit -m "Your clear commit message"
git push origin main
```

Recommended practice:

- Inspect changed files before commit
- Test the affected workflow before commit
- Push only after local verification passes

## Important files

### Entry and UI shell

- `index.html`
  Main app page and landing page shell.
- `style.css`
  Global styling, layout, preview appearance, and responsive behavior.
- `js/app.js`
  Main entry point that wires together parsing, generation, rendering, storage, auth, templates, and UI actions.

### Core logic

- `js/core/parser.js`
  Structured prompt parser for worksheet requests.
- `js/core/generator.js`
  Core math question generation and pedagogical progression logic.
- `js/core/pagination.js`
  Preview page state management.
- `js/core/storage.js`
  LocalStorage helpers for worksheet state, settings, and saved projects.
- `js/core/worksheetLayout.js`
  Shared page and answer-sheet layout calculations.

### Subject generators

- `js/generators/mathGenerator.js`
- `js/generators/grammarGenerator.js`
- `js/generators/readingGenerator.js`
- `js/generators/tracingGenerator.js`
- `js/generators/coloringGenerator.js`

Each file is responsible for creating worksheet data for its own subject type.

### UI modules

- `js/ui/preview.js`
  Worksheet preview rendering.
- `js/ui/projects.js`
  Saved projects list rendering.
- `js/ui/themes.js`
  Theme application.
- `js/ui/zoom.js`
  Preview zoom logic.

### Templates and export

- `js/templates/templates.js`
  Worksheet templates and layout presets.
- `js/export/pdf.js`
  PDF export, page drawing, and answer sheet rendering.

### Authentication

- `js/auth/firebase.js`
  Firebase initialization and auth service creation.
- `js/auth/auth.js`
  Login, signup, Google sign-in, logout, and auth state wiring.
- `js/auth/dashboard.js`
  Lightweight user dashboard rendering.

### Project instructions

- `AGENTS.md`
  Codex-facing project rules and development constraints.

## Notes for future work

- Keep the project framework-free
- Preserve modular architecture
- Avoid large cross-file rewrites unless necessary
- Prioritize classroom usability, print quality, and stable teacher workflows
