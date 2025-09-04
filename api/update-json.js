// api/update-json.js
// Vercel serverless function to update data.json in GitHub repository

export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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
        // Validate environment variables
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username';
        const GITHUB_REPO = process.env.GITHUB_REPO || 'your-repo-name';
        const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ 
                error: 'GITHUB_TOKEN environment variable is not set' 
            });
        }

        // Parse request body
        const { newData } = req.body;
        if (!newData) {
            return res.status(400).json({ error: 'newData is required in request body' });
        }

        // GitHub API configuration
        const apiBase = 'https://api.github.com';
        const filePath = 'data.json';
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Vercel-Function'
        };

        // Step 1: Get current file (if it exists) to get the SHA
        let currentSha = null;
        try {
            const getCurrentFile = await fetch(
                `${apiBase}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
                { headers }
            );
            
            if (getCurrentFile.ok) {
                const currentFileData = await getCurrentFile.json();
                currentSha = currentFileData.sha;
            }
        } catch (error) {
            // File might not exist yet, which is fine for first creation
            console.log('File does not exist yet, will create new file');
        }

        // Step 2: Prepare the new content
        const jsonContent = JSON.stringify(newData, null, 2);
        const encodedContent = Buffer.from(jsonContent).toString('base64');

        // Step 3: Create commit data
        const commitData = {
            message: `Update products data - ${new Date().toISOString()}`,
            content: encodedContent,
            branch: GITHUB_BRANCH
        };

        // Include SHA if file exists (for updates)
        if (currentSha) {
            commitData.sha = currentSha;
        }

        // Step 4: Commit the changes
        const commitResponse = await fetch(
            `${apiBase}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(commitData)
            }
        );

        if (!commitResponse.ok) {
            const errorData = await commitResponse.json();
            throw new Error(`GitHub API error: ${commitResponse.status} - ${errorData.message}`);
        }

        const result = await commitResponse.json();

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Data updated successfully',
            commit: {
                sha: result.commit.sha,
                url: result.commit.html_url
            },
            file: {
                url: result.content.html_url,
                downloadUrl: result.content.download_url
            }
        });

    } catch (error) {
        console.error('Error updating JSON:', error);
        res.status(500).json({
            error: error.message || 'Internal server error',
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}