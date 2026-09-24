-- Client Project Tracker: standalone migration and demo-user setup.
-- PostgreSQL 17 (the Docker image used by this project).
-- Run the ENTIRE file against the target database, e.g. client_project_tracker.
-- Works in PostgreSQL SQL clients and psql; contains no client-specific commands.
-- Creates tables in public. Does not create/switch databases, drop data, or reset passwords.
-- Original numbered migrations remain in sql/ as development history.
BEGIN;
SET LOCAL search_path TO public;
SELECT pg_advisory_xact_lock(73218401);
CREATE TABLE IF NOT EXISTS schema_migrations (
    name text PRIMARY KEY,
    checksum text NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT now()
);

-- Migration: 001_initial_schema.sql
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE name = '001_initial_schema.sql') THEN
        IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '001_initial_schema.sql' AND checksum = 'f7381ad965305e9deba0e0920ce45923ae59193018229816224fa664d0c84bb4') THEN
            RAISE EXCEPTION 'Migration history mismatch: 001_initial_schema.sql. Restore the original migration; do not delete history.';
        END IF;
    ELSE
        -- Run with npm run migrate. The runner supplies the transaction and migration history.
        -- Calendar dates are date-only; audit timestamps represent instants.
        CREATE TABLE users (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
            username text NOT NULL CHECK (length(btrim(username)) BETWEEN 1 AND 100 AND username = btrim(username)),
            password_hash text NOT NULL CHECK (length(password_hash) > 0),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        
        CREATE UNIQUE INDEX users_username_unique ON users (lower(username));
        
        CREATE TABLE projects (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 200),
            client_name text NOT NULL CHECK (length(btrim(client_name)) BETWEEN 1 AND 200),
            status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed')),
            start_date date NOT NULL,
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now()
        );
        
        CREATE TABLE project_members (
            project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            PRIMARY KEY (project_id, user_id)
        );
        
        CREATE INDEX project_members_user_id_idx ON project_members (user_id);
        
        CREATE TABLE tasks (
            id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
            title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 200),
            project_id integer NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
            status text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'completed')),
            assignee_id integer,
            due_date date,
            version integer NOT NULL DEFAULT 1 CHECK (version > 0),
            created_at timestamptz NOT NULL DEFAULT now(),
            updated_at timestamptz NOT NULL DEFAULT now(),
            -- An assignee must belong to this project. NULL permits unassigned tasks.
            -- Unassign/reassign tasks before removing their assignee's membership.
            CONSTRAINT tasks_assignee_membership_fk FOREIGN KEY (project_id, assignee_id)
                REFERENCES project_members (project_id, user_id) ON DELETE NO ACTION
        );
        
        CREATE INDEX tasks_project_id_assignee_id_idx ON tasks (project_id, assignee_id);
        
        -- updated_at is maintained for SQL clients as well as application writes.
        CREATE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            NEW.updated_at = clock_timestamp();
            RETURN NEW;
        END;
        $$;
        
        CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        CREATE TRIGGER projects_updated_at BEFORE UPDATE ON projects
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        CREATE TRIGGER tasks_updated_at BEFORE UPDATE ON tasks
            FOR EACH ROW EXECUTE FUNCTION set_updated_at();
        
        -- version is reserved for conditional API updates in the concurrency stage.
        INSERT INTO schema_migrations (name, checksum) VALUES ('001_initial_schema.sql', 'f7381ad965305e9deba0e0920ce45923ae59193018229816224fa664d0c84bb4');
    END IF;
END;
$migration$;

