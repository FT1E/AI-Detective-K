-- AI Detective K — Initial Schema

CREATE TABLE IF NOT EXISTS cases (
    case_id             VARCHAR(32)  PRIMARY KEY,
    case_number         VARCHAR(50),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    started_at          TIMESTAMP,
    ended_at            TIMESTAMP,
    investigator        VARCHAR(255) NOT NULL,
    location            VARCHAR(255),
    threat_level        VARCHAR(20),
    status              VARCHAR(20)  NOT NULL DEFAULT 'pending',
    sealed              BOOLEAN      NOT NULL DEFAULT FALSE,
    blockchain_case_tx_id VARCHAR(66)
);

CREATE TABLE IF NOT EXISTS events (
    id          SERIAL       PRIMARY KEY,
    case_id     VARCHAR(32)  NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    event_type  VARCHAR(50)  NOT NULL,
    severity    VARCHAR(20)  NOT NULL,
    summary     TEXT         NOT NULL,
    detail      TEXT,
    timestamp   TIMESTAMP    NOT NULL,
    sensors     JSONB,
    subject_id  VARCHAR(10),
    zone        VARCHAR(50),
    confidence  FLOAT,
    approved    BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS reports (
    report_id               SERIAL       PRIMARY KEY,
    case_id                 VARCHAR(32)  NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
    generated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    threat_assessment       JSONB,
    narrative               TEXT,
    key_findings            JSONB,
    subject_profiles        JSONB,
    evidence_chain          JSONB,
    recommendation          TEXT,
    blockchain_report_hash  VARCHAR(66),
    blockchain_report_tx_id VARCHAR(66)
);

CREATE TABLE IF NOT EXISTS blockchain_records (
    id          SERIAL       PRIMARY KEY,
    record_type VARCHAR(50)  NOT NULL,
    related_id  VARCHAR(66)  NOT NULL,
    tx_hash     VARCHAR(66)  NOT NULL,
    block_number INTEGER,
    timestamp   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    metadata    JSONB
);

CREATE INDEX IF NOT EXISTS idx_events_case_id            ON events(case_id);
CREATE INDEX IF NOT EXISTS idx_reports_case_id           ON reports(case_id);
CREATE INDEX IF NOT EXISTS idx_blockchain_records_related ON blockchain_records(related_id);
