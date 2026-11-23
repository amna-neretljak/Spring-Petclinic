# Authentication - Technical PRD (baseline)

| Field | Value |
|---|---|
| Created | November 5, 2026 |
| Version | 1.1 - Business requirements |
| Version Notes | Added Business Requirements and Future Enhancements; former Phase 4 moved to Future Enhancements |

This is a **baseline** PRD. It describes the authentication and authorization slice as it exists in this repository after the frontend modernization, not a plan to add a new login product. Later work that changes auth should update this file.

---

## Overview/Problem

The clinic REST API can hold owner, pet, vet, and visit data. Without a shared identity and permission model, any browser that can reach `localhost:9966` can read and write that data. This sample therefore ships a user store (`users` / `roles`), HTTP Basic authentication, and method-level role checks on every REST controller.

Today that protection is **switched off**. `petclinic.security.enable=false`, CORS and a second filter chain permit every request, and the React app has no login page and never sends an `Authorization` header. Local discovery works without credentials. Turning the flag on without a UI would make every `fetch` from `localhost:4444` return 401.

---

## Hypothesis

We believe that keeping one user/role store and HTTP Basic + `@PreAuthorize` on the API will give owners, pets, vets, and visits a single security model, so those slices do not invent their own login.

---

## Business Requirements

These were derived from the existing behaviour of the application during the baseline review. They describe what the clinic needs from access control, not how it is built.

### User Needs

- A clinic administrator needs to create staff accounts with specific permissions so that only authorized people can change clinic data.
- Front-desk staff need to manage owners, pets, and visits so that they can register clients and record appointments.
- Veterinary staff managers need to manage the veterinarian roster, specialties, and pet types so that the clinic's reference data stays correct.
- Developers and trainers need to run the application locally without signing in so that discovery, demos, and teaching are not blocked.

### Business Rules

- Every account has at least one role. An account without a role cannot be created.
- There are three roles:
  - **Owner admin** - manages owners, pets, and visits, and can read pet types.
  - **Vet admin** - manages veterinarians, specialties, and pet types.
  - **Admin** - creates accounts.
- One account can hold several roles.
- Account names are unique.
- A disabled account cannot sign in.
- Access control is off by default and is switched on by configuration, not by changing code.
- When access control is on, every request carries the caller's credentials. There is no separate sign-in step and no session.
- Only the clinic's own web application may call the API from a browser.

### Exclusions

- The web application has no sign-in or sign-out screen.
- People cannot register their own accounts.
- There is no password reset, and no way to list, edit, disable, or delete accounts.
- There is no single sign-on, social login, or token-based login.
- Pet owners are clinic records, not users. They never sign in.
- The current setup is not intended to be exposed on a public network.

---

## Scope

### In Scope

What this slice already is, and what this PRD treats as the contract:

- Database tables `users` and `roles`, seeded with `admin` / `admin`
- Domain entities `User` and `Role`
- `UserRepository` / `UserService` / `UserRestController` (`POST /api/users`)
- Spring Security toggle `petclinic.security.enable`
- HTTP Basic against the JDBC user store when the toggle is true
- Roles `ROLE_OWNER_ADMIN`, `ROLE_VET_ADMIN`, `ROLE_ADMIN` and `@PreAuthorize` on REST methods
- CORS for the React origin `http://localhost:4444`

### Out of Scope

Boundaries of this baseline. Items that may be built later are listed in Future Enhancements.

- A login, logout, or “current user” page in React
- Session cookies, JWT, OAuth, or SSO
- Password hashing beyond Spring’s `{noop}` prefix in seed data
- Self-registration from the UI
- User list, get-by-id, update, or delete endpoints
- CSRF tokens (CSRF is disabled in every security chain)

### Cut

- Wiring `PasswordEncoderFactories.createDelegatingPasswordEncoder()` in `BasicAuthenticationConfig` — the class imports it and never uses it. Seed passwords stay `{noop}admin`.
- A dedicated login API (`POST /api/login`). HTTP Basic on each request is the only mechanism.

