-- Wipes all app tables. Only run through scripts/reset-db.js --yes
drop table if exists
  audit_log,
  duplicate_flags,
  matches,
  search_requests,
  persons,
  public_users,
  staff,
  name_groups,
  shelters
cascade;
