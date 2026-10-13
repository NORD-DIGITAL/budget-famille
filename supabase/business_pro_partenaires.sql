-- Business Pro (v3.8.1) : les deux partenaires se voient dans la section Business Pro, et seulement là.
-- Renvoie les comptes partenaires (nom, e-mail, téléphone) uniquement à un partenaire. À exécuter après business_pro.sql.

create or replace function public.bp_partners()
returns table(user_id uuid, email text, label text, full_name text, phone text, has_account boolean)
language sql stable security definer set search_path = public as $$
  select u.id, p.email, p.label,
         coalesce(nullif(trim(pr.full_name), ''), u.raw_user_meta_data ->> 'full_name'),
         u.raw_user_meta_data ->> 'phone_local',
         u.id is not null
  from app_partners p
  left join auth.users u on lower(u.email) = p.email
  left join profiles pr on pr.id = u.id
  where public.is_partner()
  order by p.created_at, p.email;
$$;
revoke all on function public.bp_partners() from public, anon;
grant execute on function public.bp_partners() to authenticated;
