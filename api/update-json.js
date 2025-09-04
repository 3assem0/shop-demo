// api/update-json.js
// DEBUG VERSION - Vercel serverless function to update data.json in GitHub repository

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
        // DEBUG: Log environment variables (without exposing token)
        console.log('Environment check:', {
            hasToken: !!process.env.GITHUB_TOKEN,
            tokenLength: process.env.GITHUB_TOKEN ? process.env.GITHUB_TOKEN.length : 0,
            username: process.env.GITHUB_USERNAME,
            repo: process.env.GITHUB_REPO,
            branch: process.env.GITHUB_BRANCH
        });

        // Validate environment variables
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_USERNAME = process.env.GITHUB_USERNAME || 'your-username';
        const GITHUB_REPO = process.env.GITHUB_REPO || 'your-repo-name';
        const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

        // More detailed error for missing token
        if (!GITHUB_TOKEN) {
            return res.status(500).json({ 
                error: 'GITHUB_TOKEN environment variable is not set',
                debug: {
                    allEnvVars: Object.keys(process.env).filter(key => key.startsWith('GITHUB')),
                    nodeEnv: process.env.NODE_ENV
                }
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

        console.log('Making request to:', `${apiBase}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`);

        // Step 1: Get current file (if it exists) to get the SHA
        let currentSha = null;
        try {
            const getCurrentFile = await fetch(
                `${apiBase}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}?ref=${GITHUB_BRANCH}`,
                { headers }
            );
            
            console.log('Get current file response:', getCurrentFile.status, getCurrentFile.statusText);
            
            if (getCurrentFile.ok) {
                const currentFileData = await getCurrentFile.json();
                currentSha = currentFileData.sha;
                console.log('Found existing file with SHA:', currentSha);
            } else if (getCurrentFile.status === 404) {
                console.log('File does not exist yet, will create new file');
            } else {
                // Log the error response for debugging
                const errorText = await getCurrentFile.text();
                console.error('Error getting current file:', getCurrentFile.status, errorText);
            }
        } catch (error) {
            console.error('Exception getting current file:', error);
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

        console.log('Commit data:', { ...commitData, content: '[base64 content]' });

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

        console.log('Commit response:', commitResponse.status, commitResponse.statusText);

        if (!commitResponse.ok) {
            const errorData = await commitResponse.json();
            console.error('GitHub API Error Details:', errorData);
            
            // More detailed error response
            return res.status(500).json({
                error: `GitHub API error: ${commitResponse.status} - ${errorData.message}`,
                details: errorData,
                debug: {
                    url: `${apiBase}/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${filePath}`,
                    method: 'PUT',
                    hasAuth: headers.Authorization ? 'Yes' : 'No',
                    authType: headers.Authorization ? headers.Authorization.split(' ')[0] : 'None'
                }
            });
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
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            debug: {
                errorName: error.name,
                errorMessage: error.message
            }
        });
    }
}