---

## Technical Requirements

### Database Schema

HSQLDB (default). MySQL and PostgreSQL copies live under `src/main/resources/db/`.

There is **no migration framework** (no Flyway, no Liquibase). Hibernate is `ddl-auto=none`, so entities do not create tables. `users` and `roles` are created by Spring Boot SQL init, same as the clinic tables:

- Schema: `spring.sql.init.schema-locations=classpath*:db/hsqldb/initDB.sql`
- Seed: `spring.sql.init.data-locations=classpath*:db/hsqldb/populateDB.sql`

On in-memory HSQLDB those scripts run at every startup and the data is discarded when the process stops. MySQL and PostgreSQL have matching files, but init is commented out, so you apply them yourself. A later change (for example widening `users.password` for a real hash) means editing `initDB.sql` in each dialect, unless Flyway or Liquibase is added first.

```sql
CREATE TABLE users (
  username    VARCHAR(20) NOT NULL,
  password    VARCHAR(20) NOT NULL,
  enabled     BOOLEAN DEFAULT TRUE NOT NULL,
  PRIMARY KEY (username)
);

CREATE TABLE roles (
  id              INTEGER IDENTITY PRIMARY KEY,
  username        VARCHAR(20) NOT NULL,
  role            VARCHAR(20) NOT NULL
);
ALTER TABLE roles ADD CONSTRAINT fk_username FOREIGN KEY (username) REFERENCES users (username);
CREATE INDEX fk_username_idx ON roles (username);
```

Seed (`db/hsqldb/populateDB.sql`):

```sql
INSERT INTO users(username,password,enabled) VALUES ('admin','{noop}admin', true);
INSERT INTO roles (username, role) VALUES ('admin', 'ROLE_OWNER_ADMIN');
INSERT INTO roles (username, role) VALUES ('admin', 'ROLE_VET_ADMIN');
INSERT INTO roles (username, role) VALUES ('admin', 'ROLE_ADMIN');
```

`{noop}` tells Spring’s delegating password encoder that the value is stored in plain text. Column `users.password` is `VARCHAR(20)`, so encoded hashes will not fit until `initDB.sql` is edited (there is no migration to add).

JPA mapping:

- `User` → table `users`. Primary key is `username` (not a numeric id). `roles` is `@OneToMany` EAGER.
- `Role` → table `roles`. Extends `BaseEntity` (numeric `id`). `name` maps to column `role`. Unique (`username`, `role`). Back-reference to `User` is `@JsonIgnore`.

### Service layer

`UserService` / `UserServiceImpl` is the only business bean for this slice. `ClinicService` does not know about users.

`saveUser(User user)`:

1. Rejects a user with no roles (`IllegalArgumentException`).
2. Prefixes each role name with `ROLE_` if it is missing.
3. Sets `role.user` when it is null.
4. Saves through `UserRepository` (Spring Data JPA on the default profile).

There is no `findByUsername`, no password check, and no “current user” method. Authentication reads the tables through Spring Security JDBC, not through this service.

### API Endpoints

Base URL: `http://localhost:9966/petclinic/api`.

There is **no** `POST /api/login` and **no** `GET /api/me`. When security is on, the client authenticates by sending HTTP Basic on each request (`Authorization: Basic base64(admin:admin)`).

#### POST /api/users

Creates a user. Requires role `ROLE_ADMIN` when method security is active.

**Request body:**

```json
{
  "username": "jane",
  "password": "secret",
  "enabled": true,
  "roles": [{ "name": "OWNER_ADMIN" }]
}
```

`UserServiceImpl` will store the role as `ROLE_OWNER_ADMIN`.

**Response:**

- Success (201): the saved `User` DTO
- Error (400): missing roles, or Bean Validation failure
- Error (401/403): only when `petclinic.security.enable=true` and the caller is missing `ROLE_ADMIN`

OpenAPI documents this as 200; the controller returns **201**. Same class of mismatch as owner update (see `ARCHITECTURE.md` §6).

The React app does not call this endpoint.

