export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Get the API key from environment variable
  const apiKey = process.env.NYT_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'NYT_API_KEY environment variable is not configured',
      message: 'Please add NYT_API_KEY to your Vercel environment variables'
    });
  }

  // Get the endpoint path from query parameter
  const { endpoint } = req.query;

  if (!endpoint) {
    return res.status(400).json({
      error: 'Missing endpoint parameter',
      message: 'Please provide an endpoint parameter'
    });
  }

  try {
    // Build the NYT API URL
    const baseUrl = 'https://api.nytimes.com/svc/books/v3';

    // Copy all query parameters except 'endpoint'
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'endpoint') {
        queryParams.append(key, value);
      }
    }

    // Add the API key
    queryParams.append('api-key', apiKey);

    const url = `${baseUrl}${endpoint}?${queryParams.toString()}`;

    // Make the request to NYT API
    const response = await fetch(url);
    const data = await response.json();

    // Return the response with the same status code
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Error proxying request:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
