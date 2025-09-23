// This imports all the tools we need for our server.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
// We no longer need the 'fs' module since we are not saving the file.
// const fs = require('fs');

// We create an 'app' to represent our server.
const app = express();

// Set up Multer to store the file in memory temporarily.
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
        // Generate the hash from the file buffer (the in-memory data).
        const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

        // The 'proof' is the hash itself. The file is not saved.
        const link = `https://linkproof.co/proof/${hash}`;

        res.json({ link: link });
    } catch (error) {
        console.error("Error processing file upload:", error);
        res.status(500).send("An error occurred during upload.");
    }
});

// This tells our server to start listening for requests.
app.listen(3000, () => {
    console.log(`LinkProof server listening on http://localhost:3000`);
});
