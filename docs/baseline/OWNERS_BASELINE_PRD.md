# Owners - Technical PRD (baseline)

| Field | Value |
|---|---|
| Created | November 5, 2026 |
| Version | 1.1 - Business requirements |
| Version Notes | Added Business Requirements and Future Enhancements; former Phase 4 moved to Future Enhancements |

This is a **baseline** PRD. It describes the pet-owner slice as it exists after the frontend modernization and the client/API path alignment. Later work that changes owners should update this file.

Related: `AUTHENTICATION_BASELINE_PRD.md` (role `ROLE_OWNER_ADMIN`). Nested pet and visit calls hang off `/api/owners/{id}/…` but belong to the pets and visits PRDs.

---

## Overview/Problem

Clinic clerks need a record of each person who brings animals in: name, address, city, telephone, and the pets attached to them. Without that record they cannot find an owner, add a pet, or book a visit.

This sample stores owners in table `owners`, exposes them at `/api/owners`, and gives the React app Find / list / details / create / edit screens. Delete exists on the API only. There is no owner-delete button in the UI.

---

## Hypothesis

We believe that treating the owner as the root of the clinic desk (search by last name, then drill into pets and visits) will keep the other slices from each inventing their own “who does this animal belong to” model.

---

## Business Requirements

These were derived from the existing behaviour of the application during the baseline review. They describe what the clinic needs from owner records, not how it is built.

### User Needs

- A front-desk clerk needs to find an owner by last name, or see all owners, so that they can open the right client record quickly.
- A clerk needs to register a new owner with contact details so that the clinic can reach them and attach their pets.
- A clerk needs to update an owner's contact details so that the record stays correct.
- A clerk needs to see an owner's pets and their visit history in one place so that they can serve the client at the desk.

### Business Rules

- Every owner has a first name, last name, address, city, and telephone number. All five are required.
- Names contain letters only.
- The telephone number contains digits only, at most 10.
- Searching by last name matches the beginning of the name and ignores upper and lower case. An empty search shows every owner.
- An owner can have zero or more pets. Every pet belongs to exactly one owner.
- Deleting an owner also deletes their pets and those pets' visits.
- When access control is on, managing owners requires the owner admin role.

### Exclusions

- Clerks cannot delete an owner from the web app.
- There is no search by first name, city, or telephone, and no sorting or paging of results.
- The clinic does not detect duplicate owners.
- Owners are clinic records, not users. They never sign in.

---

## Scope

### In Scope

- Table `owners` and entity `Owner` (extends `Person`)
- `OwnerRepository` / `ClinicService` owner methods / `OwnerRestController` / `OwnerMapper`
- REST: list (optional `lastName`), get by id, create, update, delete
- React: Find Owners, owner table, owner details, new owner, edit owner
- Client validation: `NotEmpty` on name/address/city, `Digits(10)` on telephone
- Role `ROLE_OWNER_ADMIN` on every owner API method (enforced only when security is on)

### Out of Scope

Boundaries of this baseline. Items that may be built later are listed in Future Enhancements.

- Pets and visits as their own records (see those PRDs). This slice only owns the owner row and the list of pets shown on the details page.
- Deleting an owner from the UI
- Pagination, sorting, or search by first name / city / telephone
- Owner login. Owners are clinic data, not application users (`users` / `roles` are authentication)

### Cut

- A dedicated `OwnerService`. Owners go through `ClinicService` like pets, vets, and visits.
- Returning `[]` with HTTP 200 when a last-name search matches nobody. The API returns **404** with an empty body; the UI maps that to an empty table.

---

## Technical Requirements

### Database Schema

No Flyway or Liquibase. Same SQL init as authentication: `db/hsqldb/initDB.sql` + `populateDB.sql`, Hibernate `ddl-auto=none`. See `AUTHENTICATION_BASELINE_PRD.md` for how init is wired.

```sql
CREATE TABLE owners (
  id         INTEGER IDENTITY PRIMARY KEY,
  first_name VARCHAR(30),
  last_name  VARCHAR_IGNORECASE(30),
  address    VARCHAR(255),
  city       VARCHAR(80),
  telephone  VARCHAR(20)
);
CREATE INDEX owners_last_name ON owners (last_name);
```

`pets.owner_id` is a foreign key to `owners.id` (defined on the pets table, not here).

Seed: 10 owners (George Franklin id 1 through Carlos Estaban id 10). Last names used in demos: Franklin, Davis, Rodriquez, McTavish, Coleman, Black, Escobito, Schroeder, Estaban.

