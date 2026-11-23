# Simple login - Technical PRD

| Field | Value |
|---|---|
| Created | November 23, 2026 |
| Version | 1.2 - Phase order |
| Version Notes | Login HTTP endpoint and Authorization headers are the last phase |

Related: `docs/baseline/AUTHENTICATION_BASELINE_PRD.md` (existing user store, HTTP Basic, security off by default) and `docs/baseline/ARCHITECTURE.md`.

This feature adds a sign-in and sign-out workflow on top of that baseline. It does not replace the user tables or roles.

---

## Overview/Problem

The clinic desk in the browser has no way to sign in. There is no login link, no login form, and no credentials on API calls. The API already has a seeded `admin` account and can check HTTP Basic, but that protection is switched off and the UI never sends an `Authorization` header.

Clerks therefore work as anonymous callers. This feature adds a Login item in the top navigation, a form that posts a username and password, a check against the existing user store, and (after success) Basic credentials on every later API call. Sign-out only clears what the browser stored. There is no session on the server.

---

## Hypothesis

We believe that a login form against the existing `admin` account, plus Basic credentials stored in the browser, will give the clinic a working sign-in and sign-out without adding user-creation screens or server sessions.

---

## Business Requirements

Converted from the login flow described on 23 November 2026.

### User Needs

- A clinic staff member needs a Login link in the top navigation so that they can open a sign-in form from any page.
- A staff member needs to sign in with a username and password so that later clinic actions are made as that person.
- A staff member needs to use the seeded administrator account so that the first version of sign-in works without creating extra accounts.
- A staff member needs the navigation to show Logout after a successful sign-in so that they can leave the signed-in state.
- A staff member needs every later clinic request to carry their identity so that the API can tell who is calling.

### Business Rules

- Sign-in uses a username and a password. Both are required.
- The first version uses the seeded administrator account only (`admin` / `admin`).
- A matching username and password is a successful sign-in. The response confirms success and does not return extra account data.
- An unknown username or a wrong password is a failed sign-in. The person stays signed out.
- After a successful sign-in, the browser keeps the username and password until the person signs out or clears site data.
- After a successful sign-in, every later API call includes those credentials.
- Sign-out only happens in the browser. The server does not keep a session and does not need a logout API.
- A disabled account cannot sign in.

### Exclusions

- People cannot create, list, edit, or delete accounts from this feature.
- There is no password reset.
- There is no server-side session, cookie, token, or single sign-on.
- Pet owners never sign in. They remain clinic records.
- Credentials in the browser are not encrypted. That is accepted for this sprint and will be improved later.

---

## Scope

### In Scope

- `UserRepository.findByUsername` on all three repository implementations
- `UserService` method that loads the user and checks the password
- `POST /api/login` with username and password in the JSON body
- OpenAPI path for `/login`
- React route `/login` and a username/password form
- Login / Logout item in the top navigation
- Store username and password in `localStorage` after success
- Clear `localStorage` on Logout
- `Authorization: Basic` (Base64 of `username:password`) on later `fetch` and `submitForm` calls
- Tests: successful login, invalid username, invalid password

### Out of Scope

Boundaries of this feature. Items that may be built later are listed in Future Enhancements.

- A form or API for creating users from the UI (existing `POST /api/users` stays unused by the UI)
- Turning `petclinic.security.enable` on, or reordering `WebSecurityConfig`'s `permitAll` chain
- JWT, OAuth, SSO, cookies, or CSRF tokens
- Password hashing beyond the existing `{noop}` seed
- Account list, password reset, or “current user” API
- Role-based hiding of menu items (Find owners vs Veterinarians)

### Cut

- Returning the user, roles, or a token from `POST /api/login`. Success is HTTP 200 with an empty body.
- A logout endpoint. Logout is local to the browser.
- A dedicated login service. Login goes through `UserService`, same as `saveUser`.

---

## Technical Requirements

### Database Schema

No schema change. Reuse the existing `users` and `roles` tables from the authentication baseline. There is no Flyway or Liquibase; do not add a migration.

Seed (already in `db/hsqldb/populateDB.sql`):

```sql
INSERT INTO users(username,password,enabled) VALUES ('admin','{noop}admin', true);
```

