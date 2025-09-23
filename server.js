// This imports all the tools we need for our server.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const app = express();
const upload = multer({ storage: multer.memoryStorage() });

// This serves your front-end HTML file.
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// This is the upload endpoint.
app.post('/upload', upload.single('myFile'), (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        const link = `https://linkproof.co/proof/${hash}`;
        res.json({ link: link });
    } catch (error) {
        console.error("Error processing file upload:", error);
        res.status(500).send("An error occurred during upload.");
    }
});

// This handles requests for the proof pages (e.g., /proof/c207e5...)
app.get('/proof/:hash', (req, res) => {
    const hash = req.params.hash;

    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LinkProof - Digital Receipt</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-white font-sans flex flex-col items-center justify-center min-h-screen">
            <div class="bg-gray-800 p-8 rounded-xl shadow-lg w-11/12 max-w-2xl text-center">
                <h1 class="text-4xl font-bold mb-4 text-green-400">Digital Receipt Confirmed</h1>
                <p class="text-gray-300 text-lg mb-6">This URL confirms the existence of a digital asset with the following unique digital fingerprint.</p>
                <div class="bg-gray-900 p-4 rounded-lg break-words">
                    <p class="text-green-500 font-mono text-sm">${hash}</p>
                </div>
                <p class="text-gray-400 text-sm mt-4">The integrity of the file can be verified by comparing its hash with this URL.</p>
                <div class="mt-8">
                    <a href="https://www.linkproof.co" class="text-blue-400 hover:text-blue-300 transition-colors duration-200">Go back to LinkProof.co</a>
                </div>
            </div>
            <footer class="mt-12 text-center text-sm text-gray-500">
                <p>&copy; 2025 All rights reserved to Muhammad Langdi.</p>
            </footer>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// This tells our server to start listening for requests.
app.listen(3000, () => {
    console.log(`LinkProof server listening on http://localhost:3000`);
});