JPA:

- `Owner` extends `Person` extends `BaseEntity`
- `Person`: `firstName`, `lastName` (`@NotEmpty`)
- `Owner`: `address`, `city`, `telephone` (`@NotEmpty`; telephone `@Digits(fraction = 0, integer = 10)`), `pets` `@OneToMany` EAGER, cascade ALL
- `id` is generated (`IDENTITY`). `isNew()` is true when `id == null` and is `@JsonIgnore` (the JSON DTO does not send `isNew`)

### Service layer

No owner-only service. `ClinicService` / `ClinicServiceImpl`:

| Method | Transaction | Behaviour |
|---|---|---|
| `findAllOwners()` | read-only | `ownerRepository.findAll()` |
| `findOwnerById(id)` | read-only | `findById`; missing row → `null` (swallows JPA/JDBC not-found) |
| `findOwnerByLastName(lastName)` | read-only | prefix match `lastName LIKE lastName%`, pets join-fetched |
| `saveOwner(owner)` | write | insert or update |
| `deleteOwner(owner)` | write | delete (cascades to pets via JPA mapping) |

Default repository: `SpringDataOwnerRepository` (`@Profile("spring-data-jpa")`).

```
SELECT DISTINCT owner FROM Owner owner left join fetch owner.pets
  WHERE owner.lastName LIKE :lastName%
SELECT owner FROM Owner owner left join fetch owner.pets WHERE owner.id = :id
```

### API Endpoints

Base URL: `http://localhost:9966/petclinic/api`. All methods: `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`. With the default flag off, they are open.

Nested `/owners/{id}/pets` and `/owners/{id}/pets/{petId}/visits` are implemented on `OwnerRestController` but specified in the pets and visits PRDs.

#### GET /api/owners

Query: `lastName` optional.

- If `lastName` is **absent**, `findAllOwners()`
- If `lastName` is **present** (including empty string), `findOwnerByLastName`. Empty string matches every last name (`LIKE '%'`)
- The React Find Owners page always sends `?lastName=`, so it always takes the second branch
- No matches → **404** empty body (not `[]`)

**Response:** 200 array of `Owner` (includes `pets`); 404 none.

#### GET /api/owners/{ownerId}

**Response:** 200 `Owner` with `pets`; 404 unknown id.

#### POST /api/owners

**Request body (`OwnerFields`):**

```json
{
  "firstName": "George",
  "lastName": "Franklin",
  "address": "110 W. Liberty St.",
  "city": "Madison",
  "telephone": "6085551023"
}
```

OpenAPI: names `^[a-zA-Z]*$`, telephone `^[0-9]*$`, all five fields required.

**Response:** 201 `Owner` plus `Location: /api/owners/{id}`.

#### PUT /api/owners/{ownerId}

Same body as create. Updates name, address, city, telephone. Does not replace the pets collection.

**Response:** **204** (OpenAPI says 200 with a body). The UI treats any 2xx as success and navigates with the id it already has.

#### DELETE /api/owners/{ownerId}

**Response:** 204. Not called by the React app. `WebSecurityConfig` CORS does not allow DELETE from the browser.

### User Interface Requirements

#### Find Owners (`/owners/list`)

- Menu **Find owners** goes here
- Last-name field + **Find Owner** (writes `?lastName=` into the URL)
- Loads owners on mount (empty last name → all owners)
- Table: name (link to `/owners/{id}`), city, telephone, pet names. Address column is hidden on small screens
- 404 from the API → **0 Owners found**
- **Add Owner** → `/owners/new`

#### Owner details (`/owners/:ownerId`)

- `OwnerInformation`: name, address, city, telephone
- **Edit Owner**, **Add New Pet**
- `PetsTable`: each pet’s name, birth date, type, visits; **Edit Pet**, **Add Visit**
- Missing owner → **No Owner loaded**

#### New Owner (`/owners/new`) / Edit Owner (`/owners/:ownerId/edit`)

- Shared `OwnerEditor`
- Fields: First Name, Last Name, Address, City, Telephone
- Client constraints: `NotEmpty`; telephone `Digits(10)`
- Submit `POST /api/owners` or `PUT /api/owners/{id}` with the five fields only
- 2xx → `/owners/{id}`
- Heading always says **New Owner** even on edit (copy bug, not an API bug)

---

## Implementation Phases

### Phase 1: Store and service - COMPLETED

**Objective**: Persist owners and look them up by id and last-name prefix.

