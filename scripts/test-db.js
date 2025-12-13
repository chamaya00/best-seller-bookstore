#!/usr/bin/env node

/**
 * Test NYT Best Sellers Database
 *
 * Simple script to test database queries and show sample data
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = join(__dirname, '../data/bestsellers.db');

function main() {
  console.log('🧪 Testing NYT Best Sellers Database\n');

  if (!existsSync(DB_PATH)) {
    console.error('❌ Database not found at', DB_PATH);
    console.error('   Please run: npm run init-db');
    process.exit(1);
  }

  const db = new Database(DB_PATH, { readonly: true });

  // Database stats
  console.log('📊 Database Statistics:');
  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM lists) as lists_count,
      (SELECT COUNT(*) FROM books) as books_count,
      (SELECT COUNT(*) FROM rankings) as rankings_count,
      (SELECT COUNT(DISTINCT published_date) FROM rankings) as unique_dates,
      (SELECT MIN(published_date) FROM rankings) as oldest_date,
      (SELECT MAX(published_date) FROM rankings) as newest_date
  `).get();

  console.log(`   Lists: ${stats.lists_count}`);
  console.log(`   Books: ${stats.books_count}`);
  console.log(`   Rankings: ${stats.rankings_count}`);
  console.log(`   Date range: ${stats.oldest_date} to ${stats.newest_date}`);
  console.log(`   Unique dates: ${stats.unique_dates}`);

  // List names
  console.log('\n📚 Available Lists:');
  const lists = db.prepare('SELECT display_name, list_name_encoded FROM lists ORDER BY display_name LIMIT 10').all();
  lists.forEach((list, i) => {
    console.log(`   ${(i + 1).toString().padStart(2)}. ${list.display_name}`);
  });
  if (stats.lists_count > 10) {
    console.log(`   ... and ${stats.lists_count - 10} more`);
  }

  // Latest bestseller (example query)
  console.log('\n🏆 Current #1 Hardcover Fiction:');
  const topBook = db.prepare(`
    SELECT b.title, b.author, r.weeks_on_list, r.published_date
    FROM rankings r
    JOIN books b ON r.book_id = b.book_id
    JOIN lists l ON r.list_id = l.list_id
    WHERE l.list_name_encoded = 'hardcover-fiction'
      AND r.rank = 1
    ORDER BY r.published_date DESC
    LIMIT 1
  `).get();

  if (topBook) {
    console.log(`   ${topBook.title}`);
    console.log(`   by ${topBook.author}`);
    console.log(`   ${topBook.weeks_on_list} weeks on list`);
    console.log(`   (as of ${topBook.published_date})`);
  } else {
    console.log('   No data available');
  }

  // Sync log
  console.log('\n📝 Recent Sync Activity:');
  const recentSyncs = db.prepare(`
    SELECT sync_type, list_name_encoded, published_date, records_added, status, created_at
    FROM sync_log
    ORDER BY created_at DESC
    LIMIT 5
  `).all();

  recentSyncs.forEach(sync => {
    const statusIcon = sync.status === 'success' ? '✅' : '❌';
    console.log(`   ${statusIcon} ${sync.sync_type} - ${sync.list_name_encoded || 'all'} (${sync.created_at.split('T')[0]})`);
  });

  // Database file size
  const fs = await import('fs');
  const fileSizeInBytes = fs.statSync(DB_PATH).size;
  const fileSizeInMB = (fileSizeInBytes / (1024 * 1024)).toFixed(2);
  console.log(`\n💾 Database file size: ${fileSizeInMB} MB`);

  console.log('\n✅ Database is healthy!\n');

  db.close();
}

main();
