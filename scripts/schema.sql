-- NYT Best Sellers Database Schema

-- Lists metadata (all available bestseller lists)
CREATE TABLE IF NOT EXISTS lists (
  list_id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_name_encoded TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  list_name TEXT,
  oldest_published_date TEXT,
  newest_published_date TEXT,
  updated TEXT
);

-- Books (deduplicated by ISBN)
CREATE TABLE IF NOT EXISTS books (
  book_id INTEGER PRIMARY KEY AUTOINCREMENT,
  primary_isbn13 TEXT,
  primary_isbn10 TEXT,
  title TEXT NOT NULL,
  author TEXT,
  publisher TEXT,
  description TEXT,
  price TEXT,
  book_image TEXT,
  book_image_width INTEGER,
  book_image_height INTEGER,
  amazon_product_url TEXT,
  book_review_link TEXT,
  created_date TEXT,
  updated_date TEXT
);

-- ISBNs (books can have multiple ISBNs)
CREATE TABLE IF NOT EXISTS isbns (
  isbn_id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  isbn13 TEXT,
  isbn10 TEXT,
  FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);

-- Rankings (historical positions on lists)
CREATE TABLE IF NOT EXISTS rankings (
  ranking_id INTEGER PRIMARY KEY AUTOINCREMENT,
  list_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  published_date TEXT NOT NULL,
  bestsellers_date TEXT,
  rank INTEGER NOT NULL,
  rank_last_week INTEGER,
  weeks_on_list INTEGER,
  asterisk INTEGER DEFAULT 0,
  dagger INTEGER DEFAULT 0,
  FOREIGN KEY (list_id) REFERENCES lists(list_id) ON DELETE CASCADE,
  FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE,
  UNIQUE(list_id, book_id, published_date)
);

-- Reviews (NYT book reviews)
CREATE TABLE IF NOT EXISTS reviews (
  review_id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER,
  url TEXT,
  publication_dt TEXT,
  byline TEXT,
  book_title TEXT,
  book_author TEXT,
  summary TEXT,
  isbn13 TEXT,
  FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE SET NULL
);

-- Sync metadata (track what data we've fetched)
CREATE TABLE IF NOT EXISTS sync_log (
  sync_id INTEGER PRIMARY KEY AUTOINCREMENT,
  sync_type TEXT NOT NULL,
  list_name_encoded TEXT,
  sync_date TEXT NOT NULL,
  published_date TEXT,
  records_added INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  status TEXT,
  error_message TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_rankings_list ON rankings(list_id);
CREATE INDEX IF NOT EXISTS idx_rankings_date ON rankings(published_date);
CREATE INDEX IF NOT EXISTS idx_rankings_book ON rankings(book_id);
CREATE INDEX IF NOT EXISTS idx_rankings_list_date ON rankings(list_id, published_date);
CREATE INDEX IF NOT EXISTS idx_books_isbn13 ON books(primary_isbn13);
CREATE INDEX IF NOT EXISTS idx_books_isbn10 ON books(primary_isbn10);
CREATE INDEX IF NOT EXISTS idx_isbns_isbn13 ON isbns(isbn13);
CREATE INDEX IF NOT EXISTS idx_isbns_isbn10 ON isbns(isbn10);
CREATE INDEX IF NOT EXISTS idx_isbns_book ON isbns(book_id);
CREATE INDEX IF NOT EXISTS idx_lists_encoded ON lists(list_name_encoded);
CREATE INDEX IF NOT EXISTS idx_sync_log_type ON sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_log_date ON sync_log(sync_date);
