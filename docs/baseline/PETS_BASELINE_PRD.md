# Pets - Technical PRD (baseline)

| Field | Value |
|---|---|
| Created | November 5, 2026 |
| Version | 1.1 - Business requirements |
| Version Notes | Added Business Requirements and Future Enhancements; former Phase 4 moved to Future Enhancements |

This is a **baseline** PRD. It describes the pet and pet-type slice as it exists after the frontend modernization and the client/API path alignment. Later work that changes pets should update this file.

Related: `OWNERS_BASELINE_PRD.md` (every pet belongs to an owner). Nested visit rows on a pet belong to `VISITS_BASELINE_PRD.md`.

---

## Overview/Problem

Clinic clerks need a record of each animal: name, birth date, type (cat, dog, …), and which owner brought it in. Without that record they cannot edit the animal or book a visit.

This sample stores animals in table `pets` and types in table `types`, exposes them at `/api/pets`, `/api/pettypes`, and `/api/owners/{ownerId}/pets`, and gives the React app Add Pet / Edit Pet screens that hang off owner details. There is no standalone pet list in the UI. Delete exists on the API only.

---

## Hypothesis

We believe that nesting pets under an owner (`/owners/{id}/pets`) will keep the desk flow as “find the person, then add or edit their animals,” so pets do not become a second search root next to owners.

---

## Business Requirements

These were derived from the existing behaviour of the application during the baseline review. They describe what the clinic needs from pet records, not how it is built.

### User Needs

- A front-desk clerk needs to add a pet to an owner so that the animal can be treated and have visits recorded.
- A clerk needs to correct a pet's name, birth date, or type so that the record stays accurate.
- A clerk needs to choose the pet's type from a fixed list so that records are consistent across the clinic.
- A clerk needs to see all of an owner's pets on the owner's page so that they can pick the right animal for a visit.

### Business Rules

- Every pet belongs to exactly one owner, chosen when the pet is added.
- A pet is always reached through its owner. A pet cannot be opened or changed under a different owner.
- Every pet has a name, a birth date, and a type.
- The type must be one of the clinic's pet types. The default list is cat, dog, lizard, snake, bird, and hamster.
- Deleting a pet also deletes its visits.
- When access control is on, managing pets requires the owner admin role. Reading pet types requires the owner admin or vet admin role. Changing the list of pet types requires the vet admin role.

### Exclusions

- There is no list or search of pets across owners.
- Clerks cannot delete a pet from the web app.
- Clerks cannot add, rename, or remove pet types from the web app.
- A pet cannot be moved to another owner.

---

## Scope

### In Scope

- Tables `pets` and `types`; entities `Pet` (extends `NamedEntity`) and `PetType`
- `PetRepository` / `PetTypeRepository` / `ClinicService` pet and pet-type methods
- REST nested under owners: add, get, update a pet
- REST standalone: `/api/pets` and `/api/pettypes` CRUD
- React: New Pet, Edit Pet, type dropdown from `GET /api/pettypes`
- Role `ROLE_OWNER_ADMIN` on pet methods; pet-type list/get also allow `ROLE_VET_ADMIN`; pet-type writes require `ROLE_VET_ADMIN`

### Out of Scope

Boundaries of this baseline. Items that may be built later are listed in Future Enhancements.

- Visits as their own records (see visits PRD). This slice only owns the pet row and the type catalog.
- A pet search or list page in the UI
- Admin screens to create, rename, or delete pet types
- Deleting a pet from the UI

### Cut

- A dedicated `PetService`. Pets go through `ClinicService` like owners, vets, and visits.
- Using `POST /api/pets` from the React app. The UI always posts to `/api/owners/{ownerId}/pets` so the owner is set on the server.
- Returning `[]` with HTTP 200 when the pet or type catalog is empty. Empty collections return **404**.

---

## Technical Requirements

### Database Schema

No Flyway or Liquibase. Same SQL init as authentication: `db/hsqldb/initDB.sql` + `populateDB.sql`, Hibernate `ddl-auto=none`. See `AUTHENTICATION_BASELINE_PRD.md` for how init is wired.

```sql
CREATE TABLE types (
  id   INTEGER IDENTITY PRIMARY KEY,
  name VARCHAR(80)
);
CREATE INDEX types_name ON types (name);

CREATE TABLE pets (
  id         INTEGER IDENTITY PRIMARY KEY,
  name       VARCHAR(30),
  birth_date DATE,
  type_id    INTEGER NOT NULL,
  owner_id   INTEGER NOT NULL
);
ALTER TABLE pets ADD CONSTRAINT fk_pets_owners FOREIGN KEY (owner_id) REFERENCES owners (id);
ALTER TABLE pets ADD CONSTRAINT fk_pets_types FOREIGN KEY (type_id) REFERENCES types (id);
CREATE INDEX pets_name ON pets (name);
```

