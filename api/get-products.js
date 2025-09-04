// api/get-products.js
// Vercel serverless function to fetch products from GitHub repository

export default async function handler(req, res) {
    // Set CORS headers
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

    try {
        // Get environment variables
        const GITHUB_USERNAME = process.env.GITHUB_USERNAME;
        const GITHUB_REPO = process.env.GITHUB_REPO;
        const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

        if (!GITHUB_USERNAME || !GITHUB_REPO) {
            return res.status(500).json({ 
                error: 'GITHUB_USERNAME and GITHUB_REPO environment variables are required' 
            });
        }

        // Fetch data.json from GitHub repository
        const response = await fetch(
            `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/data.json`
        );

        if (!response.ok) {
            if (response.status === 404) {
                // File doesn't exist yet, return empty products
                return res.status(200).json({
                    products: [],
                    lastUpdated: new Date().toISOString()
                });
            }
            throw new Error(`Failed to fetch products: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Return the products data
        res.status(200).json(data);

    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}