### Authorization map (used by the other slices)

When `petclinic.security.enable=true` and method security is on:

| Role | Endpoints |
|---|---|
| `ROLE_OWNER_ADMIN` | Owners, pets, visits; read pet types |
| `ROLE_VET_ADMIN` | Vets, specialties; write pet types; read pet types |
| `ROLE_ADMIN` | `POST /api/users` |

The seeded `admin` user has all three.

### User Interface Requirements

There is **no authentication UI**.

- No `/login` route in `configureRoutes.tsx`
- `Menu` has Home, Find owners, Veterinarians, Error only
- `util/index.tsx` `fetch` / `submitForm` send `Accept` and `Content-Type`, not `Authorization`
- Enabling the security flag without adding a login screen will break every page that calls the API

A login screen is listed under Future Enhancements, not part of this baseline.

---

## Implementation Phases

### Phase 1: User store and REST create - COMPLETED

**Objective**: Persist users and roles; allow an admin to create a user via the API.

**Deliverables**:

- Tables in `db/hsqldb/initDB.sql` (and mysql/postgresql copies)
- `model/User.java`, `model/Role.java`
- `UserRepository` + Spring Data / JPA / JDBC implementations
- `UserService` / `UserServiceImpl`
- `UserMapper`, `UserRestController`, OpenAPI `/users`

### Phase 2: HTTP Basic and method security - COMPLETED (off by default)

**Objective**: Optional HTTP Basic against the JDBC user store, with `@PreAuthorize` on controllers.

**Deliverables**:

- `security/Roles.java`
- `security/BasicAuthenticationConfig.java` (`petclinic.security.enable=true`)
- `security/DisableSecurityConfig.java` (`petclinic.security.enable=false`)
- `@PreAuthorize` on REST controllers
- Flag in `application.properties` defaulting to `false`

### Phase 3: CORS for the React origin - COMPLETED

**Objective**: Allow the SPA on port 4444 to call the API.

**Deliverables**:

- `security/WebSecurityConfig.java` — origin `http://localhost:4444`, methods `OPTIONS, GET, POST, PUT`, CSRF off, `permitAll`

---

## Technical Implementation Details

### Database layer

- No Flyway or Liquibase. Schema is Spring Boot SQL init, not versioned migrations. `spring.jpa.hibernate.ddl-auto=none`.
- Schema: `src/main/resources/db/hsqldb/initDB.sql` (`users`, `roles`)
- Seed: `src/main/resources/db/hsqldb/populateDB.sql`
- Wired in `src/main/resources/application-hsqldb.properties` (`spring.sql.init.schema-locations`, `spring.sql.init.data-locations`)
- Entities: `src/main/java/.../model/User.java`, `Role.java`
- Access: `repository/UserRepository.java`; default impl `repository/springdatajpa/SpringDataUserRepository.java` (`@Profile("spring-data-jpa")`)

### Service layer

- `service/UserService.java` — `saveUser`
- `service/UserServiceImpl.java` — role prefix and persistence
- Login is **not** in this layer. Spring Security JDBC runs:

```
select username,password,enabled from users where username=?
select username,role from roles where username=?
```

### API routes

- `rest/controller/UserRestController.java` — `POST /api/users`, `@PreAuthorize("hasRole(@roles.ADMIN)")`
- `mapper/UserMapper.java` — MapStruct `User` ↔ `UserDto`
- Contract: `src/main/resources/openapi.yml` path `/users`

### Security configuration

- `application.properties` — `petclinic.security.enable=false`
- `security/DisableSecurityConfig.java` — loads when the flag is false; `permitAll`, CSRF off
- `security/BasicAuthenticationConfig.java` — loads when the flag is true; HTTP Basic, JDBC users, `@EnableGlobalMethodSecurity(prePostEnabled = true)`, CSRF off
- `security/WebSecurityConfig.java` — **always** loads; `permitAll` + CORS. This chain has no `@Order`. If both this and Basic auth are present, which chain wins is not guaranteed. Verify before treating “enable=true” as actually protecting the API.
- `security/Roles.java` — bean used as `@roles.OWNER_ADMIN` in SpEL