**Deliverables**: `owners` table, `Owner` / `Person` / `BaseEntity`, `OwnerRepository` (JPA / JDBC / Spring Data), `ClinicService` owner methods.

### Phase 2: REST API - COMPLETED

**Objective**: CRUD at `/api/owners`.

**Deliverables**: `openapi.yml` owner paths, generated `OwnersApi` / `OwnerDto` / `OwnerFieldsDto`, `OwnerRestController`, `OwnerMapper`.

### Phase 3: React owner desk - COMPLETED

**Objective**: Find, list, details, create, edit against the current API.

**Deliverables**: routes in `configureRoutes.tsx`; `FindOwnersPage`, `OwnersTable`, `OwnersPage`, `OwnerInformation`, `PetsTable`, `NewOwnerPage`, `EditOwnerPage`, `OwnerEditor`; plural `/api/owners` paths; 2xx handling; 404 → empty list.

---

## Technical Implementation Details

### Database layer

- Schema: `src/main/resources/db/hsqldb/initDB.sql` (`owners`)
- Seed: `src/main/resources/db/hsqldb/populateDB.sql`
- Entity: `src/main/java/.../model/Owner.java` (extends `Person`)
- Access: `repository/OwnerRepository.java`; default `repository/springdatajpa/SpringDataOwnerRepository.java`

### Service layer

- `service/ClinicService.java` / `ClinicServiceImpl.java` — `findAllOwners`, `findOwnerById`, `findOwnerByLastName`, `saveOwner`, `deleteOwner`

### API routes

- `rest/controller/OwnerRestController.java` — list, get, add, update, delete
- `mapper/OwnerMapper.java` — `Owner` ↔ `OwnerDto` / `OwnerFieldsDto` (uses `PetMapper`)
- Contract: `src/main/resources/openapi.yml` `/owners`, `/owners/{ownerId}`

### Frontend pieces

- `client/src/configureRoutes.tsx` — `/owners/list`, `/owners/new`, `/owners/:ownerId`, `/owners/:ownerId/edit`
- `client/src/components/Menu.tsx` — Find owners → `/owners/list`
- `client/src/components/owners/FindOwnersPage.tsx` — search + list
- `client/src/components/owners/OwnersTable.tsx`
- `client/src/components/owners/OwnersPage.tsx` — details
- `client/src/components/owners/OwnerInformation.tsx`
- `client/src/components/owners/PetsTable.tsx` — display only; links into pets/visits
- `client/src/components/owners/NewOwnerPage.tsx`, `EditOwnerPage.tsx`, `OwnerEditor.tsx`
- `client/src/util/index.tsx` — `url()`, `submitForm()`
- `client/src/components/form/Input.tsx`, `Constraints.ts`

### Important Notes

- Last-name search is prefix, case-insensitive on HSQLDB (`VARCHAR_IGNORECASE`).
- Empty `lastName` query still lists everyone because the UI always sends the parameter.
- JSON has no `isNew`. New vs edit is local React state (`NewOwnerPage` sets `isNew: true`).
- OpenAPI name pattern is letters only; the client `NotEmpty` check is weaker. A name with a hyphen can pass the form and fail Bean Validation.
- `PetsTable` is owner-details chrome. Creating or editing a pet is the pets slice.

---

## Acceptance Criteria

- [x] `GET /api/owners?lastName=` returns the seeded owners (10) with HTTP 200
- [x] `GET /api/owners?lastName=Zzz` returns 404; Find Owners shows **0 Owners found**
- [x] `GET /api/owners/1` returns George Franklin and pet Leo
- [x] Menu **Find owners** lists owners without typing a last name
- [x] Clicking an owner name opens details (not **No Owner loaded**)
- [x] New Owner `POST` returns 201 and the UI goes to `/owners/{id}`
- [x] Edit Owner `PUT` returns 204 and the UI goes back to details
- [x] Telephone client-side: at most 10 digits
- [x] No delete control in the UI
- [x] Owner API methods are annotated `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Find Owners from the menu | Table of seeded owners without extra clicks | Browser: `/owners/list` |
| Owner details | Name, address, at least one pet for id 1 | Browser: `/owners/1` |
| Create owner | New row visible in Find Owners after save | POST then GET list |

---

## Dependencies

### External Dependencies

- Spring Web, Validation, Data JPA (default profile)
- Spring Security method annotations (no-op while the auth flag is false)

### Internal Dependencies

- Authentication slice — role name `ROLE_OWNER_ADMIN`
- Pets slice — `Owner.pets`, details table, add/edit pet links
- Visits slice — visit rows and add-visit links on the details page
- `ExceptionControllerAdvice` — validation errors as header `errors`
- SQL init scripts (no migration framework)

### Configuration

- `server.port=9966`, context path `/petclinic/`
- CORS origin `http://localhost:4444`
- `petclinic.security.enable=false` by default

