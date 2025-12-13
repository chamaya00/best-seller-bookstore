/**
 * Database Query API Endpoint
 *
 * Provides query access to the NYT Best Sellers SQLite database
 *
 * Endpoints:
 *   GET /api/db-query?action=lists
 *     - Returns all available list names
 *
 *   GET /api/db-query?action=current&list=hardcover-fiction
 *     - Returns current bestsellers for a specific list
 *
 *   GET /api/db-query?action=history&list=hardcover-fiction&date=2024-01-01
 *     - Returns bestsellers for a specific list on a specific date
 *
 *   GET /api/db-query?action=book&isbn=9781234567890
 *     - Returns book details and ranking history by ISBN
 *
 *   GET /api/db-query?action=stats
 *     - Returns database statistics
 *
 *   GET /api/db-query?action=dates&list=hardcover-fiction
 *     - Returns all available dates for a specific list
 *
 *   GET /api/db-query?action=search&q=title+or+author
 *     - Searches for books by title or author
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../data/bestsellers.db');

// CORS headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req, res) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { action, list, date, isbn, q, limit = 50 } = req.query;

  try {
    const db = new Database(DB_PATH, { readonly: true });
    let result;

    switch (action) {
      case 'lists':
        result = queryLists(db);
        break;

      case 'current':
        if (!list) {
          return res.status(400).json({ error: 'Missing required parameter: list' });
        }
        result = queryCurrent(db, list);
        break;

      case 'history':
        if (!list) {
          return res.status(400).json({ error: 'Missing required parameter: list' });
        }
        result = queryHistory(db, list, date);
        break;

      case 'book':
        if (!isbn) {
          return res.status(400).json({ error: 'Missing required parameter: isbn' });
        }
        result = queryBook(db, isbn);
        break;

      case 'stats':
        result = queryStats(db);
        break;

      case 'dates':
        if (!list) {
          return res.status(400).json({ error: 'Missing required parameter: list' });
        }
        result = queryDates(db, list);
        break;

      case 'search':
        if (!q) {
          return res.status(400).json({ error: 'Missing required parameter: q' });
        }
        result = querySearch(db, q, parseInt(limit));
        break;

      default:
        return res.status(400).json({
          error: 'Invalid action',
          validActions: ['lists', 'current', 'history', 'book', 'stats', 'dates', 'search']
        });
    }

    db.close();

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json(result);

  } catch (error) {
    console.error('Database query error:', error);
    return res.status(500).json({
      error: 'Database query failed',
      message: error.message
    });
  }
}

// Query: Get all lists
function queryLists(db) {
  const lists = db.prepare(`
    SELECT
      list_id,
      list_name_encoded,
      display_name,
      oldest_published_date,
      newest_published_date,
      updated,
      (SELECT COUNT(DISTINCT published_date) FROM rankings WHERE list_id = lists.list_id) as total_editions,
      (SELECT MAX(published_date) FROM rankings WHERE list_id = lists.list_id) as latest_edition
    FROM lists
    ORDER BY display_name
  `).all();

  return {
    count: lists.length,
    lists
  };
}

// Query: Get current bestsellers for a list
function queryCurrent(db, listNameEncoded) {
  const list = db.prepare('SELECT list_id, display_name FROM lists WHERE list_name_encoded = ?')
    .get(listNameEncoded);

  if (!list) {
    throw new Error(`List not found: ${listNameEncoded}`);
  }

  // Get the most recent published date for this list
  const latestDate = db.prepare(`
    SELECT MAX(published_date) as date
    FROM rankings
    WHERE list_id = ?
  `).get(list.list_id);

  if (!latestDate || !latestDate.date) {
    return {
      list: list.display_name,
      published_date: null,
      books: []
    };
  }

  // Get books for that date
  const books = db.prepare(`
    SELECT
      r.rank,
      r.rank_last_week,
      r.weeks_on_list,
      r.published_date,
      r.bestsellers_date,
      b.title,
      b.author,
      b.publisher,
      b.description,
      b.price,
      b.primary_isbn13,
      b.primary_isbn10,
      b.book_image,
      b.amazon_product_url
    FROM rankings r
    JOIN books b ON r.book_id = b.book_id
    WHERE r.list_id = ? AND r.published_date = ?
    ORDER BY r.rank
  `).all(list.list_id, latestDate.date);

  return {
    list: list.display_name,
    list_name_encoded: listNameEncoded,
    published_date: latestDate.date,
    count: books.length,
    books
  };
}

// Query: Get historical bestsellers for a list on a specific date
function queryHistory(db, listNameEncoded, date) {
  const list = db.prepare('SELECT list_id, display_name FROM lists WHERE list_name_encoded = ?')
    .get(listNameEncoded);

  if (!list) {
    throw new Error(`List not found: ${listNameEncoded}`);
  }

  // If no date specified, get the most recent
  let targetDate = date;
  if (!targetDate) {
    const latestDate = db.prepare(`
      SELECT MAX(published_date) as date
      FROM rankings
      WHERE list_id = ?
    `).get(list.list_id);
    targetDate = latestDate?.date;
  }

  if (!targetDate) {
    return {
      list: list.display_name,
      published_date: null,
      books: []
    };
  }

  const books = db.prepare(`
    SELECT
      r.rank,
      r.rank_last_week,
      r.weeks_on_list,
      r.published_date,
      r.bestsellers_date,
      b.title,
      b.author,
      b.publisher,
      b.description,
      b.price,
      b.primary_isbn13,
      b.primary_isbn10,
      b.book_image,
      b.amazon_product_url
    FROM rankings r
    JOIN books b ON r.book_id = b.book_id
    WHERE r.list_id = ? AND r.published_date = ?
    ORDER BY r.rank
  `).all(list.list_id, targetDate);

  return {
    list: list.display_name,
    list_name_encoded: listNameEncoded,
    published_date: targetDate,
    count: books.length,
    books
  };
}

// Query: Get book details and ranking history by ISBN
function queryBook(db, isbn) {
  // Find book by ISBN
  const book = db.prepare(`
    SELECT * FROM books
    WHERE primary_isbn13 = ? OR primary_isbn10 = ?
    LIMIT 1
  `).get(isbn, isbn);

  if (!book) {
    throw new Error(`Book not found with ISBN: ${isbn}`);
  }

  // Get all ISBNs for this book
  const isbns = db.prepare(`
    SELECT isbn13, isbn10 FROM isbns WHERE book_id = ?
  `).all(book.book_id);

  // Get ranking history
  const rankings = db.prepare(`
    SELECT
      l.display_name as list_name,
      l.list_name_encoded,
      r.published_date,
      r.bestsellers_date,
      r.rank,
      r.rank_last_week,
      r.weeks_on_list
    FROM rankings r
    JOIN lists l ON r.list_id = l.list_id
    WHERE r.book_id = ?
    ORDER BY r.published_date DESC, r.rank
  `).all(book.book_id);

  return {
    book,
    isbns,
    ranking_history: rankings,
    total_appearances: rankings.length
  };
}

// Query: Get database statistics
function queryStats(db) {
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lists) as lists_count,
      (SELECT COUNT(*) FROM books) as books_count,
      (SELECT COUNT(*) FROM rankings) as rankings_count,
      (SELECT COUNT(DISTINCT published_date) FROM rankings) as unique_dates,
      (SELECT MIN(published_date) FROM rankings) as oldest_date,
      (SELECT MAX(published_date) FROM rankings) as newest_date,
      (SELECT COUNT(*) FROM sync_log WHERE status = 'success') as successful_syncs,
      (SELECT MAX(created_at) FROM sync_log WHERE status = 'success') as last_sync
  `).get();

  // Top books by weeks on list
  const topBooks = db.prepare(`
    SELECT
      b.title,
      b.author,
      MAX(r.weeks_on_list) as max_weeks,
      COUNT(DISTINCT r.list_id) as lists_appeared
    FROM rankings r
    JOIN books b ON r.book_id = b.book_id
    GROUP BY r.book_id
    ORDER BY max_weeks DESC
    LIMIT 10
  `).all();

  return {
    stats,
    top_books_by_longevity: topBooks
  };
}

// Query: Get all available dates for a list
function queryDates(db, listNameEncoded) {
  const list = db.prepare('SELECT list_id, display_name FROM lists WHERE list_name_encoded = ?')
    .get(listNameEncoded);

  if (!list) {
    throw new Error(`List not found: ${listNameEncoded}`);
  }

  const dates = db.prepare(`
    SELECT DISTINCT published_date, COUNT(*) as books_count
    FROM rankings
    WHERE list_id = ?
    GROUP BY published_date
    ORDER BY published_date DESC
  `).all(list.list_id);

  return {
    list: list.display_name,
    list_name_encoded: listNameEncoded,
    count: dates.length,
    dates
  };
}

// Query: Search for books by title or author
function querySearch(db, searchTerm, limit = 50) {
  const books = db.prepare(`
    SELECT
      b.book_id,
      b.title,
      b.author,
      b.publisher,
      b.description,
      b.primary_isbn13,
      b.primary_isbn10,
      b.book_image,
      COUNT(DISTINCT r.list_id) as lists_count,
      MAX(r.weeks_on_list) as max_weeks_on_list,
      MIN(r.published_date) as first_appearance,
      MAX(r.published_date) as last_appearance
    FROM books b
    LEFT JOIN rankings r ON b.book_id = r.book_id
    WHERE b.title LIKE ? OR b.author LIKE ?
    GROUP BY b.book_id
    ORDER BY max_weeks_on_list DESC, last_appearance DESC
    LIMIT ?
  `).all(`%${searchTerm}%`, `%${searchTerm}%`, limit);

  return {
    query: searchTerm,
    count: books.length,
    books
  };
}
