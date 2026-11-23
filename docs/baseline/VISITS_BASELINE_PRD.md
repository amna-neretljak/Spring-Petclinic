# Visits - Technical PRD (baseline)

| Field | Value |
|---|---|
| Created | November 5, 2026 |
| Version | 1.1 - Business requirements |
| Version Notes | Added Business Requirements and Future Enhancements; former Phase 4 moved to Future Enhancements |

This is a **baseline** PRD. It describes the vet-visit slice as it exists after the frontend modernization and the client/API path alignment. Later work that changes visits should update this file.

Related: `OWNERS_BASELINE_PRD.md` and `PETS_BASELINE_PRD.md` (a visit belongs to a pet, shown on owner details). Vets are **not** attached to visits — see `VETS_BASELINE_PRD.md`.

---

## Overview/Problem

Clinic clerks need a dated note of what happened to a pet (rabies shot, neutered, …). Without that note they cannot see history on the owner details page or add a new visit.

This sample stores visits in table `visits`, exposes them at `/api/visits` and `POST /api/owners/{ownerId}/pets/{petId}/visits`, and gives the React app an Add Visit form. There is no visit list, edit, or delete in the UI. A visit is a pet booking: date + description. It does not name a veterinarian.

---

## Hypothesis

We believe that nesting a new visit under owner → pet will keep history on the owner details page, so visits do not need their own search root or a chosen vet.

---

## Business Requirements

These were derived from the existing behaviour of the application during the baseline review. They describe what the clinic needs from visit records, not how it is built.

### User Needs

- A front-desk clerk needs to record a visit for a pet, with a date and a short description, so that the pet's treatment history is kept.
- A clerk needs to see a pet's past visits on the owner's page so that they know what was done before.

### Business Rules

- Every visit belongs to exactly one pet.
- Every visit has a description of at most 255 characters.
- If no date is given, the visit is dated today.
- A pet's visits are shown newest first.
- A visit does not record which veterinarian saw the pet.
- Deleting a pet also deletes its visits.
- When access control is on, managing visits requires the owner admin role.

### Exclusions

- Clerks cannot edit or delete a visit from the web app.
- There is no calendar, no booking of future appointments, and no visit status (such as scheduled or completed).
- Visits are not assigned to a veterinarian.
- There is no billing.

---

## Scope

### In Scope

- Table `visits` and entity `Visit` (extends `BaseEntity`)
- `VisitRepository` / `ClinicService` visit methods
- REST nested: `POST /api/owners/{ownerId}/pets/{petId}/visits`
- REST standalone: `/api/visits` CRUD
- React: Add Visit form; visit rows on owner details (`PetsTable`)
- Client validation: `NotEmpty` on description
- Role `ROLE_OWNER_ADMIN` on every visit API method (enforced only when security is on)

### Out of Scope

Boundaries of this baseline. Items that may be built later are listed in Future Enhancements.

- Choosing a veterinarian for the visit
- Edit or delete visit in the UI
- A standalone visit list or calendar
- Recurring visits, status (scheduled / completed), or billing

### Cut

- A dedicated `VisitService`. Visits go through `ClinicService`.
- Using `POST /api/visits` from the React app. The UI always posts to the nested owner/pet path so `pet_id` is set from the URL.
- Returning `[]` with HTTP 200 when there are no visits. Empty list returns **404**.
- Nested create checking that `petId` belongs to `ownerId`. The controller sets `visit.pet.id = petId` and does not load the owner.

---

## Technical Requirements

### Database Schema

No Flyway or Liquibase. Same SQL init as authentication: `db/hsqldb/initDB.sql` + `populateDB.sql`, Hibernate `ddl-auto=none`. See `AUTHENTICATION_BASELINE_PRD.md` for how init is wired.

```sql
CREATE TABLE visits (
  id          INTEGER IDENTITY PRIMARY KEY,
  pet_id      INTEGER NOT NULL,
  visit_date  DATE,
  description VARCHAR(255)
);
ALTER TABLE visits ADD CONSTRAINT fk_visits_pets FOREIGN KEY (pet_id) REFERENCES pets (id);
CREATE INDEX visits_pet_id ON visits (pet_id);
```

Seed: 4 visits, all in January 2013, on Jean Coleman’s cats Samantha (id 7) and Max (id 8): rabies shot, rabies shot, neutered, spayed.

JPA:

- `Visit` extends `BaseEntity`
- `date` maps to column `visit_date` (`LocalDate`). Constructor sets `date = LocalDate.now()` when the field is omitted
- `description` `@NotEmpty`
- `pet` `@ManyToOne` `Pet`
- JSON DTO: `{ id, date, description, petId }` — property name is `date`, not `visitDate`

### Service layer

No visit-only service. `ClinicService` / `ClinicServiceImpl`:

| Method | Transaction | Behaviour |
|---|---|---|
| `findAllVisits()` | read-only | `visitRepository.findAll()` |
| `findVisitById(id)` | read-only | missing → `null` |
| `saveVisit(visit)` | write | insert or update |
| `deleteVisit(visit)` | write | delete |

