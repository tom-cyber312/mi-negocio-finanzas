-- Sincronización entre dispositivos (Supabase)
-- Ejecutar en: Supabase Dashboard > SQL Editor > New query > Run

-- Cuentas (negocios) de un usuario de Supabase Auth
create table if not exists public.cuentas (
  id text primary key,          -- "default" o el id del negocio
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null default 'Mi negocio',
  email text not null,
  created_at timestamptz not null default now(),
  unique (usuario_id, email)
);

-- Registros sincronizados: una fila por registro local (payload JSONB).
-- `deleted` es una tumba para propagar eliminaciones entre dispositivos.
create table if not exists public.registros (
  id bigint generated always as identity primary key,
  cuenta_id text not null references public.cuentas(id) on delete cascade,
  tabla text not null,          -- productos | ventas | gastos | presupuestos | facturas | inflacion
  registro_id text not null,    -- uid local del registro
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  deleted boolean not null default false,
  unique (cuenta_id, tabla, registro_id)
);

create index if not exists registros_cuenta_idx
  on public.registros (cuenta_id, tabla, updated_at);

-- Helper de pertenencia para las políticas (RLS)
create or replace function public.pertenece(mi_cuenta text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.cuentas c
    where c.id = mi_cuenta and c.usuario_id = auth.uid()
  );
$$;

alter table public.cuentas enable row level security;
alter table public.registros enable row level security;

drop policy if exists "cuentas_select" on public.cuentas;
create policy "cuentas_select" on public.cuentas
  for select using (auth.uid() = usuario_id);

drop policy if exists "cuentas_insert" on public.cuentas;
create policy "cuentas_insert" on public.cuentas
  for insert with check (auth.uid() = usuario_id);

drop policy if exists "cuentas_delete" on public.cuentas;
create policy "cuentas_delete" on public.cuentas
  for delete using (auth.uid() = usuario_id);

drop policy if exists "cuentas_update" on public.cuentas;
create policy "cuentas_update" on public.cuentas
  for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists "registros_select" on public.registros;
create policy "registros_select" on public.registros
  for select using (public.pertenece(cuenta_id));

drop policy if exists "registros_insert" on public.registros;
create policy "registros_insert" on public.registros
  for insert with check (public.pertenece(cuenta_id));

drop policy if exists "registros_update" on public.registros;
create policy "registros_update" on public.registros
  for update using (public.pertenece(cuenta_id)) with check (public.pertenece(cuenta_id));

drop policy if exists "registros_delete" on public.registros;
create policy "registros_delete" on public.registros
  for delete using (public.pertenece(cuenta_id));