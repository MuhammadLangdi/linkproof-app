// This imports all the tools we need for our server.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB in bytes
    }
});

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
app.get('/proof/:hash', (
