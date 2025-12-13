# NYT Books API Explorer with Historical Database

A comprehensive web interface to explore the New York Times Books API with **historical data storage** in SQLite. Query live API endpoints AND search through years of archived Best Sellers data.

## Features

### 🆕 Historical Database
- **SQLite Database** - Local database storing years of NYT Best Sellers historical data
- **Daily Auto-Updates** - GitHub Actions automatically fetch new data every day
- **Advanced Queries** - Search books, view trends, analyze rankings over time
- **Offline Access** - Query historical data without hitting API rate limits
- **Database Statistics** - View comprehensive stats about stored data

### Best Sellers Endpoints (Live API)
- **Get Best Sellers List** - View detailed information about specific Best Sellers lists by date and category
- **Lists Overview** - Get top 5 books from all Best Sellers lists
- **List Names** - Retrieve all available Best Sellers list names and metadata
- **Book History** - Search for a book's Best Sellers list history by author, ISBN, or title
- **Age Groups** - Get all available age group classifications

### Book Reviews Endpoint (Live API)
- **Search Reviews** - Find NYT book reviews by ISBN, title, or author

### Interface Features
- Clean, modern, responsive design
- Tab-based navigation for easy endpoint access
- **📚 Database tab** - Query historical data from local SQLite database
- API key storage in browser (localStorage)
- Formatted table and raw JSON response display
- Copy to clipboard functionality
- Error handling and loading states
- Pre-populated list names for quick testing

## Getting Started

### Prerequisites
You need a New York Times API key to use this explorer.