The person types `admin` / `admin`. The stored password is `{noop}admin`. Login must treat a `{noop}` prefix as “plain text follows”, so `admin` matches `{noop}admin`.

`UserRepository` today only has `save`. Add:

```
User findByUsername(String username) throws DataAccessException;
```

Missing user → `null` (same pattern as `ClinicService` lookups). Update **all three** implementations (`springdatajpa`, `jpa`, `jdbc`). The JDBC class already has a private `getByUsername`; expose it through the interface.

### Service layer

Add to `UserService` / `UserServiceImpl` (not a new service):

```
boolean login(String username, String password);
```

Behaviour:

1. Load the user with `findByUsername`.
2. If no user, or `enabled` is not true, return `false`.
3. Compare the typed password to the stored password after stripping a leading `{noop}` prefix.
4. Return `true` only when they match.

Do not throw for a bad password. The controller turns `false` into 401.

### API Endpoints

Base URL: `http://localhost:9966/petclinic/api`.

Contract-first: add `/login` to `openapi.yml`, rebuild, then implement the generated `*Api`.

The login POST is anonymous. Do not put `@PreAuthorize` on it.

#### POST /api/login

**Request body:**

```json
{
  "username": "admin",
  "password": "admin"
}
```

Both fields required. The UI sends the typed values, not `{noop}admin`.

**Response:**

- Success (200): empty body
- Invalid username or invalid password (401): empty body
- Missing fields (400): validation error

Do not return the password, roles, or a token.

### User Interface Requirements

#### Navigation

- When nobody is signed in: **Login** → `/login`
- When someone is signed in: **Logout** (no page). Clicking it clears `localStorage` and shows **Login** again.

#### Login (`/login`)

- Fields: Username, Password (password input). Client constraint: `NotEmpty` on both.
- Submit `POST /api/login` with `{ username, password }` via `submitForm`.
- 2xx: write `petclinic.username` and `petclinic.password` to `localStorage`, then go to `/`
- 401: stay on the form and show that the username or password is wrong. Do not say which one.
- Heading: **Login**. Button: **Login**.

#### Later API calls

`url()` stays as it is. `fetch` in pages and `submitForm` must add:

```
Authorization: Basic <base64(username:password)>
```

when both values exist in `localStorage`. Use the typed password (`admin`), not `{noop}admin`. If nothing is stored, send no `Authorization` header.

---

## Implementation Phases

Follow `.cursor/rules/tdd-workflow.mdc`: tests first, `./mvnw test` (and `npm test` in `client/` for Phases 3–5), implement, green, then wait for a manual check. One phase at a time.

Every phase has a **TDD record** (fill in with the real command output when the phase is run) and a **Manual check** the user can run. Phases 1–2 have no HTTP yet. Phases 3–4 are the UI (form, nav, localStorage, Logout). Phase 5 is the HTTP login endpoint **and** the Authorization header on later API calls.

### Phase 1: Find user by username - COMPLETED

**Objective**: Look up a user by username from the existing `users` table.

**Steps** (one test each):

1. `findByUsername("admin")` returns the seeded admin.
2. `findByUsername("nobody")` returns `null`.

**Deliverables**: `UserRepository.findByUsername` on the interface and all three implementations; tests on `AbstractUserServiceTests` (or a small repository test that uses the same profiles).

**TDD record**:
- Red: `./mvnw test -Dtest=UserServiceSpringDataJpaTests` — test compile failed: `cannot find symbol findByUsername` on `UserRepository` (`AbstractUserServiceTests.java` lines 43 and 49).
- Green: `./mvnw test` — BUILD SUCCESS, Tests run: 189, Failures: 0, Errors: 0, Skipped: 0. New tests `shouldFindAdminByUsername` and `shouldReturnNullForUnknownUsername` pass on Spring Data, JPA, and JDBC (3 tests in each of those classes, including the existing `shouldAddUser`).

**Manual check**: from the project root run `./mvnw test -Dtest=UserServiceSpringDataJpaTests`. Confirm the new tests failed before the code change and passed after it. There is no HTTP for this lookup yet. Confirm with the user, then mark COMPLETED.

### Phase 2: Check username and password - COMPLETED

**Objective**: `UserService.login` accepts the seeded admin and rejects bad credentials.

**Steps** (one test each):

