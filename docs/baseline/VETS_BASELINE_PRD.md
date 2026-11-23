# Vets - Technical PRD (baseline)

| Field | Value |
|---|---|
| Created | November 5, 2026 |
| Version | 1.1 - Business requirements |
| Version Notes | Added Business Requirements and Future Enhancements; former Phase 4 moved to Future Enhancements |

This is a **baseline** PRD. It describes the veterinarian and specialty slice as it exists after the frontend modernization. Later work that changes vets should update this file.

Related: `AUTHENTICATION_BASELINE_PRD.md` (role `ROLE_VET_ADMIN`). Vets are not linked to visits in this sample — a visit is a pet booking, not an appointment with a named vet.

---

## Overview/Problem

Clinic clerks need a roster of veterinarians and what each one specializes in (radiology, surgery, dentistry). Without that roster they cannot tell a client who works at the clinic.

This sample stores vets in table `vets`, specialties in `specialties`, and the many-to-many link in `vet_specialties`. It exposes them at `/api/vets` and `/api/specialties`. The React app has a single **Veterinarians** table (read-only). Create, update, and delete exist on the API only.

---

## Hypothesis

We believe that keeping vets as a read-only staff list, separate from the owner → pet → visit desk, will stop visits from requiring a chosen veterinarian that this sample does not store.

---

## Business Requirements

These were derived from the existing behaviour of the application during the baseline review. They describe what the clinic needs from its veterinarian roster, not how it is built.

### User Needs

- A front-desk clerk needs to see which veterinarians work at the clinic and what each one specializes in so that they can answer client questions.
- A veterinary staff manager needs to add, update, and remove veterinarians and their specialties so that the roster stays correct. Today this is possible through the API only.

### Business Rules

- Every veterinarian has a first name and a last name. Names contain letters only.
- A veterinarian can have zero or more specialties. A specialty can belong to many veterinarians.
- Specialties come from the clinic's list (radiology, surgery, and dentistry by default). Assigning a specialty name that is not on the list has no effect; it is not added.
- A veterinarian with no specialties is shown as "none".
- When access control is on, managing veterinarians and specialties requires the vet admin role.

### Exclusions

- The web app shows the roster read-only. There is no add, edit, or delete screen.
- Veterinarians are not linked to visits or appointments.
- There are no schedules, working hours, or availability.
- There is no search or filtering of the roster.

---

## Scope

### In Scope

- Tables `vets`, `specialties`, `vet_specialties`
- Entities `Vet` (extends `Person`) and `Specialty` (extends `NamedEntity`)
- `VetRepository` / `SpecialtyRepository` / `ClinicService` vet and specialty methods
- REST: `/api/vets` and `/api/specialties` CRUD
- React: Veterinarians page (`GET /api/vets`)
- Role `ROLE_VET_ADMIN` on every vet and specialty API method (enforced only when security is on)

### Out of Scope

Boundaries of this baseline. Items that may be built later are listed in Future Enhancements.

- Assigning a vet to a visit
- A vet details page, or create / edit / delete in the UI
- A specialties admin screen
- Search, pagination, or filtering of vets

### Cut

- A dedicated `VetService`. Vets go through `ClinicService`.
- Returning `[]` with HTTP 200 when there are no vets. Empty list returns **404**.
- Linking visits to vets. `visits` has `pet_id` only.

---

## Technical Requirements

### Database Schema

No Flyway or Liquibase. Same SQL init as authentication: `db/hsqldb/initDB.sql` + `populateDB.sql`, Hibernate `ddl-auto=none`. See `AUTHENTICATION_BASELINE_PRD.md` for how init is wired.

