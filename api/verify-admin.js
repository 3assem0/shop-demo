// api/verify-admin.js
// Vercel serverless function to verify admin password

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight request
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Get the admin password from environment variables
        const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

        if (!ADMIN_PASSWORD) {
            console.error('ADMIN_PASSWORD environment variable is not set');
            return res.status(500).json({ 
                success: false,
                error: 'Server configuration error' 
            });
        }

        // Parse request body
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ 
                success: false,
                error: 'Password is required' 
            });
        }

        // Verify password
        if (password === ADMIN_PASSWORD) {
            // Correct password
            res.status(200).json({
                success: true,
                message: 'Access granted'
            });
        } else {
            // Wrong password - don't reveal too much info
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }

    } catch (error) {
        console.error('Error verifying admin password:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
}