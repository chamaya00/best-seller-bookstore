# NYT Books API Explorer

A comprehensive web interface to explore the New York Times Books API, allowing you to interact with all available endpoints for Best Sellers lists and Book Reviews.

## Features

### Best Sellers Endpoints
- **Get Best Sellers List** - View detailed information about specific Best Sellers lists by date and category
- **Lists Overview** - Get top 5 books from all Best Sellers lists
- **List Names** - Retrieve all available Best Sellers list names and metadata
- **Book History** - Search for a book's Best Sellers list history by author, ISBN, or title
- **Age Groups** - Get all available age group classifications

### Book Reviews Endpoint
- **Search Reviews** - Find NYT book reviews by ISBN, title, or author

### Interface Features
- Clean, modern, responsive design
- Tab-based navigation for easy endpoint access
- API key storage in browser (localStorage)
- Syntax-highlighted JSON response display
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

### Installation

1. Clone this repository or download the files
2. Open `index.html` in any modern web browser
3. Enter your NYT API key in the header section
4. Click "Save Key" to store it locally

That's it! No build process, no dependencies, just open and explore.

## Usage

### API Key Management
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
├── index.html          # Complete single-page application
└── README.md          # This file
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
