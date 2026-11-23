# Baseline updates for modernization

**Date:** 5 November 2026
**Branch:** `chore/upgrade-frontend` (commit `35697ba`)
**Related branch:** `docs/readme-backend-port` (commit `a462c57`) — README URL correction only; no code change

This document records the changes made so the Spring PetClinic ReactJS sample can install, build, and run on a current Node.js toolchain, and so the React screens call the REST API that this repository actually ships. The backend was already Spring Boot 3.2.1; it was not upgraded. A few backend methods were added so the existing OpenAPI contract is implemented.

---

## Why the app could not start

The React client in this repository was written in 2016 (React 15, React Router 2, TypeScript 2, webpack 1). In 2024 Dependabot bumped webpack and several loaders to v5 in `client/package.json`, but it did not update `webpack.config.js`, which still used webpack 1 keys (`module.loaders`, `preLoaders`, `resolve.extensions` with an empty string, `resolveLoader.fallback`).

Two further blockers appeared on a current machine (Node 24, npm 11):

1. `npm install` ran a `postinstall` script of `typings install`. The Typings registry (`api.typings.org`) returns 404, so install failed.
2. After forcing install past that, `npm start` failed with `ValidationError: Invalid configuration object` because webpack 5 rejected the old config.

The README also listed the API at `http://localhost:8080/api/pettypes`. The running server uses port **9966** and context path **`/petclinic/`**, so that curl command never reached the app.

---

## What was not changed

- Spring Boot version, `pom.xml` dependencies, SQL schema, and `openapi.yml`. The backend was already 3.2.1.
- Bootstrap 3 markup and Less styles, except four mixin calls that Less 4 now requires parentheses for.
- Page layout, routes, and the class-component structure of the React app.
- No new product features. The extra backend methods only fill in endpoints the spec already defined.

---

## Frontend toolchain

All versions below are what `client/package.json` now pins. The app requires **Node 22.22 or newer** (`engines` in `package.json`; React Router 8 and webpack-dev-server 6 require it). TypeScript is on 6, not 7, because `ts-jest` does not yet support TypeScript 7.

| Area | Before | After |
|---|---|---|
| React | 15 | 19.3 |
| React DOM | 15 | 19.3 |
| React Router | 2 (`react-router`) | 8 (`react-router`; data-router APIs: `BrowserRouter`, `Routes`, `Route`, `Outlet`, hooks) |
| TypeScript | ~2.0, with `typings` | 6.0, with `@types/*` |
| Bundler | webpack 1 config + custom `server.js` (webpack-dev-server 1) | webpack 5.112 + webpack-cli 7 + webpack-dev-server 6 (`webpack serve`) |
| CSS | `style!css!less` string loaders | `style-loader` 4, `css-loader` 7, `less` 4, `less-loader` 13 |
| Dates | `moment` + `react-datepicker` 0.29 | `react-datepicker` 9 (uses the browser `Date` object; no `moment`) |
| Tests | Jest 29 config leftovers + Enzyme 2 + a copied `fetch` mock | Jest 30 + `ts-jest` 29 + `jest-environment-jsdom` + React Testing Library 16 |
| Hot reload | `react-hot-loader` `AppContainer` | webpack-dev-server HMR (no extra wrapper) |
| Fetch polyfill | `whatwg-fetch` | native `fetch` |
| Lint | TSLint 3 | removed (TSLint is discontinued) |
| Babel | `.babelrc` with `es2015` / `stage-0` / `react` presets | removed; `ts-loader` compiles TypeScript |

`client/package.json` scripts are now:

- `npm start` — `webpack serve --config webpack.config.js`
- `npm run build` — production webpack build
- `npm run typecheck` — `tsc --noEmit`
- `npm test` / `npm run test:watch`

---

## Files added, removed, and rewritten

### Added

- `client/jest.config.js` — Jest 30 config (`jsdom`, `ts-jest`).
- `client/src/global.d.ts` — declares `__API_SERVER_URL__` and style modules.
- `client/src/withRouter.tsx` — small adapter that injects `params`, `location`, and `navigate` into class components, which cannot call React Router hooks themselves.

### Removed

- `client/server.js` — 2016 Create React App–style webpack-dev-server wrapper. Replaced by `webpack serve`.
- `client/.babelrc`, `client/tslint.json`, `client/typings.json`
- `client/src/react-hot-loader.d.ts`, `client/src/react-datepicker.d.ts`
- `client/tests/__tests__/fetch-mock.js`

### Rewritten for the new toolchain