1. `login("admin", "admin")` returns `true`.
2. `login("nobody", "admin")` returns `false`.
3. `login("admin", "wrong")` returns `false`.

**Deliverables**: `UserService.login` / `UserServiceImpl.login`; `{noop}` stripped before compare.

**TDD record**:
- Red: `./mvnw test -Dtest=UserServiceSpringDataJpaTests` — test compile failed: `cannot find symbol login` on `UserService` (three errors in `AbstractUserServiceTests.java`).
- Green: `./mvnw test` — BUILD SUCCESS, Tests run: 198, Failures: 0. `UserServiceSpringDataJpaTests` now runs 6 tests (including the three login cases).
- Manual confirmation: user ran `./mvnw test -Dtest=UserServiceSpringDataJpaTests` and reported Tests run: 6, Failures: 0.

**Manual check**: run `./mvnw test -Dtest=UserServiceSpringDataJpaTests`. Confirm red then green for the three login tests. Confirm with the user, then mark COMPLETED. User confirmed 23 November 2026.

### Phase 3: Login page and navigation - PLANNED

**Objective**: The UI can open a login form from the top navigation.

**Steps**:

1. Route `/login` renders the form (username, password, Login button).
2. Menu shows a **Login** link to `/login`.
3. Submitting the form posts `{ username, password }` to `/api/login` (the endpoint is added in Phase 5; this phase still wires the call).
4. A non-2xx response stays on the form and shows an error.

**Deliverables**: `configureRoutes.tsx` `/login`; `LoginPage` (or equivalent) using `form/` widgets; `Menu` Login item; client tests if they exist for routes/forms, otherwise `npm test` still run.

**TDD record** (fill in when running the phase):
- Red: `npm test` in `client/` — login page/route tests fail (no `/login`).
- Green: same command — form renders and Login is in the menu.

**Manual check**: `PORT=4444 npm start` from `client/`. Open `http://localhost:4444`, click **Login**, see the form with username, password, and a Login button. A real successful sign-in is Phase 5, after `POST /api/login` exists.

### Phase 4: Store credentials and Logout - PLANNED

**Objective**: Keep username and password in the browser after a 2xx login, and clear them on Logout.

**Steps**:

1. On login 2xx, write `petclinic.username` and `petclinic.password` to `localStorage`.
2. When those keys exist, the menu shows **Logout** instead of **Login**.
3. Logout removes both keys and shows **Login** again.

**Deliverables**: storage helpers used by the login page and `Menu`; tests for save/clear and the Login vs Logout label.

**TDD record** (fill in when running the phase):
- Red: `npm test` in `client/` — storage and logout tests fail.
- Green: same tests pass.

**Manual check**: in DevTools → Application → Local Storage, set `petclinic.username` and `petclinic.password`, then refresh: the menu shows **Logout**. Click **Logout**: both keys are gone and the menu shows **Login**. Successful form login that writes the keys is Phase 5.

### Phase 5: POST /api/login and Authorization header - PLANNED

**Objective**: The login HTTP endpoint returns 200 or 401, the form can complete a real sign-in, and later API calls send Basic credentials.

**Steps** (one test each; controller tests follow `UserRestControllerTests`):

1. `POST /api/login` with `{"username":"admin","password":"admin"}` returns 200.
2. `POST /api/login` with an unknown username returns 401.
3. `POST /api/login` with username `admin` and a wrong password returns 401.
4. `submitForm` and GET `fetch` helpers attach `Authorization: Basic` with Base64 of `username:password` when the keys exist, and omit the header when they do not.
5. Submitting valid `admin` / `admin` on `/login` is treated as success (any 2xx), writes localStorage, and navigates to `/`.

**Deliverables**: OpenAPI `/login`; generated API/DTO; `LoginRestController` (or an added method on `UserRestController`) calling `UserService.login`; `LoginRestControllerTests`; Authorization header in `client/src/util/index.tsx`.

**TDD record** (fill in when running the phase):
- Red: `./mvnw test` — login HTTP tests fail (no `/api/login` or wrong status); `npm test` — Authorization helper tests fail.
- Green: `./mvnw test` — 200 for `admin`/`admin`, 401 for bad username and bad password; `npm test` — header present when stored, absent when not.

