-- Reunite database schema
-- Run on a fresh database (scripts/reset-db.js drops everything first).

-- Name matching runs entirely inside our own database. No third-party AI.
create extension if not exists fuzzystrmatch;  -- dmetaphone(), levenshtein()
create extension if not exists pg_trgm;        -- similarity() for typo tolerance
create extension if not exists unaccent;       -- "José Hernández" == "Jose Hernandez"

-- ---------------------------------------------------------------------------
-- Shelters
-- ---------------------------------------------------------------------------
create table shelters (
  id          serial primary key,
  code        text not null unique,            -- short key, e.g. 'lincoln'
  name        text not null,
  address     text,
  capacity    int check (capacity is null or capacity > 0),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Staff: shelter volunteers and shelter authorities.
-- Completely separate from public users. Authorities are provisioned
-- out-of-band (assumption: by county emergency management) and are the
-- only ones who can create volunteer accounts.
-- ---------------------------------------------------------------------------
create table staff (
  id             serial primary key,
  shelter_id     int  not null references shelters(id),
  role           text not null check (role in ('volunteer', 'authority')),
  name           text not null,
  email          text not null unique,
  password_hash  text not null,
  created_by     int  references staff(id),     -- authority who added them
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Public users: people searching from their own device.
-- ---------------------------------------------------------------------------
create table public_users (
  id             serial primary key,
  name           text not null,
  contact        text not null unique,          -- email or phone number
  password_hash  text not null,
  photo_path     text,                          -- private storage path, optional
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Persons: people registered at a shelter.
-- name is a single field: whatever the person gave (alias allowed).
-- shelter_history is the chain of shelters, oldest first:
--   [{ "shelter_id": 1, "arrived_at": "...", "left_at": "..." | null, "staff_id": 3 }]
-- ---------------------------------------------------------------------------
create table persons (
  id                  serial primary key,
  name                text not null,
  age_min             int check (age_min is null or age_min between 0 and 120),
  age_max             int check (age_max is null or age_max between 0 and 120),
  home_area           text,
  description         text,
  photo_path          text,
  is_minor            boolean not null default false,
  do_not_disclose     boolean not null default false,
  reference_code      text not null unique,     -- printed on the person's slip
  current_shelter_id  int references shelters(id),
  shelter_history     jsonb not null default '[]'::jsonb
                        check (jsonb_typeof(shelter_history) = 'array'),
  status              text not null default 'sheltered'
                        check (status in ('sheltered', 'left', 'merged')),
  merged_into         int references persons(id),
  created_by          int references staff(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  check (age_min is null or age_max is null or age_min <= age_max),
  check (status <> 'merged' or merged_into is not null)
);

create index persons_current_shelter_idx on persons (current_shelter_id);
create index persons_name_trgm_idx on persons using gin (lower(name) gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- Search requests: "I'm looking for someone."
-- Filed either by a public user, or by a volunteer on behalf of a sheltered
-- person who has no phone (requester_person_id + filed_by_staff_id).
-- names lists every name the sought person might go by.
-- ---------------------------------------------------------------------------
create table search_requests (
  id                   serial primary key,
  public_user_id       int references public_users(id),
  requester_person_id  int references persons(id),
  filed_by_staff_id    int references staff(id),
  relationship         text,                    -- "wife", "son", ...
  names                text[] not null check (cardinality(names) >= 1),
  age_min              int check (age_min is null or age_min between 0 and 120),
  age_max              int check (age_max is null or age_max between 0 and 120),
  home_area            text,
  description          text,
  status               text not null default 'open'
                         check (status in ('open', 'reunited', 'closed')),
  created_at           timestamptz not null default now(),
  -- exactly one kind of requester
  check ((public_user_id is not null)::int + (requester_person_id is not null)::int = 1),
  check (requester_person_id is null or filed_by_staff_id is not null),
  check (age_min is null or age_max is null or age_min <= age_max)
);

create index search_requests_public_user_idx on search_requests (public_user_id);

-- ---------------------------------------------------------------------------
-- Matches: candidate pairings between a request and a person.
-- Flow: pending_volunteer -> pending_person -> (pending_authority if minor)
--       -> accepted | declined
-- A declined match is never revealed to the searcher; they keep seeing
-- "no confirmed match yet".
-- ---------------------------------------------------------------------------
create table matches (
  id           serial primary key,
  request_id   int not null references search_requests(id) on delete cascade,
  person_id    int not null references persons(id),
  score        numeric(5, 2) not null,
  status       text not null default 'pending_volunteer'
                 check (status in ('pending_volunteer', 'pending_person',
                                   'pending_authority', 'accepted', 'declined')),
  reviewed_by  int references staff(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (request_id, person_id)
);

create index matches_person_idx on matches (person_id);
create index matches_status_idx on matches (status);

-- ---------------------------------------------------------------------------
-- Duplicate flags: likely-same-person pairs for a volunteer to review.
-- ---------------------------------------------------------------------------
create table duplicate_flags (
  id           serial primary key,
  person_a     int not null references persons(id),
  person_b     int not null references persons(id),
  score        numeric(5, 2) not null,
  status       text not null default 'open'
                 check (status in ('open', 'merged', 'not_duplicate')),
  resolved_by  int references staff(id),
  created_at   timestamptz not null default now(),
  check (person_a < person_b),
  unique (person_a, person_b)
);

-- ---------------------------------------------------------------------------
-- Name groups: local nickname table (Bob ~ Robert ~ Bobby).
-- A name can belong to several groups ("harry" is in Harold and Henry).
-- ---------------------------------------------------------------------------
create table name_groups (
  group_id  int  not null,
  name      text not null,
  primary key (group_id, name)
);

create index name_groups_name_idx on name_groups (name);

-- ---------------------------------------------------------------------------
-- Audit log: who looked at or changed what.
-- ---------------------------------------------------------------------------
create table audit_log (
  id              bigserial primary key,
  staff_id        int references staff(id),
  public_user_id  int references public_users(id),
  action          text not null,
  target_type     text,
  target_id       int,
  detail          jsonb,
  at              timestamptz not null default now()
);

create index audit_log_at_idx on audit_log (at);

-- ---------------------------------------------------------------------------
-- Supabase exposes tables in the public schema through its auto-generated
-- REST API. Enabling row level security with no policies blocks that API
-- entirely; our backend connects as the table owner, which bypasses RLS.
-- ---------------------------------------------------------------------------
alter table shelters         enable row level security;
alter table staff            enable row level security;
alter table public_users     enable row level security;
alter table persons          enable row level security;
alter table search_requests  enable row level security;
alter table matches          enable row level security;
alter table duplicate_flags  enable row level security;
alter table name_groups      enable row level security;
alter table audit_log        enable row level security;
