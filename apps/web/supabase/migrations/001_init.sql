-- Phase 3: Initial Database Schema for ESP32 Weather Node

-- 1. Devices Table
create table if not exists public.devices (
  device_id text primary key,
  name text not null default 'New Device',
  location text null,
  created_at timestamptz default now(),
  is_active boolean default true,
  last_seen_at timestamptz null
);

-- 2. Readings Table (Time-Series)
create table if not exists public.readings (
  id bigserial primary key,
  device_id text references public.devices(device_id) on delete cascade,
  created_at timestamptz default now(), -- Server receive time
  device_ts_ms bigint null,             -- Millis since boot
  fw text null,
  uptime_s bigint null,
  rssi int null,
  status text not null default 'OK',
  temp_c real null,
  hum_pct real null,
  temp_avg real null,
  hum_avg real null,
  fail_pct real null,
  health int null,
  raw_json jsonb null,

  constraint check_hum_pct check (hum_pct between 0 and 100),
  constraint check_health check (health between 0 and 100)
);

-- 3. Alert Rules Table
create table if not exists public.alert_rules (
  id bigserial primary key,
  device_id text references public.devices(device_id) on delete cascade,
  type text not null, -- TEMP_HIGH, HUM_HIGH, OFFLINE, SPIKE
  threshold real null,
  window_s int null,
  cooldown_s int not null default 600,
  enabled boolean not null default true,
  created_at timestamptz default now(),
  
  constraint alert_rules_unique unique (device_id, type)
);

-- 4. Alerts History Table
create table if not exists public.alerts (
  id bigserial primary key,
  device_id text references public.devices(device_id) on delete cascade,
  type text not null,
  severity text not null default 'INFO', -- INFO, WARN, CRIT
  message text not null,
  triggered_at timestamptz default now(),
  resolved_at timestamptz null,
  reading_id bigint null references public.readings(id) on delete set null,
  meta jsonb null
);

-- 5. Subscribers Table
create table if not exists public.subscribers (
  id bigserial primary key,
  email text not null,
  device_id text references public.devices(device_id) on delete cascade,
  verified boolean default false,
  verify_token text null,
  created_at timestamptz default now(),
  
  constraint subscribers_unique unique (email, device_id)
);

-- --- Indexes ---
create index if not exists idx_readings_device_time on public.readings(device_id, created_at desc);
create index if not exists idx_readings_time on public.readings(created_at desc); -- For global latest
create index if not exists idx_alerts_device_time on public.alerts(device_id, triggered_at desc);
create index if not exists idx_subscribers_device on public.subscribers(device_id);

-- --- RLS (Row Level Security) ---

-- Enable RLS on all tables
alter table public.devices enable row level security;
alter table public.readings enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alerts enable row level security;
alter table public.subscribers enable row level security;

-- Public Dashboard Policies (Read-Only)

-- View for Safe Reading Access (Public)
-- Only exposes data for active devices, and hides raw_json or system fields if deemed sensitive (though mostly fine here)
create or replace view public.public_readings as
select 
  r.id, r.device_id, r.created_at, r.temp_c, r.hum_pct, r.status, r.health, r.rssi
from public.readings r
join public.devices d on r.device_id = d.device_id
where d.is_active = true;

-- Grant access to the view for everyone (anon)
grant select on public.public_readings to anon, authenticated;

-- Allow SELECT on devices (for dashboard metadata)
create policy "Public devices are viewable" on public.devices
  for select to anon, authenticated
  using (true);

-- Allow SELECT on alerts (optional, for public dashboard history)
create policy "Public alerts are viewable" on public.alerts
  for select to anon, authenticated
  using (true);

-- Service Role (Backend) can do everything
-- Note: Service role bypasses RLS by default, but explicit policies can document intent.
-- We usually don't need policies for service_role if it bypasses, but good to be clear no one else can write.

-- Deny all modifications from anon/authenticated (implicit by default RLS, but for clarity)
-- No INSERT/UPDATE/DELETE policies created for anon -> forbidden.

-- --- Initial Data ---
insert into public.devices (device_id, name, is_active)
values ('esp32-lab-01', 'Lab Sensor', true)
on conflict (device_id) do nothing;
