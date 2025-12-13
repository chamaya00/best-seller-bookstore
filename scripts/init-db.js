#!/usr/bin/env node

/**
 * Initialize NYT Best Sellers Database
 *
 * This script:
 * 1. Creates the SQLite database
 * 2. Applies the schema
 * 3. Fetches all list names from NYT API
 * 4. Fetches historical data for each list
 * 5. Respects API rate limits (5 req/min, 500 req/day)
 *
 * Usage: node scripts/init-db.js [options]
 * Options:
 *   --lists <list1,list2>  Only fetch specific lists (comma-separated)
 *   --since <YYYY-MM-DD>   Only fetch data since this date
 *   --dry-run              Show what would be fetched without making API calls
 */

import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DB_PATH = join(__dirname, '../data/bestsellers.db');
const SCHEMA_PATH = join(__dirname, 'schema.sql');
const NYT_API_KEY = process.env.NYT_API_KEY;
const NYT_BASE_URL = 'https://api.nytimes.com/svc/books/v3';

// Rate limiting configuration
const RATE_LIMIT_DELAY = 12000; // 12 seconds between requests (5 per minute)
const REQUESTS_PER_MINUTE = 5;
const MAX_REQUESTS_PER_DAY = 500;

let requestCount = 0;
let startTime = Date.now();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  lists: args.includes('--lists') ? args[args.indexOf('--lists') + 1]?.split(',') : null,
  since: args.includes('--since') ? args[args.indexOf('--since') + 1] : null,
  dryRun: args.includes('--dry-run')
};

