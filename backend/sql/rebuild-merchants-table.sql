-- Rebuild public.merchants to reclaim pg_attribute slots from dropped columns.
-- Safe when active column count is healthy but max(attnum) is near Postgres limit 1600.
-- Preserves all merchant rows and re-attaches incoming foreign keys.
--
-- Run via: bash scripts/rebuild-merchants-table.sh

\set ON_ERROR_STOP on

DO $$
DECLARE
  dropped_count bigint;
  live_count bigint;
  max_attnum integer;
  merchant_rows bigint;
BEGIN
  SELECT
    count(*) FILTER (WHERE attisdropped),
    count(*) FILTER (WHERE NOT attisdropped),
    max(attnum)
  INTO dropped_count, live_count, max_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.merchants'::regclass
    AND attnum > 0;

  SELECT count(*) INTO merchant_rows FROM public.merchants;

  RAISE NOTICE 'merchants before rebuild: rows=% live_cols=% dropped_slots=% max_attnum=%',
    merchant_rows, live_count, dropped_count, max_attnum;

  IF max_attnum IS NULL THEN
    RAISE EXCEPTION 'merchants table not found';
  END IF;

  IF max_attnum < 300 THEN
    RAISE NOTICE 'merchants pg_attribute=% — rebuild not required', max_attnum;
    RETURN;
  END IF;
END $$;

BEGIN;

CREATE TEMP TABLE merchants_fk_restore ON COMMIT DROP AS
SELECT
  c.conrelid::regclass::text AS child_table,
  c.conname,
  pg_get_constraintdef(c.oid) AS def
FROM pg_constraint c
WHERE c.confrelid = 'public.merchants'::regclass
  AND c.contype = 'f';

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass AS tbl
    FROM pg_constraint
    WHERE confrelid = 'public.merchants'::regclass
      AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

CREATE TABLE public.merchants_rebuilt (
  LIKE public.merchants INCLUDING DEFAULTS INCLUDING CONSTRAINTS INCLUDING INDEXES
);

INSERT INTO public.merchants_rebuilt
SELECT * FROM public.merchants;

DO $$
DECLARE
  old_count bigint;
  new_count bigint;
BEGIN
  SELECT count(*) INTO old_count FROM public.merchants;
  SELECT count(*) INTO new_count FROM public.merchants_rebuilt;
  IF old_count <> new_count THEN
    RAISE EXCEPTION 'row count mismatch after copy: old=% new=%', old_count, new_count;
  END IF;
END $$;

DROP TABLE public.merchants;
ALTER TABLE public.merchants_rebuilt RENAME TO merchants;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT child_table, conname, def FROM merchants_fk_restore LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.child_table, r.conname, r.def);
  END LOOP;
END $$;

COMMIT;

DO $$
DECLARE
  dropped_count bigint;
  live_count bigint;
  max_attnum integer;
  merchant_rows bigint;
  fk_count bigint;
BEGIN
  SELECT
    count(*) FILTER (WHERE attisdropped),
    count(*) FILTER (WHERE NOT attisdropped),
    max(attnum)
  INTO dropped_count, live_count, max_attnum
  FROM pg_attribute
  WHERE attrelid = 'public.merchants'::regclass
    AND attnum > 0;

  SELECT count(*) INTO merchant_rows FROM public.merchants;
  SELECT count(*) INTO fk_count
  FROM pg_constraint
  WHERE confrelid = 'public.merchants'::regclass
    AND contype = 'f';

  RAISE NOTICE 'merchants after rebuild: rows=% live_cols=% dropped_slots=% max_attnum=% incoming_fks=%',
    merchant_rows, live_count, dropped_count, max_attnum, fk_count;
END $$;
