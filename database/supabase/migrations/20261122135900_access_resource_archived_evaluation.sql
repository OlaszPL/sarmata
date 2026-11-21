-- Archived evaluations (oceny archiwalne) join the access model. Separate migration: a new enum value
-- cannot be used in the transaction that adds it.
alter type access.resource add value 'archived_evaluation';
