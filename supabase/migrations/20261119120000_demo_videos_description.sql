-- An optional description for a demo, entered with its title when it's
-- created (Create Version → Upload Media / Add Link). Like the title it's
-- the demo's own, so it's copied onto every row that shares the demo's
-- content (attaching an existing demo to another ticket — see
-- createDemoVideo.ts / updateDemoVideo.ts).
alter table portal.demo_videos
  add column if not exists description text;