**Manual check**: start `./mvnw spring-boot:run` and `PORT=4444 npm start` from `client/`.

Curl:

```
curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:9966/petclinic/api/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

prints `200`. The same call with `"password":"wrong"` prints `401`. An unknown username also prints `401`.

Browser: open `http://localhost:4444`, click **Login**, submit `admin` / `admin`, land on Home. Local Storage has the two keys. Menu shows **Logout**. Find Owners in the Network tab shows `Authorization: Basic …`. Wrong password stays on the form with an error. Logout clears the keys and later requests have no `Authorization` header.

---

## Technical Implementation Details

Fill in paths and snippets as each phase lands.

### Key files (expected)

- `src/main/java/.../repository/UserRepository.java` — add `findByUsername`
- `repository/springdatajpa/SpringDataUserRepository.java`, `repository/jpa/JpaUserRepositoryImpl.java`, `repository/jdbc/JdbcUserRepositoryImpl.java`
- `service/UserService.java`, `service/UserServiceImpl.java` — add `login`
- `src/main/resources/openapi.yml` — `/login`
- `rest/controller/` — login endpoint
- `src/test/java/.../rest/controller/LoginRestControllerTests.java`
- `src/test/java/.../service/userService/AbstractUserServiceTests.java`
- `client/src/configureRoutes.tsx`, `client/src/components/Menu.tsx`
- `client/src/components/` login page
- `client/src/util/index.tsx` — `submitForm` / Authorization header

### Implementation patterns

Password compare (service):

```
stored = user.getPassword()
if stored starts with "{noop}", stored = stored without that prefix
return typedPassword equals stored
```

Basic header (client):

```
btoa(username + ':' + password)
Authorization: Basic <that>
```

### Important notes

- Default app flag stays `petclinic.security.enable=false`. Tests already set it `true`. This sprint does not flip the running app's flag.
- Sending Basic from the UI does not by itself protect the API while `WebSecurityConfig` still `permitAll`. See Future Enhancements.
- Typed password is `admin`. Stored value is `{noop}admin`. Do not send `{noop}admin` from the form.
- `UserRepository` change must land in all three profiles.
- Login POST has no `@PreAuthorize`.

---

## Acceptance Criteria

- [x] `findByUsername("admin")` returns the seeded user
- [x] `findByUsername` for an unknown name returns `null`
- [ ] `login("admin", "admin")` is true
- [ ] `login` with a wrong username is false
- [ ] `login` with a wrong password is false
- [ ] `POST /api/login` with `admin` / `admin` returns 200 and no extra body
- [ ] `POST /api/login` with an invalid username returns 401
- [ ] `POST /api/login` with an invalid password returns 401
- [ ] Menu has **Login** when signed out; it opens `/login`
- [ ] The login form posts username and password to `/api/login`
- [ ] After 200, `localStorage` holds `petclinic.username` and `petclinic.password`
- [ ] After success, the menu shows **Logout**
- [ ] Logout clears `localStorage` and shows **Login**
- [ ] Later API calls include `Authorization: Basic` with Base64 of `username:password`
- [ ] No user-creation form was added
- [ ] No backend session or logout API was added

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Sign in as admin | Home after submitting `admin` / `admin` | Browser: `/login` |
| Reject bad password | Stay on `/login` with an error | Browser: wrong password |
| Signed-in requests | `Authorization` header present on Find Owners | Browser Network tab |
| Sign out | Header gone; menu shows Login | Browser: Logout then Find Owners |

---

## Dependencies

### External Dependencies

- Spring Web, Validation, Data JPA (default profile)
- Spring Security test (`@WithMockUser`) for controller tests
- Existing HSQLDB seed (`admin` / `{noop}admin`)

### Internal Dependencies

- Authentication baseline — `users` / `roles`, `User`, `UserRepository.save`, `UserService.saveUser`
- `ExceptionControllerAdvice` — validation errors
- `client/src/util/index.tsx` — `url()`, `submitForm()`
- `client/src/components/form/` — `Input`, `NotEmpty`
- CORS already allows POST from `http://localhost:4444`

### Configuration

