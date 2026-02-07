CREATE TABLE allocation_sequences (
  name VARCHAR(50) PRIMARY KEY,
  current_value BIGINT NOT NULL
);

INSERT INTO allocation_sequences (name, current_value)
VALUES ('ALLOC', 0);
