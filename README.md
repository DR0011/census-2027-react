# Census 2027 - React (Vite)

This project converts the original 4 standalone HTML pages into a single
React + Vite application with client-side routing:

- `/circulars` — Census 2027 Circulars (search, language filter, per-column
  filter popups, sortable table that collapses into cards on mobile)
- `/documents` — Census 2027 Documents (search, sortable table with PDF
  view/download buttons)
- `/contacts` — Contact List of Census Officers (search, add/update officer
  with an "Authority Login" gate, responsive card grid)
- `/admin-units` — DCO Gujarat Administrative Units (drill-down hierarchy:
  State → District → Sub-District → Village/Town → Ward, with breadcrumbs,
  summary cards and a sortable table)

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (usually http://localhost:5173).

To create a production build:

```bash
npm run build
npm run preview
```

## Notes

- Each page keeps the same Google Apps Script `API_URL` that was in the
  original HTML file. Update the `API_URL` constant at the top of each file
  in `src/pages/` if your Apps Script endpoint changes.
- All original responsive CSS (desktop table / tablet / mobile card layouts)
  has been preserved and moved into a `.css` file per page.
- All DOM-manipulation logic (`document.getElementById`, manual `innerHTML`,
  etc.) has been rewritten using React state (`useState`/`useEffect`) so the
  UI re-renders declaratively instead of being manually patched.