Default repository: `SpringDataVisitRepository` (`@Profile("spring-data-jpa")`).

`Pet.addVisit` keeps both sides of the association in memory; nested REST create builds a stub `Pet` with only `id` set and saves the visit.

### API Endpoints

Base URL: `http://localhost:9966/petclinic/api`. All methods: `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`. With the default flag off, they are open.

The React app uses **only** nested POST. Listing visits for display comes from `GET /api/owners/{id}` (pets include `visits`), not from `/api/visits`.

#### POST /api/owners/{ownerId}/pets/{petId}/visits

**Request body (`VisitFields`):**

```json
{
  "date": "2013-01-01",
  "description": "rabies shot"
}
```

OpenAPI: `description` required (minLength 1, maxLength 255); `date` optional (`yyyy-MM-dd`). If `date` is omitted, the entity default is today.

Server sets `visit.pet.id = petId`. It does not verify that the pet exists or belongs to `ownerId`.

**Response:** 201 `Visit` plus `Location: /api/visits/{id}`.

#### GET /api/visits, GET /api/visits/{visitId}

List / get. Not called by the React app. Empty list → 404.

#### POST /api/visits

Body is a full `Visit` DTO (includes `petId`). Returns **201** (OpenAPI for this path says 200). The UI does not use this.

#### PUT /api/visits/{visitId}

Updates `date` and `description` only.

**Response:** **204** (OpenAPI says 200 with a body).

#### DELETE /api/visits/{visitId}

**Response:** 204. Not called by the React app. CORS does not allow DELETE from the browser.

### User Interface Requirements

#### Owner details (`/owners/:ownerId`)

- `PetsTable` → `VisitsTable`: each visit’s date and description
- **Add Visit** → `/owners/:ownerId/pets/:petId/visits/new`
- No edit or delete per row

#### Add Visit (`/owners/:ownerId/pets/:petId/visits/new`)

- On mount: `GET /api/owners/{ownerId}`; local visit `{ isNew: true, date: null, description: '' }`
- `PetDetails`: pet name, birth date, type, owner name
- Fields: Date (`DateInput`), Description (`NotEmpty`)
- Submit `POST /api/owners/{id}/pets/{petId}/visits` with `{ date, description }` only
- 2xx → `/owners/{ownerId}`
- Heading is **Visits** (plural); button is **Add Visit**

---

## Implementation Phases

### Phase 1: Store and service - COMPLETED

**Objective**: Persist visits on a pet.

**Deliverables**: `visits` table, `Visit`, `VisitRepository`, `ClinicService` visit methods, `Pet.addVisit`.

### Phase 2: REST API - COMPLETED

**Objective**: Nested create plus standalone visit CRUD.

**Deliverables**: `openapi.yml` visit and owners-pets-visits paths, generated APIs/DTOs, `OwnerRestController.addVisitToOwner`, `VisitRestController`, `VisitMapper` (`pet.id` → `petId`).

### Phase 3: React add visit - COMPLETED

**Objective**: Add a visit from owner details and see it on the pet’s history.

**Deliverables**: route in `configureRoutes.tsx`; `VisitsPage`, `PetDetails`; 2xx handling; owner fetch uses plural `/api/owners/{id}`.

---

## Technical Implementation Details

### Database layer

- Schema: `src/main/resources/db/hsqldb/initDB.sql` (`visits`)
- Seed: `src/main/resources/db/hsqldb/populateDB.sql`
- Entity: `model/Visit.java`
- Access: `repository/VisitRepository.java`; default `repository/springdatajpa/SpringDataVisitRepository.java`

### Service layer

- `service/ClinicService.java` / `ClinicServiceImpl.java` — `findAllVisits`, `findVisitById`, `saveVisit`, `deleteVisit`

### API routes

- `rest/controller/OwnerRestController.java` — `addVisitToOwner`
- `rest/controller/VisitRestController.java` — standalone `/visits`
- `mapper/VisitMapper.java` — `pet.id` → `petId`
- Contract: `src/main/resources/openapi.yml` `/owners/{ownerId}/pets/{petId}/visits`, `/visits`

### Frontend pieces

- `client/src/configureRoutes.tsx` — `/owners/:ownerId/pets/:petId/visits/new`
- `client/src/components/owners/PetsTable.tsx` — history table + Add Visit link
- `client/src/components/visits/VisitsPage.tsx`
- `client/src/components/visits/PetDetails.tsx`
- `client/src/components/form/DateInput.tsx`, `Input.tsx`, `Constraints.ts` (`NotEmpty`)
- `client/src/types/index.ts` — `IVisit`

### Important Notes

- JSON field is `date`. The SQL column is `visit_date`.
- Nested POST does not check owner/pet consistency. A wrong `petId` can insert with that `pet_id` or fail the FK.
- Owner details show visits because `GET /api/owners/{id}` includes `pets[].visits`, not because the visit form refetches `/api/visits`.
- OpenAPI PUT `/visits/{id}` is 200; Java returns 204. Nested POST is 201 and matches.
- A visit is not an appointment with a vet in this sample.

---

## Acceptance Criteria

