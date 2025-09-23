// This imports all the tools we need for our server.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { MongoClient } = require('mongodb');
const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB in bytes
    }
});

// Database connection setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = "linkproof-db";

async function connectToDatabase() {
    try {
        await client.connect();
        console.log("Connected to MongoDB Atlas!");
    } catch (error) {
        console.error("Could not connect to database:", error);
    }
}

connectToDatabase();

// This serves your front-end HTML.
app.get('/', (req, res) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>LinkProof.co</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-white font-sans flex flex-col items-center justify-center min-h-screen">
            <div class="bg-gray-800 p-8 rounded-xl shadow-lg w-11/12 max-w-2xl text-center">
                <h1 class="text-4xl md:text-5xl font-bold mb-4">LinkProof.co</h1>
                <p class="text-gray-400 mb-6">Future-proof your content. Get a permanent public receipt for your work.</p>

                <form id="uploadForm" class="flex flex-col items-center mb-6">
                    <label for="file-upload" class="cursor-pointer">
                        <div class="border-2 border-dashed border-gray-600 rounded-lg p-12 w-full max-w-lg mb-4 hover:border-blue-500 transition-colors duration-200">
                            <p class="text-gray-400 mb-2">Drag & Drop a file here or</p>
                            <button type="button" class="bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">Click to upload</button>
                            <input id="file-upload" name="myFile" type="file" class="hidden" />
                        </div>
                    </label>
                </form>

                <p class="text-gray-400 text-sm mt-2">Maximum file size is 5MB.</p>

                <p id="responseMessage" class="text-gray-300 text-sm"></p>
                <a id="linkProof" href="#" class="text-blue-400 hover:text-blue-300 transition-colors duration-200 hidden mt-4"></a>

                <footer class="mt-8 text-center text-sm text-gray-500">
                    <p>&copy; 2025 All rights reserved to Muhammad Langdi.</p>
                </footer>
            </div>

            <script>
                const fileInput = document.getElementById('file-upload');
                const uploadButton = document.querySelector('button');
                const responseMessage = document.getElementById('responseMessage');
                const linkProof = document.getElementById('linkProof');

                uploadButton.addEventListener('click', () => {
                    fileInput.click();
                });

                fileInput.addEventListener('change', async (event) => {
                    const file = event.target.files[0];
                    if (!file) {
                        return;
                    }

                    responseMessage.textContent = 'Uploading...';
                    responseMessage.classList.add('text-yellow-400');
                    linkProof.classList.add('hidden');

                    const formData = new FormData();
                    formData.append('myFile', file);

                    try {
                        const response = await fetch('/upload', {
                            method: 'POST',
                            body: formData,
                        });

                        const result = await response.json();

                        if (response.ok) {
                            responseMessage.textContent = 'Your LinkProof is:';
                            responseMessage.classList.remove('text-yellow-400');
                            linkProof.href = result.link;
                            linkProof.textContent = result.link;
                            linkProof.classList.remove('hidden');
                        } else {
                            responseMessage.textContent = 'An error occurred during upload.';
                            responseMessage.classList.remove('text-yellow-400');
                            responseMessage.classList.add('text-red-400');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        responseMessage.textContent = 'An error occurred during upload.';
                        responseMessage.classList.remove('text-yellow-400');
                        responseMessage.classList.add('text-red-400');
                    }
                });
            </script>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// This is the upload endpoint.
app.post('/upload', upload.single('myFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

        const database = client.db(dbName);
        const receiptsCollection = database.collection("receipts");
        const receiptDocument = {
            hash: hash,
            timestamp: new Date()
        };
        await receiptsCollection.insertOne(receiptDocument);

        const link = "https://linkproof.co/proof/" + hash;
        res.json({ link: link });
    } catch (error) {
        console.error("Error processing file upload:", error);
        res.status(500).send("An error occurred during upload.");
    }
});

// This handles requests for the proof pages (e.g., /proof/c207e5...)
app.get('/proof/:hash', async (req, res) => {
    const hash = req.params.hash;

    const database = client.db(dbName);
    const receiptsCollection = database.collection("receipts");
    const receipt = await receiptsCollection.findOne({ hash: hash });

    if (!receipt) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Receipt Not Found</title>
                <script src="https://cdn.tailwindcss.com"></script>
            </head>
            <body class="bg-gray-900 text-white font-sans flex flex-col items-center justify-center min-h-screen">
                <div class="bg-gray-800 p-8 rounded-xl shadow-lg w-11/12 max-w-md text-center">
                    <h1 class="text-6xl font-bold text-red-500 mb-4">404</h1>
                    <h2 class="text-2xl font-semibold text-gray-200 mb-2">Receipt Not Found</h2>
                    <p class="text-gray-400 mb-6">The digital receipt you are looking for does not exist.</p>
                    <a href="/" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors duration-200">Go to Homepage</a>
                </div>
                <footer class="mt-12 text-center text-sm text-gray-500">
                    <p>&copy; 2025 All rights reserved to Muhammad Langdi.</p>
                </footer>
            </body>
            </html>
        `);
    }

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

// ADDED: New routes for the "Verify" feature

// This serves the "Verify" page
app.get('/verify', (req, res) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify a File</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-white font-sans flex flex-col items-center justify-center min-h-screen">
            <div class="bg-gray-800 p-8 rounded-xl shadow-lg w-11/12 max-w-2xl text-center">
                <h1 class="text-4xl md:text-5xl font-bold mb-4">Verify a File</h1>
                <p class="text-gray-400 mb-6">Upload a file to check if a digital receipt already exists for it.</p>

                <form id="verifyForm" class="flex flex-col items-center mb-6">
                    <label for="file-upload" class="cursor-pointer">
                        <div class="border-2 border-dashed border-gray-600 rounded-lg p-12 w-full max-w-lg mb-4 hover:border-blue-500 transition-colors duration-200">
                            <p class="text-gray-400 mb-2">Drag & Drop a file here or</p>
                            <button type="button" class="bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">Click to upload</button>
                            <input id="file-upload" name="myFile" type="file" class="hidden" />
                        </div>
                    </label>
                </form>

                <p class="text-gray-400 text-sm mt-2">Maximum file size is 5MB.</p>

                <p id="responseMessage" class="text-gray-300 text-sm"></p>
                <a id="linkProof" href="#" class="text-blue-400 hover:text-blue-300 transition-colors duration-200 hidden mt-4"></a>

                <footer class="mt-8 text-center text-sm text-gray-500">
                    <p>&copy; 2025 All rights reserved to Muhammad Langdi.</p>
                </footer>
            </div>

            <script>
                const fileInput = document.getElementById('file-upload');
                const uploadButton = document.querySelector('button');
                const responseMessage = document.getElementById('responseMessage');

                uploadButton.addEventListener('click', () => {
                    fileInput.click();
                });

                fileInput.addEventListener('change', async (event) => {
                    const file = event.target.files[0];
                    if (!file) {
                        return;
                    }

                    responseMessage.textContent = 'Checking...';
                    responseMessage.classList.add('text-yellow-400');

                    const formData = new FormData();
                    formData.append('myFile', file);

                    try {
                        const response = await fetch('/verify', {
                            method: 'POST',
                            body: formData,
                        });

                        const result = await response.json();

                        if (response.ok) {
                            if (result.exists) {
                                responseMessage.textContent = 'Digital receipt found!';
                                responseMessage.classList.remove('text-yellow-400');
                                responseMessage.classList.add('text-green-400');
                            } else {
                                responseMessage.textContent = 'No digital receipt found.';
                                responseMessage.classList.remove('text-yellow-400');
                                responseMessage.classList.add('text-red-400');
                            }
                        } else {
                            responseMessage.textContent = 'An error occurred during verification.';
                            responseMessage.classList.remove('text-yellow-400');
                            responseMessage.classList.add('text-red-400');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        responseMessage.textContent = 'An error occurred during verification.';
                        responseMessage.classList.remove('text-yellow-400');
                        responseMessage.classList.add('text-red-400');
                    }
                });
            </script>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// This is the "Verify" upload endpoint
app.post('/verify', upload.single('myFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    try {
        const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

        const database = client.db(dbName);
        const receiptsCollection = database.collection("receipts");
        const receipt = await receiptsCollection.findOne({ hash: hash });

        res.json({ exists: !!receipt });
    } catch (error) {
        console.error("Error verifying file:", error);
        res.status(500).send("An error occurred during verification.");
    }
});

// This is the custom 404 page. It must come LAST in your code.
app.use((req, res, next) => {
    const htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Page Not Found</title>
            <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-gray-900 text-white font-sans flex flex-col items-center justify-center min-h-screen">
            <div class="bg-gray-800 p-8 rounded-xl shadow-lg w-11/12 max-w-md text-center">
                <h1 class="text-6xl font-bold text-red-500 mb-4">404</h1>
                <h2 class="text-2xl font-semibold text-gray-200 mb-2">Page Not Found</h2>
                <p class="text-gray-400 mb-6">The page you are looking for does not exist or has been moved.</p>
                <a href="/" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition-colors duration-200">Go to Homepage</a>
            </div>
            <footer class="mt-12 text-center text-sm text-gray-500">
                    <p>&copy; 2025 All rights reserved to Muhammad Langdi.</p>
            </footer>
        </body>
        </html>
    `;
    res.status(404).send(htmlContent);
});

// This tells Vercel to use your Express app for all requests.
module.exports = app;