`visits.pet_id` is a foreign key to `pets.id` (defined on the visits table, not here).

Seed types: cat, dog, lizard, snake, bird, hamster (ids 1–6).

Seed pets: 13 rows. Examples: Leo (cat, owner 1), Basil (hamster, owner 2), Rosy and Jewel (dogs, owner 3).

JPA:

- `PetType` extends `NamedEntity` (`name` `@NotEmpty`), table `types`
- `Pet` extends `NamedEntity`: `birthDate` (`LocalDate`), `type` `@ManyToOne` `PetType`, `owner` `@ManyToOne` `Owner`, `visits` `@OneToMany` EAGER cascade ALL
- `id` is generated (`IDENTITY`). JSON DTO has `id`, `name`, `birthDate`, `type`, `ownerId`, `visits` — not `isNew`

### Service layer

No pet-only service. `ClinicService` / `ClinicServiceImpl`:

| Method | Transaction | Behaviour |
|---|---|---|
| `findAllPets()` | read-only | `petRepository.findAll()` |
| `findPetById(id)` | read-only | missing row → `null` |
| `savePet(pet)` | write | insert or update |
| `deletePet(pet)` | write | delete (cascades to visits via JPA mapping) |
| `findAllPetTypes()` | read-only | all types |
| `findPetTypes()` | read-only | types ordered by name (`SELECT ptype FROM PetType ptype ORDER BY ptype.name`) |
| `findPetTypeById(id)` | read-only | missing → `null` |
| `findPetTypeByName(name)` | read-only | used when adding/updating a nested pet; missing → `null` |
| `savePetType` / `deletePetType` | write | type catalog admin |

Default repositories: `SpringDataPetRepository`, `SpringDataPetTypeRepository` (`@Profile("spring-data-jpa")`).

### API Endpoints

Base URL: `http://localhost:9966/petclinic/api`. Pet methods: `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`. Pet-type list/get: `OWNER_ADMIN` or `VET_ADMIN`. Pet-type writes: `VET_ADMIN` only. With the default flag off, they are open.

The React app uses the **nested** pet routes and `GET /api/pettypes`. Standalone `/api/pets` is API-only.

#### POST /api/owners/{ownerId}/pets

**Request body (`PetFields`):**

```json
{
  "name": "Leo",
  "birthDate": "2010-09-07",
  "type": { "id": 1, "name": "cat" }
}
```

Server looks up the type by **name**, sets `owner.id = ownerId`, saves.

**Response:** 201 `Pet` plus `Location: /api/pets/{id}`.

#### GET /api/owners/{ownerId}/pets/{petId}

**Response:** 200 `Pet` if that pet’s `owner.id` equals `ownerId`; **400** if the pet exists but belongs to another owner; 404 if owner or pet is missing.

Owner matching compares **ids**, not `Owner.equals` (entities loaded in different sessions are not equal by reference/equals).

#### PUT /api/owners/{ownerId}/pets/{petId}

Same body as create. Updates name, birth date, and type (again by name). Same 400/404 rules as GET.

**Response:** **204**.

#### GET /api/pettypes

Used by the pet editor dropdown.

**Response:** 200 array of `{ id, name }`; 404 if none.

#### GET /api/pets, GET /api/pets/{petId}

List / get without an owner path. Not called by the React app.

#### POST /api/pets

Body is a full `Pet` DTO. Returns **200** with the request DTO (does not attach an owner). The UI does not use this.

#### PUT /api/pets/{petId}, DELETE /api/pets/{petId}

Update returns **204** (OpenAPI says 200). Delete returns 204. No CORS `DELETE`; no UI.

#### Pet-type writes

`POST /api/pettypes` 201; `PUT` / `DELETE` 204. No pet-type admin UI.

### User Interface Requirements

#### Owner details (`/owners/:ownerId`)

- **Add New Pet** → `/owners/:ownerId/pets/new`
- Each pet in `PetsTable`: name, birth date, type; **Edit Pet**, **Add Visit**
- Display only. Creating or editing is this slice; visit rows are the visits slice.

#### New Pet (`/owners/:ownerId/pets/new`)

- `NewPetPage` loads owner + pet types; blank pet `{ isNew: true, name: '', birthDate: null, typeId: null }`
- Shared `PetEditor`

#### Edit Pet (`/owners/:ownerId/pets/:petId/edit`)

- `EditPetPage` loads `GET /api/owners/{ownerId}/pets/{petId}` plus owner and types
- Maps API `type.id` onto form `typeId`

#### Pet editor (shared)

