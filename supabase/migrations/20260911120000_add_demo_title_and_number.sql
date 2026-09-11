-- Gives every demo_videos row a proper identity of its own: a user-entered
-- `title` and an auto-generated, human-friendly `demo_number` (displayed as
-- "demo-<n>"). Several rows can already share the same underlying content
-- (same storage_path/embed_url) when one uploaded video is attached to
-- multiple tickets — those rows are meant to be treated as "the same demo"
-- everywhere it's shown (Demos dashboard, "Select Existing" picker), so
-- title/demo_number are propagated onto every row sharing that content
-- (see createDemoVideo.ts/updateDemoVideo.ts), not left to diverge per row.
alter table portal.demo_videos
  add column if not exists title text,
  add column if not exists demo_number bigint;

create sequence if not exists portal.demo_videos_demo_number_seq;

-- Backfill: one shared demo_number (and a fallback title) per distinct
-- existing content group, assigned in creation order, so a demo already
-- attached to multiple tickets before this migration doesn't fragment into
-- several different-looking "demos" afterward.
do $$
declare
  r record;
  n bigint;
begin
  for r in
    select coalesce(storage_path, embed_url) as content_key,
           min(created_at) as first_created_at
    from portal.demo_videos
    where demo_number is null
    group by coalesce(storage_path, embed_url)
    order by min(created_at) asc
  loop
    n := nextval('portal.demo_videos_demo_number_seq');
    update portal.demo_videos
    set demo_number = n
    where coalesce(storage_path, embed_url) = r.content_key
      and demo_number is null;
  end loop;
end $$;

update portal.demo_videos
set title = coalesce(
  nullif(trim(title), ''),
  file_name,
  case when embed_provider is not null then initcap(embed_provider) || ' link' end,
  'Untitled demo'
)
where title is null or trim(title) = '';

alter table portal.demo_videos
  alter column demo_number set default nextval('portal.demo_videos_demo_number_seq'),
  alter column demo_number set not null,
  alter column title set not null;
