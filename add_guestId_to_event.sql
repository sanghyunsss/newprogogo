ALTER TABLE Event ADD COLUMN guestId INTEGER;
CREATE INDEX IF NOT EXISTS idx_event_guestId ON Event(guestId);
CREATE INDEX IF NOT EXISTS idx_event_dateKey ON Event(dateKey);
