-- 1) Teachers table
CREATE TABLE IF NOT EXISTS Teachers (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT    NOT NULL,
  location TEXT
);

-- 2) Teacher unavailability
CREATE TABLE IF NOT EXISTS TeacherUnavailability (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id   INTEGER NOT NULL REFERENCES Teachers(id),
  day_of_week  INTEGER NOT NULL,            -- 1=Mon … 5=Fri
  start_time   TEXT    NOT NULL,            -- "HH:MM"
  end_time     TEXT    NOT NULL             -- "HH:MM"
);

-- 3) Bookings
CREATE TABLE IF NOT EXISTS Bookings (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id       INTEGER NOT NULL REFERENCES Teachers(id),
  booking_date     TEXT    NOT NULL,        -- "YYYY-MM-DD"
  start_time       TEXT    NOT NULL,        -- "HH:MM"
  end_time         TEXT    NOT NULL,        -- "HH:MM"
  parent_name      TEXT    NOT NULL,
  parent_email     TEXT    NOT NULL,
  student_name     TEXT    NOT NULL,
  school_name      TEXT    NOT NULL,
  booking_type     TEXT    NOT NULL,        -- 'zoom' or 'inperson'
  booking_location TEXT
);

-- 4) Prevent duplicate bookings
DELETE FROM Bookings
WHERE rowid NOT IN (
  SELECT MIN(rowid)
  FROM Bookings
  GROUP BY teacher_id, booking_date, start_time, end_time
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_unique
  ON Bookings (teacher_id, booking_date, start_time, end_time);

-- 5) Preferences (single-row config)
CREATE TABLE IF NOT EXISTS Preferences (
  id                   INTEGER PRIMARY KEY,
  staff_classification TEXT    NOT NULL DEFAULT 'Teacher',
  primary_color        TEXT    NOT NULL DEFAULT '#00625f',
  secondary_color      TEXT    NOT NULL DEFAULT '#6bbaae',
  page_heading         TEXT    NOT NULL DEFAULT 'Book a Teacher',
  zoom_duration        INTEGER NOT NULL DEFAULT 30,    -- mins
  inperson_duration    INTEGER NOT NULL DEFAULT 240,   -- mins
  show_zoom            INTEGER NOT NULL DEFAULT 1,     -- 1=show,0=hide
  show_inperson        INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO Preferences(
  id, staff_classification, primary_color, secondary_color,
  page_heading, zoom_duration, inperson_duration,
  show_zoom, show_inperson
) VALUES (
  1, 'Teacher', '#00625f', '#6bbaae',
  'Book a Teacher', 30, 240,
  1, 1
);

-- 6) Seed some demo teachers
INSERT OR IGNORE INTO Teachers (name, location) VALUES
  ('Alice Smith', 'Sumner'),
  ('Bob Jones',   'Kelston'),
  ('Carol Lee',   'Wanaka');



In Cloudflare dashboard, go to Workers > your Worker.
Under Settings > Bindings > Add > D1 Database
Variable Name: DB, D1 database: boookings
Save