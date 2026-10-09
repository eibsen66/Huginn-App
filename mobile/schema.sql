-- Courier local schema V1. Private files; no device state or tokens.
CREATE TABLE IF NOT EXISTS downloads(e TEXT PRIMARY KEY,s TEXT NOT NULL,metadata BLOB NOT NULL CHECK(length(metadata)=108),offset INTEGER NOT NULL DEFAULT 0 CHECK(offset>=0),state TEXT NOT NULL DEFAULT 'STAGING');
CREATE INDEX IF NOT EXISTS downloads_session ON downloads(s);
CREATE TABLE IF NOT EXISTS chunks(e TEXT NOT NULL REFERENCES downloads(e),offset INTEGER NOT NULL CHECK(offset>=0),bytes BLOB NOT NULL CHECK(length(bytes) BETWEEN 1 AND 16384),sha TEXT NOT NULL,PRIMARY KEY(e,offset));
CREATE TABLE IF NOT EXISTS flights(e TEXT PRIMARY KEY REFERENCES downloads(e),s TEXT NOT NULL,ack_status TEXT NOT NULL DEFAULT 'LOCAL');
CREATE INDEX IF NOT EXISTS flights_session ON flights(s);
CREATE TABLE IF NOT EXISTS ack_outbox(e TEXT PRIMARY KEY REFERENCES flights(e),state TEXT NOT NULL CHECK(state IN ('PENDING_SYNTHETIC','ACKED_SYNTHETIC')));
CREATE TABLE IF NOT EXISTS clients(id TEXT PRIMARY KEY,bytes BLOB NOT NULL);
PRAGMA user_version=1;

-- Slice 3G additive schema. Synthetic outbox remains separate; tokens are never here.
CREATE TABLE IF NOT EXISTS courier_pairs(ref TEXT PRIMARY KEY,device TEXT NOT NULL UNIQUE,pin TEXT NOT NULL,credential TEXT NOT NULL,repair INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS courier_remote(e TEXT PRIMARY KEY REFERENCES downloads(e),detail TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS courier_ack(e TEXT PRIMARY KEY REFERENCES flights(e),device TEXT NOT NULL,request TEXT NOT NULL,state TEXT NOT NULL CHECK(state IN ('PENDING','OUTCOME_UNKNOWN','ACKED')));
