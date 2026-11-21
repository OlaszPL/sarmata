-- Evaluations join the access model. Separate migration: a new enum value
-- cannot be used in the transaction that adds it.
alter type access.resource add value 'evaluation';
alter type access.resource add value 'evaluation_sheet';
alter type access.resource add value 'evaluation_event';
alter type access.resource add value 'evaluation_deadline';