// Utility: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Rate-limited fetch
async function rateLimitedFetch(url) {
  if (requestCount >= MAX_REQUESTS_PER_DAY) {
    throw new Error(`Daily API limit reached (${MAX_REQUESTS_PER_DAY} requests)`);
  }

  // Wait for rate limit
  await sleep(RATE_LIMIT_DELAY);

  requestCount++;
  const elapsed = (Date.now() - startTime) / 1000;
  console.log(`[${requestCount}] Fetching: ${url.replace(NYT_API_KEY, 'API_KEY')}`);
  console.log(`    (${elapsed.toFixed(1)}s elapsed, ~${(requestCount / elapsed * 60).toFixed(1)} req/min)`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Initialize database with schema
function initDatabase() {
  console.log('📦 Creating database...');
  const db = new Database(DB_PATH);

  console.log('📋 Applying schema...');
  const schema = readFileSync(SCHEMA_PATH, 'utf-8');
  db.exec(schema);

  console.log('✅ Database initialized at:', DB_PATH);
  return db;
}

// Fetch all list names
async function fetchListNames() {
  console.log('\n📚 Fetching list names...');

  if (options.dryRun) {
    console.log('[DRY RUN] Would fetch list names');
    return [];
  }

  const url = `${NYT_BASE_URL}/lists/names.json?api-key=${NYT_API_KEY}`;
  const data = await rateLimitedFetch(url);

  console.log(`✅ Found ${data.results.length} lists`);
  return data.results;
}

// Save list metadata to database
function saveLists(db, lists) {
  console.log('\n💾 Saving list metadata...');

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO lists (
      list_name_encoded, display_name, list_name,
      oldest_published_date, newest_published_date, updated
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);

  const insert = db.transaction((lists) => {
    for (const list of lists) {
      stmt.run(
        list.list_name_encoded,
        list.display_name,
        list.list_name,
        list.oldest_published_date,
        list.newest_published_date,
        list.updated
      );
    }
  });

  insert(lists);
  console.log(`✅ Saved ${lists.length} lists to database`);
}

// Find or create book in database
function findOrCreateBook(db, bookData) {
  // Try to find by ISBN
  let book = null;

  if (bookData.primary_isbn13) {
    book = db.prepare('SELECT book_id FROM books WHERE primary_isbn13 = ?')
      .get(bookData.primary_isbn13);
  }

  if (!book && bookData.primary_isbn10) {
    book = db.prepare('SELECT book_id FROM books WHERE primary_isbn10 = ?')
      .get(bookData.primary_isbn10);
  }

  const now = new Date().toISOString();

  if (book) {
    // Update existing book
    db.prepare(`
      UPDATE books SET
        title = ?, author = ?, publisher = ?, description = ?,
        price = ?, book_image = ?, book_image_width = ?, book_image_height = ?,
        amazon_product_url = ?, book_review_link = ?, updated_date = ?
      WHERE book_id = ?
    `).run(
      bookData.title,
      bookData.author,
      bookData.publisher,
      bookData.description,
      bookData.price,
      bookData.book_image,
      bookData.book_image_width,
      bookData.book_image_height,
      bookData.amazon_product_url,
      bookData.book_review_link,
      now,
      book.book_id
    );

    return book.book_id;
  } else {
    // Create new book
    const result = db.prepare(`
      INSERT INTO books (
        primary_isbn13, primary_isbn10, title, author, publisher, description,
        price, book_image, book_image_width, book_image_height,
        amazon_product_url, book_review_link, created_date, updated_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bookData.primary_isbn13,
      bookData.primary_isbn10,
      bookData.title,
      bookData.author,
      bookData.publisher,
      bookData.description,
      bookData.price,
      bookData.book_image,
      bookData.book_image_width,
      bookData.book_image_height,
      bookData.amazon_product_url,
      bookData.book_review_link,
      now,
      now
    );

    // Save all ISBNs
    if (bookData.isbns && bookData.isbns.length > 0) {
      const isbnStmt = db.prepare('INSERT INTO isbns (book_id, isbn13, isbn10) VALUES (?, ?, ?)');
      for (const isbn of bookData.isbns) {
        isbnStmt.run(result.lastInsertRowid, isbn.isbn13, isbn.isbn10);
      }
    }

    return result.lastInsertRowid;
  }
}

// Fetch historical data for a specific list
async function fetchListHistory(db, listNameEncoded, oldestDate, newestDate, sinceDate) {
  const listId = db.prepare('SELECT list_id FROM lists WHERE list_name_encoded = ?')
    .get(listNameEncoded)?.list_id;

  if (!listId) {
    console.error(`❌ List not found in database: ${listNameEncoded}`);
    return;
  }

  console.log(`\n📖 Fetching history for: ${listNameEncoded}`);
  console.log(`   Date range: ${oldestDate} to ${newestDate}`);

  // Determine date range
  const startDate = sinceDate ? new Date(sinceDate) : new Date(oldestDate);
  const endDate = new Date(newestDate);

  // NYT lists update weekly, so we'll fetch weekly snapshots
  const dates = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    dates.push(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 7); // Weekly intervals
  }

  console.log(`   Will fetch ${dates.length} snapshots (weekly intervals)`);

  if (options.dryRun) {
    console.log('[DRY RUN] Would fetch dates:', dates.slice(0, 5), '...');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  for (const date of dates) {
    try {
      const url = `${NYT_BASE_URL}/lists/${date}/${listNameEncoded}.json?api-key=${NYT_API_KEY}`;
      const data = await rateLimitedFetch(url);

      if (!data.results || !data.results.books) {
        console.log(`   ⚠️  No data for ${date}`);
        continue;
      }

      const books = data.results.books;
      const publishedDate = data.results.published_date;
      const bestsellersDate = data.results.bestsellers_date;

      // Save books and rankings in a transaction
      const saveData = db.transaction(() => {
        let booksAdded = 0;
        let rankingsAdded = 0;

        for (const bookData of books) {
          const bookId = findOrCreateBook(db, bookData);
          booksAdded++;

          // Save ranking
          try {
            db.prepare(`
              INSERT OR REPLACE INTO rankings (
                list_id, book_id, published_date, bestsellers_date,
                rank, rank_last_week, weeks_on_list, asterisk, dagger
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              listId,
              bookId,
              publishedDate,
              bestsellersDate,
              bookData.rank,
              bookData.rank_last_week,
              bookData.weeks_on_list,
              bookData.asterisk || 0,
              bookData.dagger || 0
            );
            rankingsAdded++;
          } catch (err) {
            // Ranking might already exist, that's ok
          }
        }

        // Log sync
        db.prepare(`
          INSERT INTO sync_log (sync_type, list_name_encoded, sync_date, published_date, records_added, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run('init', listNameEncoded, new Date().toISOString(), publishedDate, rankingsAdded, 'success');

        return { booksAdded, rankingsAdded };
      });

      const result = saveData();
      successCount++;
      console.log(`   ✅ ${date}: ${result.rankingsAdded} rankings saved`);

    } catch (error) {
      errorCount++;
      console.error(`   ❌ ${date}: ${error.message}`);

      // Log error
      db.prepare(`
        INSERT INTO sync_log (sync_type, list_name_encoded, sync_date, published_date, status, error_message)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('init', listNameEncoded, new Date().toISOString(), date, 'error', error.message);
    }
  }

  console.log(`   Summary: ${successCount} successful, ${errorCount} errors`);
}

// Main execution
async function main() {
  console.log('🚀 NYT Best Sellers Database Initialization\n');

  if (!NYT_API_KEY) {
    console.error('❌ Error: NYT_API_KEY environment variable not set');
    console.error('   Please set it with: export NYT_API_KEY=your_api_key');
    process.exit(1);
  }

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No API calls or database writes will be made\n');
  }

  if (options.lists) {
    console.log('📋 Filtering lists:', options.lists.join(', '));
  }

  if (options.since) {
    console.log('📅 Fetching data since:', options.since);
  }

  try {
    // Initialize database
    const db = initDatabase();

    // Fetch and save list names
    const lists = await fetchListNames();

    if (!options.dryRun && lists.length > 0) {
      saveLists(db, lists);
    }

    // Filter lists if specified
    const listsToFetch = options.lists
      ? lists.filter(l => options.lists.includes(l.list_name_encoded))
      : lists;

    if (listsToFetch.length === 0) {
      console.log('\n⚠️  No lists to fetch');
      db.close();
      return;
    }

    console.log(`\n📊 Will fetch historical data for ${listsToFetch.length} lists`);
    console.log(`⏱️  Estimated time: ~${(listsToFetch.length * 2).toFixed(0)} minutes (with rate limiting)\n`);

    // Fetch historical data for each list
    for (const list of listsToFetch) {
      await fetchListHistory(
        db,
        list.list_name_encoded,
        list.oldest_published_date,
        list.newest_published_date,
        options.since
      );
    }

    console.log('\n✅ Database initialization complete!');
    console.log(`📊 Total API requests made: ${requestCount}`);
    console.log(`⏱️  Total time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);

    // Show database stats
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM lists) as lists_count,
        (SELECT COUNT(*) FROM books) as books_count,
        (SELECT COUNT(*) FROM rankings) as rankings_count,
        (SELECT COUNT(*) FROM sync_log WHERE status = 'success') as successful_syncs,
        (SELECT COUNT(*) FROM sync_log WHERE status = 'error') as failed_syncs
    `).get();

    console.log('\n📈 Database Statistics:');
    console.log(`   Lists: ${stats.lists_count}`);
    console.log(`   Books: ${stats.books_count}`);
    console.log(`   Rankings: ${stats.rankings_count}`);
    console.log(`   Successful syncs: ${stats.successful_syncs}`);
    console.log(`   Failed syncs: ${stats.failed_syncs}`);

    db.close();

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