```sql
CREATE TABLE vets (
  id         INTEGER IDENTITY PRIMARY KEY,
  first_name VARCHAR(30),
  last_name  VARCHAR(30)
);
CREATE INDEX vets_last_name ON vets (last_name);

CREATE TABLE specialties (
  id   INTEGER IDENTITY PRIMARY KEY,
  name VARCHAR(80)
);
CREATE INDEX specialties_name ON specialties (name);

CREATE TABLE vet_specialties (
  vet_id       INTEGER NOT NULL,
  specialty_id INTEGER NOT NULL
);
ALTER TABLE vet_specialties ADD CONSTRAINT fk_vet_specialties_vets
  FOREIGN KEY (vet_id) REFERENCES vets (id);
ALTER TABLE vet_specialties ADD CONSTRAINT fk_vet_specialties_specialties
  FOREIGN KEY (specialty_id) REFERENCES specialties (id);
```

Seed vets (6):

| id | Name | Specialties |
|---|---|---|
| 1 | James Carter | none |
| 2 | Helen Leary | radiology |
| 3 | Linda Douglas | surgery, dentistry |
| 4 | Rafael Ortega | surgery |
| 5 | Henry Stevens | radiology |
| 6 | Sharon Jenkins | none |

Seed specialties: radiology, surgery, dentistry (ids 1–3).

JPA:

- `Vet` extends `Person` (`firstName`, `lastName` `@NotEmpty`)
- `specialties` `@ManyToMany` EAGER, join table `vet_specialties`
- `getSpecialties()` returns a list sorted by name; `nrOfSpecialties` is `@JsonIgnore`
- `Specialty` extends `NamedEntity`, table `specialties`
- JSON DTO: `{ id, firstName, lastName, specialties: [{ id, name }, ...] }`

### Service layer

No vet-only service. `ClinicService` / `ClinicServiceImpl`:

| Method | Transaction | Behaviour |
|---|---|---|
| `findAllVets()` / `findVets()` | read-only | both call `vetRepository.findAll()` (duplicate methods) |
| `findVetById(id)` | read-only | missing → `null` |
| `saveVet(vet)` | write | insert or update, including join-table rows |
| `deleteVet(vet)` | write | delete |
| `findAllSpecialties()` | read-only | all specialties |
| `findSpecialtyById(id)` | read-only | missing → `null` |
| `findSpecialtiesByNameIn(names)` | read-only | used on create/update to attach managed specialty entities |
| `saveSpecialty` / `deleteSpecialty` | write | specialty catalog admin |

Default repositories: `SpringDataVetRepository`, `SpringDataSpecialtyRepository`.

On create/update, names on the incoming specialty list are resolved with `findSpecialtiesByNameIn`. Unknown names are dropped rather than created.

### API Endpoints

Base URL: `http://localhost:9966/petclinic/api`. All methods: `@PreAuthorize("hasRole(@roles.VET_ADMIN)")`. With the default flag off, they are open.

The React app uses **only** `GET /api/vets`.

#### GET /api/vets

**Response:** 200 array of `Vet` (each with `specialties`); 404 if none.

#### GET /api/vets/{vetId}

**Response:** 200 `Vet`; 404 unknown id. Not used by the UI.

#### POST /api/vets

**Request body (`Vet`):**

```json
{
  "firstName": "James",
  "lastName": "Carter",
  "specialties": [{ "name": "radiology" }]
}
```

OpenAPI: names `^[a-zA-Z]*$`; `specialties` required (may be `[]`).

**Response:** **201** plus `Location: /api/vets/{id}` (OpenAPI says 200). Specialties resolved by name.

#### PUT /api/vets/{vetId}

Replaces name and specialty set (clears then re-adds, then resolves by name).

**Response:** **204** (OpenAPI says 200 with a body).

#### DELETE /api/vets/{vetId}

**Response:** 204. Not called by the React app. CORS does not allow DELETE from the browser.

#### /api/specialties

Full CRUD (`GET` list/by-id, `POST` 201, `PUT`/`DELETE` 204). No UI. Same `VET_ADMIN` role.

### User Interface Requirements

#### Veterinarians (`/vets`)