- [x] `GET /api/owners/6` includes Samantha and Max with the four seeded visits
- [x] Add Visit from Max `POST` returns 201 and the UI returns to `/owners/6`
- [x] New visit appears under that pet after navigation
- [x] Description is required client-side (`NotEmpty`)
- [x] Request body is `{ date, description }` (no `petId` in the nested POST)
- [x] No visit-edit or visit-delete control in the UI
- [x] Visit API methods are annotated `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| History on owner 6 | Four seeded visit rows | Browser: `/owners/6` |
| Add visit | New row after save | Browser: Add Visit then owner details |

---

## Dependencies

### External Dependencies

- Spring Web, Validation, Data JPA (default profile)
- Spring Security method annotations (no-op while the auth flag is false)

### Internal Dependencies

- Authentication slice — role name `ROLE_OWNER_ADMIN`
- Owners slice — details page and `GET /api/owners/{id}` payload
- Pets slice — `pet_id`, Add Visit link on `PetsTable`
- SQL init scripts (no migration framework)

### Configuration

- `server.port=9966`, context path `/petclinic/`
- CORS origin `http://localhost:4444`
- `petclinic.security.enable=false` by default

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Nested POST does not verify the pet belongs to the owner in the URL.
- **Mitigation**: The UI only offers Add Visit from that owner’s pet. A scripted call can attach a visit to any `petId`. Tighten the controller if that becomes a problem.

- **Risk**: OpenAPI PUT 200 vs actual 204.
- **Mitigation**: Client does not call PUT today. If edit is added, treat any 2xx as success (same as owner/pet editors).

- **Risk**: Empty `/api/visits` returns 404. Harmless while the UI never lists that path.

### User Experience Risks

- **Risk**: Users look for a vet picker on Add Visit.
- **Mitigation**: Out of scope. Copy is “Visits” / description only.

- **Risk**: Date left blank. Entity defaults to today; the datepicker can send `null`.
- **Mitigation**: Prefer sending an explicit `yyyy-MM-dd`. Confirm in the browser if a blank date is accepted.

---

## Future Enhancements

Not committed to any phase. Moving an item into a phase makes it committed work.

- **Edit and delete a visit from the web app** - Edit and delete controls, a confirm dialog, `DELETE` added to the CORS list, and optionally nested GET/PUT routes for a single visit. Today a mistake in a visit cannot be fixed from the UI.
- **Assign a veterinarian to a visit** - Record who saw the pet. This needs a change to the vets slice as well.
- **Book future appointments** - Visits with a status (scheduled, completed, cancelled) so the clinic can plan ahead, not only record the past.
- **Visit list or calendar** - A view of visits across pets by day or week, for planning the clinic's workload.
- **Check that the pet belongs to the owner** - Reject a nested visit create when the pet in the URL is not that owner's pet. Today only the UI prevents this.
- **Set today's date in the form** - Fill the date field with today by default, so a blank date is never sent.
- **Align the OpenAPI contract** - Document `POST /visits` as 201 and `PUT /visits/{id}` as 204, so the contract and the code agree.

---

## Troubleshooting Guide

### Add Visit stays on the form

**Problem**: Save looks like it failed.
**Cause**: Client only treated 200/201 as success, or the owner fetch used a singular `/api/owner` path so `owner.id` was missing.
**Solution**: Nested POST returns 201; treat 200–299 as success. Load owner from `/api/owners/{id}`.
**Code Reference**: `client/src/components/visits/VisitsPage.tsx`

### New visit does not show on owner details

**Problem**: POST succeeded but the table is unchanged.
**Cause**: Details page reads visits from the owner GET, which join-fetches pets. Confirm 201 and then a fresh `GET /api/owners/{id}`.
**Solution**: Navigate to `/owners/{id}` after 2xx (current client does this).
**Code Reference**: `VisitsPage.onSubmit`, `OwnersPage`

### Description required error

**Problem**: Submit blocked or 400.
**Cause**: `@NotEmpty` on the entity; client `NotEmpty` on the input.
**Solution**: Fill description. Server errors arrive as header `errors`, not always as JSON `fieldErrors`.
**Code Reference**: `model/Visit.java`, `client/src/components/form/Constraints.ts`

---

## Notes for AI Agents

1. Visits nest under owner → pet in the UI. Do not add a top-level visit calendar without a new phase. Future Enhancements are ideas, not tasks.
2. Do not add `vet_id` unless product intent changes; the vets PRD is a separate roster.
3. Nested POST must keep setting `pet` from `{petId}`. Do not switch the UI to `POST /api/visits` without sending `petId`.
4. Display of history is owner-details chrome (`PetsTable`); creating a visit is this slice.
5. Cite code as `filepath:line-number`.

---

## Current Status

**Last Updated**: 5 November 2026
**Current Phase**: Phases 1–3 complete; edit, delete, and list listed under Future Enhancements
**Status**: BASELINE DOCUMENTED
**Runtime**: Add Visit works against `POST /api/owners/{id}/pets/{petId}/visits` from `http://localhost:4444`
**Next Steps**: Baseline PRDs for authentication, owners, pets, vets, and visits are in `docs/baseline/`
