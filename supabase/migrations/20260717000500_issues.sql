-- Maintenance issues, their cost estimates, and the thread residents can follow.

create table issues (
  id                uuid primary key default gen_random_uuid(),
  reference         text not null unique,
  title             text not null check (length(trim(title)) > 0),
  description       text not null default '',
  category          text not null check (category in ('plumbing', 'electrical', 'lift', 'water', 'security', 'housekeeping', 'structural', 'common_area', 'other')),
  location          text not null check (location in ('flat', 'block', 'common')),
  block_id          uuid references blocks(id) on delete set null,
  flat_id           uuid references flats(id) on delete set null,
  -- Which flat reported it. Residents have no auth user, so attribution is by flat.
  raised_by_flat_id uuid references flats(id) on delete set null,
  raised_by_name    text,
  status            text not null default 'open' check (status in ('open', 'acknowledged', 'estimating', 'approved', 'in_progress', 'resolved', 'closed', 'rejected')),
  priority          text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  resolved_on       date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- A flat-specific issue must say which flat; a common-area one must not pretend to.
  constraint flat_issues_name_a_flat check (location <> 'flat' or flat_id is not null),
  constraint block_issues_name_a_block check (location <> 'block' or block_id is not null)
);

create index issues_status_idx on issues (status);
create index issues_flat_idx on issues (flat_id);

create table issue_estimates (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references issues(id) on delete cascade,
  vendor       text not null,
  description  text not null default '',
  amount_paise bigint not null check (amount_paise >= 0),
  status       text not null default 'proposed' check (status in ('proposed', 'approved', 'rejected')),
  decided_by   uuid references auth.users(id) on delete set null,
  decided_at   timestamptz,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index issue_estimates_issue_idx on issue_estimates (issue_id);

-- One approved quote per issue. Two approved estimates would make "what did the
-- committee sanction" unanswerable, which is precisely the question residents ask.
create unique index issue_estimates_one_approved
  on issue_estimates (issue_id)
  where status = 'approved';

create table issue_comments (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references issues(id) on delete cascade,
  author_kind  text not null check (author_kind in ('resident', 'committee')),
  author_flat_id uuid references flats(id) on delete set null,
  author_user_id uuid references auth.users(id) on delete set null,
  author_name  text not null,
  body         text not null check (length(trim(body)) > 0),
  created_at   timestamptz not null default now(),
  -- A comment must be attributable to exactly the kind of author it claims.
  constraint comment_author_matches_kind check (
    (author_kind = 'resident' and author_flat_id is not null) or
    (author_kind = 'committee' and author_user_id is not null)
  )
);

create index issue_comments_issue_idx on issue_comments (issue_id);

create table issue_photos (
  id           uuid primary key default gen_random_uuid(),
  issue_id     uuid not null references issues(id) on delete cascade,
  storage_path text not null,
  caption      text,
  uploaded_by_flat_id uuid references flats(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- Close the loop from estimate to actual spend.
alter table expenses
  add constraint expenses_issue_fk foreign key (issue_id) references issues(id) on delete set null;

create index expenses_issue_idx on expenses (issue_id) where issue_id is not null;

-- Estimated versus actual, per issue. This is the number that tells residents
-- whether the committee's quotes bear any relation to what gets spent.
create view issue_cost_summary as
select
  i.id as issue_id,
  i.reference,
  i.title,
  i.status,
  i.category,
  (select e.amount_paise from issue_estimates e where e.issue_id = i.id and e.status = 'approved') as approved_estimate_paise,
  coalesce((select sum(x.amount_paise) from expenses x where x.issue_id = i.id), 0) as actual_spent_paise,
  coalesce((select sum(x.amount_paise) from expenses x where x.issue_id = i.id), 0)
    - coalesce((select e.amount_paise from issue_estimates e where e.issue_id = i.id and e.status = 'approved'), 0)
    as overrun_paise
from issues i;

comment on view issue_cost_summary is
  'Positive overrun_paise means the work cost more than the approved quote.';

create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger issues_touch_trg before update on issues
  for each row execute function touch_updated_at();
create trigger payments_touch_trg before update on payments
  for each row execute function touch_updated_at();
create trigger water_meter_readings_touch_trg before update on water_meter_readings
  for each row execute function touch_updated_at();

-- Human-readable issue references (SH-2026-0001) so residents and the committee can
-- refer to an issue in the WhatsApp group without pasting a UUID.
create sequence issue_reference_seq;

create or replace function assign_issue_reference()
returns trigger
language plpgsql
as $$
begin
  if new.reference is null or new.reference = '' then
    new.reference := 'SH-' || to_char(now(), 'YYYY') || '-' ||
                     lpad(nextval('issue_reference_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

create trigger issues_reference_trg before insert on issues
  for each row execute function assign_issue_reference();