- `client/package.json` and `client/package-lock.json`
- `client/webpack.config.js` and `client/webpack.config.prod.js` — webpack 5 `module.rules`, asset modules, `DefinePlugin` for `__API_SERVER_URL__` (default `http://localhost:9966/petclinic`), `historyApiFallback`, static files from `client/public`.
- `client/tsconfig.json` — `jsx: react-jsx`, `moduleResolution: bundler`, `strict: false` (TypeScript 6 turns strict mode on by default; this codebase was never written for it).
- `client/src/main.tsx` — `createRoot` from `react-dom/client` instead of `ReactDOM.render`.
- `client/src/Root.tsx` — `BrowserRouter` + `Routes`.
- `client/src/configureRoutes.tsx` — `<Route element={...}>` instead of `component` / `IndexRoute`.
- `client/src/components/App.tsx` — `Outlet` and `useLocation` instead of `children` / `location` props from React Router 2.
- Class pages that used `this.context.router` or `this.props.params` (`FindOwnersPage`, `OwnersPage`, `EditOwnerPage`, `OwnerEditor`, `NewPetPage`, `EditPetPage`, `PetEditor`, `VisitsPage`) — wrapped with `withRouter`.
- `client/src/components/form/DateInput.tsx` — `react-datepicker` 9 API; dates are ISO `yyyy-MM-dd` strings, which matches the backend OpenAPI `format: date`.
- `client/src/components/ErrorPage.tsx` — calls `url('api/oops')` instead of the hard-coded `http://localhost:8080/api/oups`.
- `client/src/types/index.ts` — `IRouterContext` replaced with `IRouterProps`; `IPet.birthDate` and `IVisit.date` are strings.
- Tests under `client/tests/` — Enzyme `shallow` replaced with React Testing Library; util tests expect `http://localhost:9966/petclinic`.
- `client/src/styles/less/petclinic.less` — `.label-success()` (and the other three status mixins) so Less 4 stops warning.

Production webpack previously injected `__API_SERVER_URL__` as `http://localhost:8080`. Both configs now use `http://localhost:9966/petclinic`, overridable with `API_SERVER_URL`.

---

## Behaviour change: Find Owners

The menu link goes to `/owners/list` with no query string. The page used to fetch owners only when `lastName` was present in the URL, so the table stayed empty until the user clicked **Find Owner**.

`FindOwnersPage` now always fetches on mount. With an empty last name the backend returns every owner, so the page behaves like Veterinarians.

A related empty-result bug is also fixed: when no owner matches, the backend returns HTTP 404 with an empty body. The page used to call `response.json()` on that and keep the previous list. It now treats 404 as an empty array and shows **0 Owners found**.

---

## Client aligned to the current REST API

The React client was written for an older PetClinic API. After the toolchain upgrade, Home, Veterinarians, Find Owners, and New Owner worked; owner details, edit, pets, visits, and Error did not. The client was pointing at paths and payloads this backend does not use.

### Client

| Before | After |
|---|---|
| `GET /api/owner/{id}` (singular) | `GET /api/owners/{id}` |
| `url('/api/...')` produced `/petclinic//api/...` | `url()` strips extra slashes |
| Create pet sent `{ typeId }` | Sends `{ name, birthDate, type: { id, name } }` |
| Pet/visit save treated only HTTP 204 as success | Any 2xx is success (create is 201, update is 204) |
| Owner save sent the whole owner object, including pets | Sends the editable fields only |
| Error page called `localhost:8080/api/oups` | Calls `url('api/oops')` and reads `className` / `exMessage` |

Files: `OwnersPage.tsx`, `EditOwnerPage.tsx`, `OwnerEditor.tsx`, `createPetEditorModel.ts`, `PetEditor.tsx`, `VisitsPage.tsx`, `ErrorPage.tsx`, `util/index.tsx`, `types/index.ts`.

### Backend (only what the spec already required)

- `OwnerRestController.updateOwnersPet` — `PUT /api/owners/{ownerId}/pets/{petId}` used to hit the generated default and return **501**. It now updates the pet and returns **204**. Owner/pet match is by id, not `equals` (the old check returned **400** for Edit Pet).
- `OopsRestController` — implements `GET /api/oops` by throwing; `ExceptionControllerAdvice` turns that into JSON for the Error page.

### Checked in the browser after restarting the backend

Owner details (George Franklin / Leo), Edit Owner, Update Owner, Add Pet form, create pet (201), Edit Pet (Leo, cat), Update Pet (204, back to owner details), Add Visit form, Error page (`RuntimeException` sample message).

---

## How to run after this update

Two terminals. Leave each process running.

**Terminal 1 — backend** (project root):

```
./mvnw spring-boot:run
```

Wait for `Tomcat started on port 9966 (http) with context path '/petclinic'`.

Check:

```
curl http://localhost:9966/petclinic/api/pettypes
```

**Terminal 2 — frontend** (`client/`):

```
npm install
PORT=4444 npm start
```

Open `http://localhost:4444`.

Do not stop the Maven process with Ctrl+C while you still need the API. `BUILD SUCCESS` after Ctrl+C means Maven exited cleanly; it does not mean the server is still listening.

---

## Verification done during this work

- `npm run typecheck` passes.
- `npm test`: 3 suites, 14 tests, all passing.
- `npm run build` compiles (webpack warns about bundle size and a dynamic `require` inside `react-datepicker`; that warning is ignored in the webpack config and is not a runtime error).
- Browser check against a live backend: Home, Veterinarians, Find Owners from the menu, owner details, edit owner, add/edit pet, add visit form, Error page.

---

## Remaining gaps (not part of this modernization)

- Bootstrap 3 is out of support and `npm audit` reports known issues in it. Replacing it means Bootstrap 5 and a markup rewrite.
- TypeScript strict mode is off. Turning it on would require nullability and type clean-up across the client.

Small leftover mismatches between the client and the API contract are listed in `ARCHITECTURE.md` §6. They do not block the screens.

---

## README correction (separate commit)

On `docs/readme-backend-port`, `readme.md` was updated so the documented API URL matches `src/main/resources/application.properties`:

- Example: `curl http://localhost:9966/petclinic/api/pettypes`
- Note that the server must stay running in its own terminal.

That commit is not on `chore/upgrade-frontend`. Merge or cherry-pick it if this branch is published on its own, otherwise the README on this branch still shows port 8080.