---

## Risks and Mitigation

### Technical Risks

- **Risk**: 404 on empty search looks like a broken API in curl/logs.
- **Mitigation**: UI already maps 404 to `[]`. Do not “fix” the controller to 200 without updating Find Owners.

- **Risk**: OpenAPI PUT 200 vs actual 204.
- **Mitigation**: Client accepts any 2xx. Keep that if the status is left as 204.

- **Risk**: Delete is on the API, not in CORS or the UI. A scripted DELETE still works when security is off.
- **Mitigation**: Expected for this sample. Do not add a UI delete without CORS and a confirm step.

### User Experience Risks

- **Risk**: Edit form title says **New Owner**.
- **Mitigation**: Copy-only; button label already says **Update Owner**. Fix in `OwnerEditor` if it confuses testers.

---

## Future Enhancements

Not committed to any phase. Moving an item into a phase makes it committed work.

- **Delete an owner from the web app** - A delete button with a confirm dialog, a `DELETE` call, and `DELETE` added to the CORS list in `WebSecurityConfig`. Today deleting is only possible with a script.
- **Wider search, sorting, and paging** - Search by first name, city, or telephone, and sort or page long result lists. This matters once the clinic has more than a handful of owners.
- **Empty search returns an empty list** - Return HTTP 200 with `[]` instead of 404 when nothing matches, and update Find Owners in the same change. This makes the API easier to read in logs and tools.
- **Duplicate owner warning** - Warn when a new owner matches an existing name and telephone number, so the same client is not registered twice.
- **Client validation that matches the server** - Check that names contain letters only in the form, so a name with a hyphen is rejected before it reaches the API.
- **Correct heading on Edit Owner** - Show "Edit Owner" instead of "New Owner" when editing.
- **Align the OpenAPI contract** - Document `PUT /owners/{id}` as 204, or return 200 with a body, so the contract and the code agree.

---

## Troubleshooting Guide

### No Owner loaded

**Problem**: Details page never fills in.
**Cause**: Wrong path (`/api/owner/{id}`) or `url()` producing `/petclinic//api/...`.
**Solution**: Use `url('/api/owners/' + id)` (helper strips extra slashes).
**Code Reference**: `client/src/util/index.tsx`, `client/src/components/owners/OwnersPage.tsx`

### Find Owners table empty from the menu

**Problem**: Search form shows, no rows, until **Find Owner** is clicked.
**Cause**: Older client fetched only when `lastName` was in the URL.
**Solution**: Current `FindOwnersPage` fetches on mount.
**Code Reference**: `client/src/components/owners/FindOwnersPage.tsx`

### Search for a missing name leaves the old table

**Problem**: Last-name `Zzz` still shows previous owners.
**Cause**: 404 body is empty; `response.json()` throws; state never updates.
**Solution**: Treat 404 as `[]`.
**Code Reference**: `client/src/components/owners/FindOwnersPage.tsx` (`fetchData`)

### Update Owner stays on the form

**Problem**: Save looks like it failed.
**Cause**: Client only treated 200/201 as success; PUT returns 204.
**Solution**: Treat status 200–299 as success; navigate with `owner.id`.
**Code Reference**: `client/src/components/owners/OwnerEditor.tsx`

---

## Notes for AI Agents

1. Owner is the clinic-desk root. Pets and visits nest under `/api/owners/{id}` but have their own PRDs.
2. Do not add owner login. That is the authentication slice (`users` / `roles`).
3. Do not add UI delete without a new phase. Future Enhancements are ideas, not tasks.
4. Keep last-name 404 → empty list behaviour unless both API and UI change together.
5. Cite code as `filepath:line-number`.

---

## Current Status

**Last Updated**: 5 November 2026
**Current Phase**: Phases 1–3 complete; UI delete and related work listed under Future Enhancements
**Status**: BASELINE DOCUMENTED
**Runtime**: Find / details / create / edit work against `http://localhost:9966/petclinic/api/owners` from `http://localhost:4444`
**Next Steps**: Baseline PRDs for authentication, owners, pets, vets, and visits are in `docs/baseline/`