- Menu **Veterinarians** goes here (`<a href="/vets">`, full page load)
- On mount: `GET api/vets` (no leading slash; `url()` still builds a valid path)
- Table: Name (`firstName lastName`), Specialties (comma-separated names, or **none**)
- No row links, no add button, no edit, no delete
- Empty API 404 is not handled: `response.json()` on an empty body will fail; seed data always has six vets
- Menu `active` check is `name === 'vets'` while the path is `/vets`, so the item does not highlight (copy/state bug)

---

## Implementation Phases

### Phase 1: Store and service - COMPLETED

**Objective**: Persist vets, specialties, and the join table.

**Deliverables**: SQL tables, `Vet` / `Specialty`, repositories, `ClinicService` vet and specialty methods.

### Phase 2: REST API - COMPLETED

**Objective**: CRUD at `/api/vets` and `/api/specialties`.

**Deliverables**: `openapi.yml` vet and specialty paths, generated APIs/DTOs, `VetRestController`, `SpecialtyRestController`, `VetMapper`, `SpecialtyMapper`.

### Phase 3: React roster - COMPLETED

**Objective**: Read-only veterinarians table.

**Deliverables**: route `/vets`; `VetsPage`; menu link.

---

## Technical Implementation Details

### Database layer

- Schema: `src/main/resources/db/hsqldb/initDB.sql` (`vets`, `specialties`, `vet_specialties`)
- Seed: `src/main/resources/db/hsqldb/populateDB.sql`
- Entities: `model/Vet.java`, `model/Specialty.java`
- Access: `repository/VetRepository.java`, `repository/SpecialtyRepository.java`; default Spring Data implementations

### Service layer

- `service/ClinicService.java` / `ClinicServiceImpl.java` — `findAllVets`, `findVets`, `findVetById`, `saveVet`, `deleteVet`, specialty methods, `findSpecialtiesByNameIn`

### API routes

- `rest/controller/VetRestController.java`
- `rest/controller/SpecialtyRestController.java`
- `mapper/VetMapper.java`, `mapper/SpecialtyMapper.java`
- Contract: `src/main/resources/openapi.yml` `/vets`, `/specialties`

### Frontend pieces

- `client/src/configureRoutes.tsx` — `/vets`
- `client/src/components/Menu.tsx` — Veterinarians
- `client/src/components/vets/VetsPage.tsx`
- `client/src/types/index.ts` — `IVet`, `ISpecialty`

### Important Notes

- `findVets()` and `findAllVets()` are the same query. The list endpoint uses `findAllVets()`.
- Create/update attach specialties that already exist by **name**. Posting a new specialty name on a vet does not insert into `specialties`.
- OpenAPI POST `/vets` is 200; Java returns 201. OpenAPI PUT is 200; Java returns 204.
- Visits do not reference vets. Changing this roster does not change owner details.

---

## Acceptance Criteria

- [x] `GET /api/vets` returns six seeded vets with specialties
- [x] James Carter and Sharon Jenkins show **none** in the UI
- [x] Linda Douglas shows surgery and dentistry
- [x] Menu **Veterinarians** opens `/vets` and fills the table
- [x] No create / edit / delete controls on the page
- [x] Vet API methods are annotated `@PreAuthorize("hasRole(@roles.VET_ADMIN)")`

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Veterinarians from the menu | Six rows, specialties readable | Browser: `/vets` |
| Seed specialties | radiology, surgery, dentistry appear on the right vets | Browser + `GET /api/vets` |

---

## Dependencies

### External Dependencies

- Spring Web, Validation, Data JPA (default profile)
- Spring Security method annotations (no-op while the auth flag is false)

### Internal Dependencies

- Authentication slice — role name `ROLE_VET_ADMIN`
- `Person` / `NamedEntity` / `BaseEntity`
- SQL init scripts (no migration framework)

### Configuration

