CREATE TABLE allocation_sequences (
  name VARCHAR(50) PRIMARY KEY,
  current_value BIGINT NOT NULL
);

INSERT INTO allocation_sequences (name, current_value)
VALUES ('ALLOC', 0);

INSERT INTO allocation_sequences (name, current_value)
VALUES ('PICK', 0);

ALTER TABLE asns ADD COLUMN attachments JSON NULL;

ALTER TABLE grns ADD COLUMN attachments JSON NULL AFTER posted_by;
