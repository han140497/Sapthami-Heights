-- Issue upvotes: "I'm facing this too."
--
-- Votes are per FLAT, not per person — one flat, one vote — so the count answers the
-- question the committee actually cares about: how many homes are affected. The flat
-- comes from the resident's signed cookie server-side, never from the request, so a
-- flat can only ever cast or clear its own vote.

create table issue_votes (
  id         uuid primary key default gen_random_uuid(),
  issue_id   uuid not null references issues(id) on delete cascade,
  flat_id    uuid not null references flats(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (issue_id, flat_id)
);

create index issue_votes_issue_idx on issue_votes (issue_id);
create index issue_votes_flat_idx on issue_votes (flat_id);

-- Deny-all RLS, like every table here: the server is the access boundary.
alter table issue_votes enable row level security;
alter table issue_votes force row level security;

-- Vote tally per issue, for list and detail screens.
create view issue_vote_counts as
select issue_id, count(*)::int as vote_count
from issue_votes
group by issue_id;

alter view issue_vote_counts set (security_invoker = on);
