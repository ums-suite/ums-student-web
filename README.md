# ums-student-web

The student portal — dashboard, course registration, routine, grades/transcript, fees, hostel,
library, and requests/notifications. The platform's highest-DAU authenticated application.

- **Full spec:** [`ums-platform/docs/client/ums-student-web/requirement-spec.md`](https://github.com/ums-suite/ums-platform/blob/main/docs/client/ums-student-web/requirement-spec.md)
- **Design system:** [`ums-design-system`](https://github.com/ums-suite/ums-design-system) · **API contracts:** [`ums-shared`](https://github.com/ums-suite/ums-shared)
- **Tech:** Angular 22, CSR SPA (no SSR -- every screen is authenticated, ADR-0005/§10.1),
  PWA-installable, Bengali/English i18n

## Status

Cross-cutting infrastructure (SWEB-1 through SWEB-8), Dashboard (SWEB-9/SWEB-10), and Course
Registration (SWEB-11 through SWEB-15) are implemented. See `docs/client/ums-student-web/tickets.md`
for the full backlog (Routine, Grades/Transcript, Fees/Payments, Hostel, Library,
Requests/Notices/Notifications remain).

## Local package consumption

`@ums/design-system` and `@ums/shared` are consumed as packed tarballs under `vendor/` (`file:`
dependencies in `package.json`) until the platform's private npm registry exists -- the same
pattern `ums-admission-web` uses. `npm ci`/`npm install` installs directly from the committed
`.tgz` files; there is nothing to build or fetch separately.

## Development

```bash
npm install
npm start          # ng serve
npm run build
npm run test:ci    # ng test --runner=karma --watch=false --browsers=ChromeHeadless --coverage
npm run lint
npm run stylelint
```

## Known cross-team API-contract gaps

`@ums/shared`'s generated OpenAPI client is a stale snapshot covering only Identity/Audit/
Organization (~41 paths), predating `ums-core`'s now much larger surface (Academic/Student/
Finance/Hostel/Library are all real and implemented server-side). Every data-access service for
those modules in this app extends `ProvisionalModuleApiBase` (`core/http/`) and hand-writes typed
methods against `ums-core`'s real, documented routes -- see each `*.api.ts` file's own doc comment
for the specific endpoints it assumes and any gap flagged against the real backend.
