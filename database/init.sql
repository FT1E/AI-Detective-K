-- AI Detective K — Database Initialization
-- Creates the database on first container start.
-- Schema tables are managed by Alembic migrations.

CREATE DATABASE detective;

-- Connect to the newly created database
\c detective;

-- Grant privileges to the detective user
GRANT ALL PRIVILEGES ON DATABASE detective TO detective;
GRANT ALL PRIVILEGES ON SCHEMA public TO detective;