- App default remains `petclinic.security.enable=false`
- Tests remain `petclinic.security.enable=true` in `src/test/resources/application.properties`
- No new environment variables

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Stored password `{noop}admin` does not equal typed `admin`.
- **Mitigation**: Strip `{noop}` in `UserService.login`. Cover with the success test in Phase 2.

- **Risk**: Changing `UserRepository` in Spring Data only. JDBC and JPA profiles fail to compile.
- **Mitigation**: Update all three implementations in Phase 1.

- **Risk**: `Authorization` header is sent but the API still allows anonymous calls.
- **Mitigation**: Expected this sprint. Do not claim the API is locked. Enabling the flag is a Future Enhancement (also needs the `permitAll` chain fix from the baseline).

- **Risk**: Username and password in `localStorage` are visible to any script on the page.
- **Mitigation**: Accepted for this sprint. Call it out in the UI only if testers ask. Improve in a later sprint.

### User Experience Risks

- **Risk**: 401 with an empty body looks like a broken form.
- **Mitigation**: Map 401 to a single message: username or password is wrong.

- **Risk**: Refresh after login still shows **Login** if the menu does not read `localStorage` on load.
- **Mitigation**: Menu decides Login vs Logout from `localStorage` on each render.

---

## Future Enhancements

Not committed to any phase.

- **Turn on API protection** - Set `petclinic.security.enable=true` and fix `WebSecurityConfig` so `permitAll` does not override HTTP Basic. Until then, the header is sent but the API is still open.
- **Safer browser storage** - Stop keeping the raw password in `localStorage` (session storage, httpOnly cookie, or a short-lived token).
- **User-creation screen** - Use existing `POST /api/users` from the UI so the clinic is not limited to `admin`.
- **Real password hashing** - Register a `PasswordEncoder`, widen `users.password`, re-seed hashes. Needed before any public deploy.
- **Disabled-account message** - Same 401, or a specific copy, when `enabled` is false.
- **Hide menu items by role** - Show Find owners vs Veterinarians from the signed-in roles.

---

## Troubleshooting Guide

Add entries as bugs are found. Starters:

### Login 200 in curl, form still errors

**Problem**: Typed `admin` / `admin` fails in the UI.
**Cause**: Body sent `{noop}admin`, or 204 treated as failure.
**Solution**: Send typed `admin`. Treat any 2xx as success (`submitForm` already treats 204 as empty success).
**Code Reference**: `client/src/util/index.tsx`

### Success in the UI, `Authorization` missing later

**Problem**: Find Owners has no Basic header.
**Cause**: `fetch` in a page does not go through `submitForm`.
**Solution**: One helper that both GET and POST/PUT use, or add the header in `url()`'s companion fetch wrapper.
**Code Reference**: `client/src/util/index.tsx`

### `{noop}` mismatch

**Problem**: Phase 2 success test fails for `admin` / `admin`.
**Cause**: Compared typed value to the raw column.
**Solution**: Strip `{noop}` before equals.
**Code Reference**: `UserServiceImpl.login`

---

## Notes for AI Agents

1. Read Overview, Hypothesis, and Business Requirements first. This is sign-in for the existing `admin` account, not a new user-management product.
2. Stay inside Scope. Do not add user-creation UI, JWT, or server sessions.
3. Follow `tdd-workflow.mdc`: one phase, tests first, `./mvnw test`, implement, green, manual check, wait. Fill in that phase's **TDD record** with the real red then green result before asking for the manual check.
4. Follow `unit-testing.mdc` for Java tests. Login controller tests copy `UserRestControllerTests` / `VetRestControllerTests` (`MockMvc` standalone, `@MockBean` for the service in the controller test).
5. Follow `database-access.mdc`: `findByUsername` on **all three** repository implementations.
6. Follow `api-controllers.mdc`: OpenAPI first; login has no `@PreAuthorize`.
7. Follow `frontend.mdc`: custom form widgets, `url()` / `submitForm()`, any 2xx is success.
8. Do not enable `petclinic.security.enable` in `application.properties` in this feature.
9. Cite code as `filepath:line-number`.
10. After each confirmed phase, mark it COMPLETED and ask about committing.

---

## Current Status

**Last Updated**: 23 November 2026
**Current Phase**: Phase 3 - Login page and navigation
**Status**: Phase 2 COMPLETED
**Next Steps**: After commit (if requested), start Phase 3
