-- CabalScan operator fingerprint tables (run in Supabase SQL editor)

create table if not exists operator_fingerprints (
  id uuid primary key default gen_random_uuid(),
  operator_id text not null unique,
  deployer_wallet text not null unique,
  rug_count integer not null default 0,
  confidence numeric not null default 0.5 check (confidence >= 0 and confidence <= 1),
  last_seen_at timestamptz default now(),
  fingerprint_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists operator_wallets (
  operator_id text not null references operator_fingerprints(operator_id) on delete cascade,
  wallet text not null,
  hop_distance integer not null default 1,
  primary key (operator_id, wallet)
);

create index if not exists idx_operator_fingerprints_deployer
  on operator_fingerprints(deployer_wallet);

create index if not exists idx_operator_wallets_wallet
  on operator_wallets(wallet);

alter table operator_fingerprints enable row level security;
alter table operator_wallets enable row level security;

-- Service role bypasses RLS; block anon/authenticated direct access
create policy "service only fingerprints" on operator_fingerprints
  for all using (false);

create policy "service only wallets" on operator_wallets
  for all using (false);