### Frontend pieces

None. Relevant absences:

- `client/src/configureRoutes.tsx` — no login route
- `client/src/util/index.tsx` — no credentials
- `client/src/components/Menu.tsx` — no login/logout item

### Important Notes

- Default mode is unauthenticated. That is how local discovery is meant to run.
- `users.password VARCHAR(20)` cannot hold a bcrypt hash.
- `PasswordEncoder` is imported in `BasicAuthenticationConfig` and not registered as a bean.
- CSRF is disabled in every chain. Acceptable for a local JSON SPA; not acceptable if the API is exposed on a network without another control.
- CORS in `WebSecurityConfig` does not allow `DELETE`. This UI never calls DELETE.

---

## Acceptance Criteria

Baseline (what is true of the current code):

- [x] With `petclinic.security.enable=false`, `GET /api/owners` and `GET /api/vets` succeed with no `Authorization` header
- [x] Seed user `admin` / `{noop}admin` exists after HSQLDB init, with all three roles
- [x] `POST /api/users` exists and is annotated `@PreAuthorize("hasRole(@roles.ADMIN)")`
- [x] `UserService.saveUser` rejects a user with no roles
- [x] React origin `http://localhost:4444` is on the CORS allow list for GET/POST/PUT
- [x] The React app has no login route and does not send Basic auth
- [ ] `petclinic.security.enable=true` has been verified to reject anonymous calls (blocked by the always-on `permitAll` chain in `WebSecurityConfig` until that is ordered or removed)
- [ ] React can log in (out of scope for this baseline)

---

## Success Metrics

This is a sample, not a production auth system. Use these only as checks that the slice still behaves:

| Metric | Target | How Measured |
|--------|--------|--------------|
| Anonymous API access with flag off | HTTP 200 on `GET /api/pettypes` | curl, no Authorization header |
| Seed admin present | One `users` row `admin` | Query after startup, or create-user API with security off |
| CORS from the SPA | Veterinarians and Find Owners load in the browser at port 4444 | Manual click-through |

---

## Dependencies

### External Dependencies

- Spring Security (via `spring-boot-starter-security`) — filter chains, HTTP Basic, JDBC auth, method security
- Spring Data JPA (default profile) — `UserRepository`

### Internal Dependencies

- HSQLDB schema init (or MySQL/PostgreSQL profile)
- `ExceptionControllerAdvice` — turns `IllegalArgumentException` from `saveUser` into JSON
- Other domain PRDs (owners, pets, vets, visits) — they rely on the role names in this file; they do not own login

### Configuration

- `petclinic.security.enable` in `src/main/resources/application.properties` (default `false`)
- `server.port=9966`, `server.servlet.context-path=/petclinic/`
- CORS origin hard-coded to `http://localhost:4444` in `WebSecurityConfig`

---

## Risks and Mitigation

### Technical Risks

- **Risk**: `WebSecurityConfig` always registers `permitAll`. Enabling Basic auth may not actually protect endpoints.
- **Mitigation**: Before turning the flag on for real use, give the Basic chain a higher precedence (`@Order`) or stop permitting all in `WebSecurityConfig`. Confirm with an anonymous curl that returns 401.

- **Risk**: Plain-text `{noop}` passwords and `VARCHAR(20)`.
- **Mitigation**: Do not expose this API. A later auth PRD must widen the column and use a real encoder.

- **Risk**: Two CORS setups (`WebSecurityConfig` vs `@CrossOrigin` on controllers).
- **Mitigation**: Keep the SPA on port 4444. Document any second origin before adding it.

### User Experience Risks

- **Risk**: A developer sets `petclinic.security.enable=true` and the UI dies with 401 on every page.
- **Mitigation**: Leave the flag false until a login UI exists (see Future Enhancements). Put a comment next to the flag.

---

## Future Enhancements

Not committed to any phase. Moving an item into a phase makes it committed work.

