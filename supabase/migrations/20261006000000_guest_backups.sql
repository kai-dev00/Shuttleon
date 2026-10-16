-- Guest backups: lets someone without an account save a snapshot of their data under a secret
-- code and restore it later on any device.
--
-- Security model
--   * The code is the only secret. It is generated on the device (80 random bits) and never stored:
--     only its SHA-256 hash is, so a database leak does not reveal usable codes.
--   * The table has Row Level Security on and NO policies, and direct access is revoked, so clients
--     cannot read or list backups. They can only call the two functions below, which need the exact code.
--   * Size is capped so the table cannot be filled with huge payloads.

create table public.guest_backups (
  code_hash text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.guest_backups enable row level security;

revoke all on table public.guest_backups from anon, authenticated;

-- Create or replace the backup stored under a code.
create or replace function public.save_guest_backup(p_code text, p_payload jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_code is null or length(p_code) < 16 then
    raise exception 'invalid backup code';
  end if;

  if pg_column_size(p_payload) > 5 * 1024 * 1024 then
    raise exception 'backup too large';
  end if;

  insert into public.guest_backups (code_hash, payload)
  values (encode(sha256(convert_to(p_code, 'UTF8')), 'hex'), p_payload)
  on conflict (code_hash)
  do update set payload = excluded.payload, updated_at = now();
end;
$$;

-- Return the backup stored under a code, or null if there is none.
create or replace function public.load_guest_backup(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select payload
  from public.guest_backups
  where code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
$$;

-- Remove the backup stored under a code (for example once its owner has made an account).
create or replace function public.delete_guest_backup(p_code text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.guest_backups
  where code_hash = encode(sha256(convert_to(p_code, 'UTF8')), 'hex');
$$;

revoke all on function public.save_guest_backup(text, jsonb) from public;
revoke all on function public.load_guest_backup(text) from public;
revoke all on function public.delete_guest_backup(text) from public;
grant execute on function public.save_guest_backup(text, jsonb) to anon, authenticated;
grant execute on function public.load_guest_backup(text) to anon, authenticated;
grant execute on function public.delete_guest_backup(text) to anon, authenticated;