- Read-only owner name
- Fields: Name, Birth date (`DateInput`, `yyyy-MM-dd`), Type (`SelectInput` of pet types)
- Submit sends `{ name, birthDate, type: { id, name } }` — **not** `typeId`
- POST nested path when `isNew`, PUT nested path otherwise
- 2xx → `/owners/{ownerId}`

---

## Implementation Phases

### Phase 1: Store and service - COMPLETED

**Objective**: Persist pets and types; look up a pet by id and a type by name.

**Deliverables**: `pets` / `types` tables, `Pet` / `PetType` / `NamedEntity`, repositories, `ClinicService` pet and pet-type methods.

### Phase 2: REST API - COMPLETED

**Objective**: Nested owner-pet routes plus standalone pet and pet-type CRUD.

**Deliverables**: `openapi.yml` pet / pettypes / owners-pets paths, generated APIs/DTOs, `OwnerRestController` nested methods, `PetRestController`, `PetTypeRestController`, `PetMapper`. Nested GET compares owner ids; nested PUT is implemented (204).

### Phase 3: React add / edit pet - COMPLETED

**Objective**: Add and edit a pet from owner details against the nested API.

**Deliverables**: routes in `configureRoutes.tsx`; `NewPetPage`, `EditPetPage`, `PetEditor`, `createPetEditorModel`; body uses `type` object; 2xx handling.

---

## Technical Implementation Details

### Database layer

- Schema: `src/main/resources/db/hsqldb/initDB.sql` (`types`, `pets`)
- Seed: `src/main/resources/db/hsqldb/populateDB.sql`
- Entities: `model/Pet.java`, `model/PetType.java` (extends `NamedEntity`)
- Access: `repository/PetRepository.java`, `repository/PetTypeRepository.java`; default Spring Data implementations

### Service layer

- `service/ClinicService.java` / `ClinicServiceImpl.java` — pet and pet-type methods listed above

### API routes

- `rest/controller/OwnerRestController.java` — `addPetToOwner`, `getOwnersPet`, `updateOwnersPet`
- `rest/controller/PetRestController.java` — standalone `/pets`
- `rest/controller/PetTypeRestController.java` — `/pettypes`
- `mapper/PetMapper.java` — `owner.id` → `ownerId` on `PetDto`
- Contract: `src/main/resources/openapi.yml` `/owners/{ownerId}/pets`, `/pets`, `/pettypes`

### Frontend pieces

- `client/src/configureRoutes.tsx` — `/owners/:ownerId/pets/new`, `/owners/:ownerId/pets/:petId/edit`
- `client/src/components/owners/OwnerInformation.tsx` — Add New Pet
- `client/src/components/owners/PetsTable.tsx` — display + Edit Pet link
- `client/src/components/pets/NewPetPage.tsx`, `EditPetPage.tsx`, `PetEditor.tsx`, `createPetEditorModel.ts`
- `client/src/components/form/DateInput.tsx`, `SelectInput.tsx`
- `client/src/types/index.ts` — `IPet`, `IEditablePet`, `IPetRequest`, `IPetType`

### Important Notes

- Nested create looks up type by **name**. A type id without a matching name becomes `null` and can fail persistence.
- Nested GET/PUT 400 means “this pet is not that owner’s,” not a validation error on the form fields.
- Form state uses `typeId`; the JSON body uses `type: { id, name }`.
- `POST /api/pets` does not set `owner_id`. Do not point the UI at it.
- OpenAPI PUT `/pets/{id}` is 200; Java returns 204. Nested PUT is documented as 204 and matches.

---

## Acceptance Criteria

- [x] `GET /api/pettypes` returns the six seeded types
- [x] `GET /api/owners/1/pets/1` returns Leo (cat) for George Franklin
- [x] `GET /api/owners/1/pets/2` returns 400 (Basil belongs to owner 2)
- [x] Add Pet from owner 1 `POST` returns 201 and the UI returns to `/owners/1`
- [x] Edit Pet `PUT` returns 204 and the UI returns to owner details
- [x] Pet editor type dropdown is filled from `/api/pettypes`
- [x] Request body includes `type` object, not `typeId`
- [x] No pet-delete control in the UI
- [x] Pet API methods are annotated `@PreAuthorize("hasRole(@roles.OWNER_ADMIN)")`

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Add pet from owner details | New pet visible on `/owners/{id}` after save | Browser: Add New Pet |
| Edit pet | Name / type / birth date persist | Browser: Edit Pet then owner details |
| Type dropdown | All six seeded types | Browser: New Pet form |

---

## Dependencies

### External Dependencies

- Spring Web, Validation, Data JPA (default profile)
- Spring Security method annotations (no-op while the auth flag is false)

### Internal Dependencies

- Authentication slice — `ROLE_OWNER_ADMIN`, `ROLE_VET_ADMIN`
- Owners slice — `owner_id`, owner details chrome, nested URL prefix
- Visits slice — `Pet.visits` shown on owner details
- SQL init scripts (no migration framework)