- **Sign-in and sign-out in the web app** - A login route and form, a sign-out item in the menu, and somewhere to hold the credentials. Without this, access control cannot be switched on without breaking every page.
- **Send credentials from the client and handle 401** - Attach the `Authorization` header in `url()` / `submitForm` and send the user to the login screen on 401. This is what makes the sign-in screen useful.
- **Make the security flag actually protect the API** - Order or remove the always-on `permitAll` chain in `WebSecurityConfig`, then confirm an anonymous call returns 401. Until then, `petclinic.security.enable=true` is not a trustworthy switch.
- **Real password hashing** - Register a `PasswordEncoder` bean, widen `users.password` beyond `VARCHAR(20)` in every dialect, and re-seed with a hash. Plain-text passwords are acceptable only for a local sample.
- **Account management** - List, view, update, disable, and delete accounts, plus password reset. Today an admin can only create accounts.
- **Versioned migrations for auth tables** - Add Flyway or Liquibase so changes to `users` and `roles` (for example the wider password column) are applied the same way on every database instead of by hand.
- **Token-based login** - Replace HTTP Basic on every request with a short-lived token (for example JWT) if the app needs sessions, expiry, or a mobile client.
- **CSRF and network hardening** - Re-enable CSRF protection or an equivalent control before the API is reachable from a network.
- **One configurable CORS setup** - Replace the hard-coded `http://localhost:4444` and the second `@CrossOrigin` setup with one configurable allow list, including `DELETE` if a client needs it.

---

## Troubleshooting Guide

### API open with no login (expected)

**Problem**: curl without credentials returns 200.
**Cause**: `petclinic.security.enable=false` and/or `WebSecurityConfig` `permitAll`.
**Solution**: This is the default. To require login, set the flag to true **and** fix filter-chain order, then send Basic `admin:admin`.
**Code Reference**: `src/main/resources/application.properties` (`petclinic.security.enable`), `src/main/java/.../security/DisableSecurityConfig.java`, `WebSecurityConfig.java`

### 401 from the React app after enabling security

**Problem**: Home still renders; vets/owners stay empty or the console shows 401.
**Cause**: `submitForm` / `fetch` send no `Authorization` header.
**Solution**: Do not enable the flag until a login UI exists (see Future Enhancements). Workaround: call the API with curl `-u admin:admin`.
**Code Reference**: `client/src/util/index.tsx`

### Create user fails with “User must have at least a role set!”

**Problem**: `POST /api/users` returns 400.
**Cause**: `roles` missing or empty.
**Solution**: Send `"roles": [{ "name": "OWNER_ADMIN" }]`.
**Code Reference**: `src/main/java/.../service/UserServiceImpl.java`

### CORS error in the browser

**Problem**: `fetch` fails with a CORS error, not a JSON body.
**Cause**: UI not on `http://localhost:4444`, or method not GET/POST/PUT (for example DELETE).
**Solution**: Start the client with `PORT=4444 npm start`.
**Code Reference**: `src/main/java/.../security/WebSecurityConfig.java`

---

## Notes for AI Agents

When working with this PRD:

1. Read Overview and Hypothesis first. This slice is **identity and access for the API**, not a clinic desk screen.
2. Stay inside Scope. Do not add a React login unless a later PRD says so. Future Enhancements are ideas, not tasks.
3. Do not treat `petclinic.security.enable=true` as proven until the `permitAll` chain order is fixed and tested.
4. Other domain PRDs (owners, pets, vets, visits) may reference the role names here. They must not duplicate user tables.
5. Update phase status and acceptance checkboxes when code changes.
6. Cite code as `filepath:line-number`.

---

## Current Status

**Last Updated**: 5 November 2026
**Current Phase**: Phases 1–3 complete in code; login UI and related work listed under Future Enhancements
**Status**: BASELINE DOCUMENTED
**Default runtime**: security off; React talks to the API anonymously from `http://localhost:4444`
**Next Steps**: Baseline PRDs for authentication, owners, pets, vets, and visits are in `docs/baseline/`