1. Visit [NYT Developer Portal](https://developer.nytimes.com/get-started)
2. Create a free account
3. Subscribe to the Books API
4. Copy your API key

### Deploying to Vercel (Recommended)

This application is optimized for deployment on Vercel with secure environment variable support.

1. **Fork or clone this repository**

2. **Get your NYT API Key:**
   - Visit [NYT Developer Portal](https://developer.nytimes.com/get-started)
   - Create a free account
   - Subscribe to the Books API
   - Copy your API key

3. **Deploy to Vercel:**

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

   Or use Vercel CLI:
   ```bash
   npm i -g vercel
   vercel
   ```

4. **Configure Environment Variable:**
   - In your Vercel project dashboard, go to **Settings → Environment Variables**
   - Add a new variable:
     - Name: `NYT_API_KEY`
     - Value: Your NYT API key
   - Add it to all environments (Production, Preview, Development)

5. **Redeploy:**
   - Vercel will automatically redeploy
   - Your API key is now securely stored server-side!

### Local Development

1. Clone this repository
2. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
3. Add your NYT API key to the `.env` file
4. Open `index.html` in any modern web browser
5. Alternatively, enter your API key in the "Local Dev API Key" field in the UI

That's it! No build process, no dependencies (for the web interface only).

## 📚 Database Setup

The historical database feature allows you to store and query years of NYT Best Sellers data locally.

### Prerequisites

- Node.js 18+ (for running database scripts)
- NYT API Key (stored in environment variable)

### Initial Database Setup

1. **Install Dependencies**

   ```bash
   npm install
   ```

   This installs `better-sqlite3` for database operations.

2. **Set Environment Variable**

   ```bash
   export NYT_API_KEY="your_api_key_here"
   ```

   Or add it to your `.env` file:
   ```
   NYT_API_KEY=your_api_key_here
   ```

3. **Initialize Database with Historical Data**

   ```bash
   npm run init-db
   ```

   This script will:
   - Create `data/bestsellers.db` SQLite database
   - Apply the database schema (books, lists, rankings tables)
   - Fetch all available list names from NYT API
   - Fetch historical data for each list (weekly snapshots)
   - Respect API rate limits (5 requests/min)

   **⚠️ Warning:** Full historical fetch can take **several hours** and uses many API requests. Consider these options:

   **Option A: Fetch Specific Lists Only**
   ```bash
   node scripts/init-db.js --lists hardcover-fiction,hardcover-nonfiction
   ```

   **Option B: Fetch Recent Data Only**
   ```bash
   node scripts/init-db.js --since 2024-01-01
   ```

   **Option C: Dry Run (no API calls)**
   ```bash
   node scripts/init-db.js --dry-run
   ```

4. **Test Database**

   ```bash
   npm run test-db
   ```

   Shows database statistics and sample queries.

### Updating the Database

Once initialized, update the database daily:

```bash
npm run update-db
```

This fetches the latest data for all lists. Much faster than initial setup (only fetches current week).

### Automated Daily Updates (GitHub Actions)

The repository includes a GitHub Action that automatically updates the database daily:

1. **Add NYT API Key to GitHub Secrets**
   - Go to your repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NYT_API_KEY`
   - Value: Your NYT API key

2. **The GitHub Action will:**
   - Run daily at 6 AM UTC
   - Fetch latest bestsellers data
   - Update the database file
   - Commit and push changes automatically
   - Can also be triggered manually from Actions tab

3. **Verify it's working:**
   - Check the "Actions" tab in your GitHub repository
   - View workflow runs and logs

### Database Schema

The database includes the following tables:

- **`lists`** - Metadata about all bestseller lists
- **`books`** - Deduplicated book information
- **`isbns`** - All ISBNs associated with books
- **`rankings`** - Historical ranking positions (list + book + date)
- **`reviews`** - NYT book reviews (optional)
- **`sync_log`** - Track synchronization history

### Querying the Database

The database can be queried two ways:

**1. Via Web Interface (📚 Database Tab)**

Visit your deployed site and click the "📚 Database" tab. Query types:
- Database Statistics
- All Available Lists
- Current Bestsellers by List
- Historical Bestsellers by Date
- Available Dates for a List
- Search Books (by title/author)
- Book Details by ISBN

**2. Via API Endpoint**

```bash
# Get database stats
curl http://localhost:3000/api/db-query?action=stats

# Get current hardcover fiction
curl http://localhost:3000/api/db-query?action=current&list=hardcover-fiction

# Search for books
curl http://localhost:3000/api/db-query?action=search&q=Harry+Potter

# Get book history by ISBN
curl http://localhost:3000/api/db-query?action=book&isbn=9781234567890
```

### Database File Size

Expected database sizes:
- **1 year of data**: ~20-30 MB
- **5 years of data**: ~100-150 MB
- **10+ years of data**: ~200-300 MB

The database file is committed to the repository for easy deployment to Vercel.

## Architecture

### Secure API Key Handling

When deployed on Vercel, this application uses a serverless architecture to keep your API key secure:

- **Serverless Function (`/api/nyt-proxy.js`)**: Acts as a secure proxy between your frontend and the NYT API
- **Environment Variables**: API key is stored server-side in Vercel environment variables
- **No Client Exposure**: Your API key never appears in client-side code or browser network requests
- **Automatic Fallback**: For local development, you can still use a manual API key entry

### How It Works

1. Frontend makes requests to `/api/nyt-proxy?endpoint=...`
2. Serverless function receives the request
3. Function fetches API key from `process.env.NYT_API_KEY`
4. Function proxies the request to NYT API with the key
5. Response is returned to the frontend

This architecture prevents API key exposure and provides better security than client-side API calls.

## Usage

### API Key Management (Vercel Deployment)

When deployed on Vercel, API keys are managed through environment variables - no manual entry needed!

### API Key Management (Local Development)
- Enter your API key in the input field at the top
- Click "Save Key" to store it in your browser's localStorage
- The key persists across browser sessions
- Click "Clear" to remove the stored key

### Exploring Endpoints

#### 1. Best Sellers List
- Select a date (or use "current" for the latest list)
- Choose a list category (Hardcover Fiction, Nonfiction, etc.)
- Optionally set an offset for pagination
- Click "Get Best Sellers List"

#### 2. Lists Overview
- Optionally select a specific date
- Click "Get Overview" to see top 5 from all lists
- Leave date empty for current week's overview

#### 3. List Names
- Click "Get List Names" to retrieve all available list names
- Use this to discover valid list-name values for the Best Sellers endpoint

#### 4. Book History
- Search by author name, ISBN, or book title
- At least one field should be filled
- Use offset for pagination (results come in sets of 20)
- Click "Search History"

#### 5. Book Reviews
- Search by ISBN (10 or 13 digits), title, or author
- At least one search parameter is required
- Multiple parameters can narrow results
- Click "Search Reviews"

#### 6. Age Groups
- Click "Get Age Groups" to see all age classifications
- Useful for understanding list categorization

#### 7. 📚 Database Queries (Historical Data)
- Select query type from dropdown
- **Database Statistics**: View overall database metrics
  - Total books, lists, rankings
  - Date range of stored data
  - Top books by longevity
- **All Available Lists**: See all lists with edition counts
- **Current Bestsellers by List**: Get most recent rankings for a list
- **Historical Bestsellers by Date**: Query rankings from specific dates
- **Available Dates for a List**: See all dates you have data for
- **Search Books**: Find books by title or author across all time
- **Book Details by ISBN**: Get complete ranking history for a book

### Response Display
- JSON responses are formatted and syntax-highlighted
- Click "Copy JSON" to copy the response to clipboard
- Scroll through large responses in the fixed-height viewer
- Error messages are displayed clearly with red highlights

## API Information

### Base URL
```
https://api.nytimes.com/svc/books/v3
```

### Rate Limits
- **Requests per day:** 500
- **Requests per minute:** 5
- Consider implementing delays between requests for bulk operations

### Available List Names
Common Best Sellers lists include:
- `hardcover-fiction`
- `hardcover-nonfiction`
- `trade-fiction-paperback`
- `paperback-nonfiction`
- `combined-print-and-e-book-fiction`
- `combined-print-and-e-book-nonfiction`
- `young-adult-hardcover`
- `picture-books`
- `series-books`
- `graphic-books-and-manga`

Use the "List Names" endpoint to get the complete, up-to-date list.

## Example Queries

### Get Current Hardcover Fiction Best Sellers
- Tab: Best Sellers
- Date: `current`
- List Name: `hardcover-fiction`

### Find All Books by Stephen King on Best Sellers Lists
- Tab: Book History
- Author: `Stephen King`

### Search for Book Reviews by ISBN
- Tab: Book Reviews
- ISBN: `9781476730772`

### Get Overview for a Specific Date
- Tab: Lists Overview
- Date: `2024-01-01`

## Technical Details

### Built With
- Pure HTML5, CSS3, and vanilla JavaScript
- No frameworks or dependencies
- Fetch API for HTTP requests
- LocalStorage API for key persistence

### Browser Compatibility
Works in all modern browsers that support:
- ES6+ JavaScript
- Fetch API
- LocalStorage
- CSS Grid and Flexbox

### File Structure
```
.
├── index.html                      # Frontend application with Database tab
├── package.json                    # Node.js dependencies
├── api/
│   ├── nyt-proxy.js               # Serverless function for API proxying
│   └── db-query.js                # Database query API endpoint
├── scripts/
│   ├── schema.sql                 # SQLite database schema
│   ├── init-db.js                 # Initialize database with historical data
│   ├── update-db.js               # Update database with new data
│   └── test-db.js                 # Test database and show stats
├── data/
│   └── bestsellers.db             # SQLite database (created by scripts)
├── .github/
│   └── workflows/
│       └── update-bestsellers.yml # Daily auto-update GitHub Action
├── vercel.json                    # Vercel configuration
├── .env.example                   # Environment variable template
├── .gitignore                     # Git ignore rules
└── README.md                      # This file
```

## Tips for Best Results

1. **Save Your API Key** - Store it once and reuse across sessions
2. **Start with List Names** - Use this endpoint to discover available lists
3. **Use Current Date** - The special value "current" gets the latest list
4. **Pagination** - Use offset (multiples of 20) for large result sets
5. **Combine Searches** - Use multiple parameters in Book Reviews for specific results
6. **Copy Responses** - Use the copy button to save JSON for further analysis

## Common Use Cases

### Research Best Sellers Trends
1. Get List Names to see all categories
2. Query multiple lists with current date
3. Compare results across categories

### Find Book Reviews
1. Search by ISBN for exact matches
2. Search by author to see all their reviewed books
3. Search by title for specific book reviews

### Track Book Performance
1. Use Book History with ISBN
2. See all lists a book appeared on
3. View ranking history over time

### Analyze Historical Trends (Database)
1. Search for a book by title across all time
2. View its complete ranking history
3. See which lists it appeared on
4. Track how long it stayed on bestseller lists

### Build Data Analytics (Database)
1. Query database statistics to see overall trends
2. Export data via Copy JSON button
3. Analyze top books by longevity
4. Compare current vs historical rankings

## Troubleshooting

### "Please enter your API key first"
- You haven't entered an API key
- Enter your key and click "Save Key"

### "Error: Developer Inactive" or "Error: Developer Over Qps"
- You've exceeded rate limits
- Wait a few minutes before making more requests
- Reduce request frequency

### "Error: Invalid API key"
- Your API key is incorrect or expired
- Verify your key at the NYT Developer Portal
- Make sure you've subscribed to the Books API

### Empty or Null Results
- The query parameters might not match any records
- Try broader search terms
- Verify the list name is correct (use List Names endpoint)

## Resources

- [Official NYT Books API Documentation](https://developer.nytimes.com/docs/books-product/1/overview)
- [API Specifications on GitHub](https://github.com/nytimes/public_api_specs/blob/master/books_api/books_api.md)
- [NYT Developer Portal](https://developer.nytimes.com/)

## License

This is an unofficial API explorer tool. The New York Times Books API and all data are © The New York Times Company.

## Contributing

Feel free to enhance this explorer! Some ideas:
- Add data visualization charts
- Export results to CSV
- Save favorite queries
- Add request history
- Implement response filtering
- Add dark mode theme

---

Built for exploring the NYT Books API. Happy exploring!
