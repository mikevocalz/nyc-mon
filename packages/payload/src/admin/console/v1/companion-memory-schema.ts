/** Hand-managed namespace in the SAME Neon database; Payload-generated schema diffs do not own this namespace. */
export const COMPANION_MEMORY_UP_SQL = `
CREATE SCHEMA IF NOT EXISTS nycmon_companion;
REVOKE ALL ON SCHEMA nycmon_companion FROM PUBLIC;
CREATE TABLE nycmon_companion.memories (
  caller_id integer PRIMARY KEY REFERENCES payload.users(id) ON DELETE CASCADE,
  revision integer NOT NULL CHECK (revision > 0),
  preferences jsonb,
  consented_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT companion_memory_consent CHECK (
    (preferences IS NULL AND consented_at IS NULL) OR
    (preferences IS NOT NULL AND consented_at IS NOT NULL AND jsonb_typeof(preferences) = 'object')
  ),
  CONSTRAINT companion_memory_size CHECK (preferences IS NULL OR octet_length(preferences::text) <= 8192)
);
REVOKE ALL ON nycmon_companion.memories FROM PUBLIC;
`;
/** Never silently erase approved personal data during a rollback. Export/clear explicitly before down. */
export const COMPANION_MEMORY_DOWN_SQL = `
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM nycmon_companion.memories WHERE preferences IS NOT NULL) THEN
    RAISE EXCEPTION 'Refusing to drop nonempty companion memory; export and clear it explicitly first';
  END IF;
END $$;
DROP TABLE nycmon_companion.memories;
DROP SCHEMA nycmon_companion;
`;
