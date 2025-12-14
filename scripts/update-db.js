#!/usr/bin/env node

/**
 * Update NYT Best Sellers Database
 *
 * This script:
 * 1. Fetches the current week's data for all lists
 * 2. Updates the database with new rankings
 * 3. Respects API rate limits (5 req/min)
 * 4. Designed to run daily via GitHub Actions
 *
 * Usage: node scripts/update-db.js [options]
 * Options:
 *   --force    Force update even if data was recently synced
 *   --verbose  Show detailed logging
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const DB_PATH = join(__dirname, '../data/bestsellers.db');
const NYT_API_KEY = process.env.NYT_API_KEY;
const NYT_BASE_URL = 'https://api.nytimes.com/svc/books/v3';

// Rate limiting configuration
const RATE_LIMIT_DELAY = 12000; // 12 seconds between requests (5 per minute)

let requestCount = 0;
let startTime = Date.now();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  force: args.includes('--force'),
  verbose: args.includes('--verbose')
};

// Utility: Sleep function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility: Rate-limited fetch
async function rateLimitedFetch(url) {
  // Wait for rate limit
  await sleep(RATE_LIMIT_DELAY);

  requestCount++;
  const elapsed = (Date.now() - startTime) / 1000;

  if (options.verbose) {
    console.log(`[${requestCount}] Fetching: ${url.replace(NYT_API_KEY, 'API_KEY')}`);
    console.log(`    (${elapsed.toFixed(1)}s elapsed)`);
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Find or create book in database (same as init-db.js)
function findOrCreateBook(db, bookData) {
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

// Update current data for a specific list
async function updateList(db, listNameEncoded) {
  const listId = db.prepare('SELECT list_id FROM lists WHERE list_name_encoded = ?')
    .get(listNameEncoded)?.list_id;

  if (!listId) {
    console.error(`❌ List not found: ${listNameEncoded}`);
    return { success: false, error: 'List not found' };
  }

  try {
    // Fetch current list
    const url = `${NYT_BASE_URL}/lists/current/${listNameEncoded}.json?api-key=${NYT_API_KEY}`;
    const data = await rateLimitedFetch(url);

    if (!data.results || !data.results.books) {
      return { success: false, error: 'No data in response' };
    }

    const books = data.results.books;
    const publishedDate = data.results.published_date;
    const bestsellersDate = data.results.bestsellers_date;

    // Check if we already have this data
    const existing = db.prepare(`
      SELECT COUNT(*) as count
      FROM rankings
      WHERE list_id = ? AND published_date = ?
    `).get(listId, publishedDate);

    if (existing.count > 0 && !options.force) {
      if (options.verbose) {
        console.log(`   ⏭️  Already have data for ${publishedDate}, skipping`);
      }
      return { success: true, skipped: true, publishedDate };
    }

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
          // Ranking might already exist
          if (options.verbose) {
            console.log(`   ⚠️  Ranking already exists for book ${bookData.title}`);
          }
        }
      }

      // Log sync
      db.prepare(`
        INSERT INTO sync_log (sync_type, list_name_encoded, sync_date, published_date, records_added, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run('update', listNameEncoded, new Date().toISOString(), publishedDate, rankingsAdded, 'success');

      return { booksAdded, rankingsAdded };
    });

    const result = saveData();

    return {
      success: true,
      publishedDate,
      booksAdded: result.booksAdded,
      rankingsAdded: result.rankingsAdded
    };

  } catch (error) {
    // Log error
    db.prepare(`
      INSERT INTO sync_log (sync_type, list_name_encoded, sync_date, status, error_message)
      VALUES (?, ?, ?, ?, ?)
    `).run('update', listNameEncoded, new Date().toISOString(), 'error', error.message);

    return { success: false, error: error.message };
  }
}

// Main execution
async function main() {
  console.log('🔄 NYT Best Sellers Database Update\n');

  if (!NYT_API_KEY) {
    console.error('❌ Error: NYT_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!existsSync(DB_PATH)) {
    console.error('❌ Error: Database not found at', DB_PATH);
    console.error('   Please run: npm run init-db');
    process.exit(1);
  }

  try {
    const db = new Database(DB_PATH);

    // Get all lists
    const lists = db.prepare('SELECT list_name_encoded, display_name FROM lists ORDER BY display_name').all();

    console.log(`📊 Updating ${lists.length} lists...\n`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let totalRankingsAdded = 0;

    // Update each list
    for (const list of lists) {
      process.stdout.write(`📖 ${list.display_name.padEnd(40)} ... `);

      const result = await updateList(db, list.list_name_encoded);

      if (result.success) {
        if (result.skipped) {
          console.log(`⏭️  skipped (already up to date)`);
          skippedCount++;
        } else {
          console.log(`✅ ${result.rankingsAdded} rankings (${result.publishedDate})`);
          successCount++;
          totalRankingsAdded += result.rankingsAdded;
        }
      } else {
        console.log(`❌ ${result.error}`);
        errorCount++;
      }
    }

    console.log('\n✅ Update complete!');
    console.log(`📊 Summary:`);
    console.log(`   Updated: ${successCount}`);
    console.log(`   Skipped: ${skippedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   New rankings: ${totalRankingsAdded}`);
    console.log(`   API requests: ${requestCount}`);
    console.log(`   Time: ${((Date.now() - startTime) / 1000 / 60).toFixed(1)} minutes`);

    // Show latest data
    const latestSync = db.prepare(`
      SELECT published_date, COUNT(*) as count
      FROM rankings
      GROUP BY published_date
      ORDER BY published_date DESC
      LIMIT 1
    `).get();

    if (latestSync) {
      console.log(`\n📅 Latest data: ${latestSync.published_date} (${latestSync.count} rankings)`);
    }

    db.close();

    // Exit with error code if there were errors
    if (errorCount > 0) {
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

main();