- `server.port=9966`, context path `/petclinic/`
- CORS origin `http://localhost:4444`
- `petclinic.security.enable=false` by default

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Empty vet table → 404 → `VetsPage` `response.json()` throws.
- **Mitigation**: Seed always has six vets. If the table can be empty, map 404 to `[]` like Find Owners.

- **Risk**: POST/PUT specialty names that are not in `specialties` silently disappear.
- **Mitigation**: Create the specialty via `/api/specialties` first, or document that names must already exist.

- **Risk**: DELETE works with curl when security is off, but not from the browser (CORS).
- **Mitigation**: Expected. Do not add UI delete without CORS and a confirm step.

### User Experience Risks

- **Risk**: Veterinarians menu item never looks active.
- **Mitigation**: `Menu` compares `name === 'vets'` to path `/vets`. Fix the comparison if testers notice.

- **Risk**: Users expect to pick a vet when adding a visit.
- **Mitigation**: Out of scope. Visits store pet, date, and description only.

---

## Future Enhancements

Not committed to any phase. Moving an item into a phase makes it committed work.

- **Veterinarian and specialty management screens** - Add, edit, and delete veterinarians and specialties from the web app, with confirm dialogs and `DELETE` added to the CORS list. Today this needs the API.
- **Link veterinarians to visits** - Record which veterinarian saw the pet. This needs a change to the visits slice as well.
- **Schedules and availability** - Working hours or open slots per veterinarian, as a basis for booking appointments.
- **Search and filter the roster** - Filter by specialty or name once the roster grows.
- **Handle an empty roster** - Treat a 404 from `GET /api/vets` as an empty list so the page shows "no veterinarians" instead of failing.
- **Report unknown specialties** - Reject an unknown specialty name with a readable message instead of silently dropping it.
- **Highlight the menu item** - Make Veterinarians show as active in the menu when the page is open.
- **Align the OpenAPI contract** - Document `POST /vets` as 201 and `PUT /vets/{id}` as 204, so the contract and the code agree.
- **Remove the duplicate service method** - `findVets()` and `findAllVets()` do the same thing. Keep one.

---

## Troubleshooting Guide

### Veterinarians table empty

**Problem**: Heading shows, no rows.
**Cause**: `GET /api/vets` failed (backend down, wrong port), or 404 empty body and `json()` threw.
**Solution**: Confirm `http://localhost:9966/petclinic/api/vets` returns 200 with an array. Restart the API if HSQLDB was wiped without re-seed (it re-seeds on each in-memory start).
**Code Reference**: `client/src/components/vets/VetsPage.tsx`

### Specialties always “none”

**Problem**: Every vet shows none.
**Cause**: Join table not loaded, or JSON missing `specialties`.
**Solution**: Entity fetch is EAGER; DTO includes `specialties`. Check `vet_specialties` seed and mapper.
**Code Reference**: `model/Vet.java`, `mapper/VetMapper.java`

### POST /api/vets ignores a new specialty name

**Problem**: Created vet has an empty specialty list.
**Cause**: `findSpecialtiesByNameIn` only returns rows that already exist.
**Solution**: `POST /api/specialties` first, then attach by that name.
**Code Reference**: `VetRestController.addVet`

---

## Notes for AI Agents

1. The UI is a roster, not a staff admin. Do not add edit/delete without a new phase. Future Enhancements are ideas, not tasks.
2. Do not add `vet_id` to visits unless the visits PRD is changed on purpose.
3. Specialty names on create/update must already exist in `specialties`.
4. Keep 404-on-empty-list unless both API and `VetsPage` change together.
5. Cite code as `filepath:line-number`.

---

## Current Status

**Last Updated**: 5 November 2026
**Current Phase**: Phases 1–3 complete; UI admin and related work listed under Future Enhancements
**Status**: BASELINE DOCUMENTED
**Runtime**: Veterinarians table works against `http://localhost:9966/petclinic/api/vets` from `http://localhost:4444`
**Next Steps**: Baseline PRDs for authentication, owners, pets, vets, and visits are in `docs/baseline/`