-- Migration: 002_access_control.sql
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE name = '002_access_control.sql') THEN
        IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '002_access_control.sql' AND checksum = '80d6c37734cdda51c44b31c3011eda6fe7978c1a96600ef5659127ac86439e25') THEN
            RAISE EXCEPTION 'Migration history mismatch: 002_access_control.sql. Restore the original migration; do not delete history.';
        END IF;
    ELSE
        ALTER TABLE users ADD COLUMN role text NOT NULL DEFAULT 'user'
            CHECK (role IN ('admin', 'user'));
        
        -- Historical ownership is unknown; assign it explicitly outside this migration.
        ALTER TABLE projects ADD COLUMN created_by integer REFERENCES users(id) ON DELETE RESTRICT;
        CREATE INDEX projects_created_by_idx ON projects(created_by);
        INSERT INTO schema_migrations (name, checksum) VALUES ('002_access_control.sql', '80d6c37734cdda51c44b31c3011eda6fe7978c1a96600ef5659127ac86439e25');
    END IF;
END;
$migration$;

-- Migration: 003_optimistic_versioning.sql
DO $migration$
BEGIN
    IF EXISTS (SELECT 1 FROM schema_migrations WHERE name = '003_optimistic_versioning.sql') THEN
        IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE name = '003_optimistic_versioning.sql' AND checksum = 'a6d93ea74458b8ae652eadbbb79bf8a93521a2893b8118901d09de5e4454e21f') THEN
            RAISE EXCEPTION 'Migration history mismatch: 003_optimistic_versioning.sql. Restore the original migration; do not delete history.';
        END IF;
    ELSE
        -- Existing records begin at version 1; no project/task content is replaced.
        ALTER TABLE projects ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
        
        -- Keep versions reliable for API updates and direct edits through DBeaver.
        CREATE FUNCTION increment_record_version() RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            NEW.version = OLD.version + 1;
            RETURN NEW;
        END;
        $$;
        
        CREATE TRIGGER projects_version BEFORE UPDATE ON projects
            FOR EACH ROW EXECUTE FUNCTION increment_record_version();
        CREATE TRIGGER tasks_version BEFORE UPDATE ON tasks
            FOR EACH ROW EXECUTE FUNCTION increment_record_version();
        INSERT INTO schema_migrations (name, checksum) VALUES ('003_optimistic_versioning.sql', 'a6d93ea74458b8ae652eadbbb79bf8a93521a2893b8118901d09de5e4454e21f');
    END IF;
END;
$migration$;

-- Demo login accounts only. Password matches username; stored as salted scrypt hashes.
-- Existing accounts are preserved, including changed passwords, names and roles.
INSERT INTO users (name, username, password_hash, role) VALUES
    ('Admin', 'admin', 'scrypt$v1$131072$8$1$57155b3e97f027a2511fca3ce32754fb$d6b8295199efcf0d1c7f9d1d9a3cd0b0855c43b78f29c8430dc55c7d36b798cf82bed9d9ec44702b2877e5f0531f0d026e50d91b4db5b55d79e6e655c89df816', 'admin'),
    ('user1', 'user1', 'scrypt$v1$131072$8$1$fbb09ff16602df5014c6eae7992a0f26$e244b78437460f09e6818da98c22986f6dd2c09866204516fb8196519a926814ca6758a54091f9caabebcb82e359ad15a68a970a8fbc795c69caa54624df78ed', 'user'),
    ('user2', 'user2', 'scrypt$v1$131072$8$1$a28337948a916d5361da47e7c4f45518$2d4d437bd8a405ecf3f5892f906a563aaf4656c099df702ddf67600278607759e03955e3bf91e3aa8399fddf58e9f6248e2eb7081edc833d3cd932ec3b0a8398', 'user'),
    ('user3', 'user3', 'scrypt$v1$131072$8$1$4329b71fbe8e00364f84f886467f62b1$5b061586bcba91a73f8d410731cad8ebbf0c0980ddbfb83609e71cbea05f4ed7a582e9525a75788328f5b915087c1890fb2d1d5938f45562e76b4cdd9407098d', 'user')
ON CONFLICT (lower(username)) DO NOTHING;

-- Projects, tasks and project_members intentionally have no seed rows.
COMMIT;