### Configuration

- `server.port=9966`, context path `/petclinic/`
- CORS origin `http://localhost:4444`
- `petclinic.security.enable=false` by default

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Nested GET used `Owner.equals` across sessions and returned 400 for a valid pet.
- **Mitigation**: Compare `owner.getId()`. Do not revert to `equals` on managed vs detached owners.

- **Risk**: Client sending `typeId` instead of `type` fails Bean Validation / mapping.
- **Mitigation**: Keep `PetEditor` mapping from the selected dropdown option to `{ id, name }`.

- **Risk**: Empty type catalog returns 404; `createPetEditorModel` calls `response.json()` and breaks the form.
- **Mitigation**: Seed always has six types. If types can be empty, treat 404 like the owner list.

### User Experience Risks

- **Risk**: No pet list, so a pet without a known owner id is unreachable in the UI.
- **Mitigation**: Expected. Always start from Find Owners.

---

## Future Enhancements

Not committed to any phase. Moving an item into a phase makes it committed work.

- **Delete a pet from the web app** - A delete control with a confirm dialog, a `DELETE` call, and `DELETE` added to the CORS list. Today deleting is only possible with a script.
- **Pet list and search** - A page that lists or searches pets across owners, for when a clerk knows the animal but not the owner.
- **Pet type management screens** - Add, rename, and remove pet types from the web app instead of editing the database or calling the API by hand.
- **Move a pet to another owner** - Change a pet's owner, for example when an animal is rehomed, without deleting and re-adding it.
- **Resolve the type by id** - Look up the pet type by its id instead of its name, so a renamed type cannot leave a pet with no type.
- **Clear error for an unknown type** - Reject a pet with an unknown type with a readable message instead of failing during save.
- **Handle an empty type list** - Treat a 404 from `GET /api/pettypes` as an empty list so the pet form still opens.
- **Fix or remove `POST /api/pets`** - The standalone create does not set an owner. Either require an owner or remove the endpoint so nobody relies on it.
- **Align the OpenAPI contract** - Document `PUT /pets/{id}` as 204, or return 200 with a body, so the contract and the code agree.

---

## Troubleshooting Guide

### Add Pet fails after choosing a type

**Problem**: Save returns 4xx or the pet is stored with a null type.
**Cause**: Body sent `typeId` (a number) instead of `type: { id, name }`. Nested create resolves type by name.
**Solution**: Map the selected `ISelectOption` to `{ id, name }` before `submitForm`.
**Code Reference**: `client/src/components/pets/PetEditor.tsx`

### Edit Pet GET returns 400

**Problem**: Form never loads for a pet that exists.
**Cause**: Owner id in the URL does not match `pet.owner.id`, or older code compared `Owner.equals` across transactions.
**Solution**: Use the owner id from the details page; server compares ids.
**Code Reference**: `src/main/java/.../rest/controller/OwnerRestController.java` (`getOwnersPet`)

### Edit Pet PUT looks like it failed (501 or stuck on the form)

**Problem**: Save does not navigate back.
**Cause**: Nested PUT was unimplemented (501), or the client only treated 200/201 as success while PUT returns 204.
**Solution**: `updateOwnersPet` returns 204; client treats 200–299 as success.
**Code Reference**: `OwnerRestController.updateOwnersPet`, `client/src/components/pets/PetEditor.tsx`

### Type dropdown empty

**Problem**: Type select has no options.
**Cause**: `GET /api/pettypes` failed or returned 404.
**Solution**: Confirm types seed in `populateDB.sql` and that `url('/api/pettypes')` hits `/petclinic/api/pettypes`.
**Code Reference**: `client/src/components/pets/createPetEditorModel.ts`

---

## Notes for AI Agents

1. Pets nest under owners in the UI. Do not add a top-level pet search without a new phase. Future Enhancements are ideas, not tasks.
2. Nested create/update resolve `PetType` by **name**. Keep the body `type.name` aligned with the catalog.
3. Nested GET/PUT must compare owner **ids**.
4. Do not point the editor at `POST /api/pets`; that path does not set `owner_id`.
5. Visit create links on `PetsTable` belong to the visits PRD.
6. Cite code as `filepath:line-number`.

---

## Current Status

**Last Updated**: 5 November 2026
**Current Phase**: Phases 1–3 complete; pet list, delete, and type admin listed under Future Enhancements
**Status**: BASELINE DOCUMENTED
**Runtime**: Add / edit pet work against nested `/api/owners/{id}/pets` from `http://localhost:4444`
**Next Steps**: Baseline PRDs for authentication, owners, pets, vets, and visits are in `docs/baseline/`
