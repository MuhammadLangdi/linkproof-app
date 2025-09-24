// This imports all the tools we need for our server.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB in bytes
    }
});

// Set up express-session middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
    secret: 'a-strong-secret-key',
    resave: false,
    saveUninitialized: true
}));

// Database connection setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = "linkproof-db";

// NEW: Connect to the database once when the server starts
async function run() {
    try {
        await client.connect();
        console.log("Connected to MongoDB successfully!");
    } catch (e) {
        console.error("Failed to connect to MongoDB:", e);
    }
}
run().catch(console.dir);

// Helper function to get the database instance
function getDb() {
    return client.db(dbName);
}

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

                <div id="authSection" class="mb-8">
                    <h2 class="text-xl font-bold mb-4">Account</h2>
                    <form id="authForm" class="flex flex-col items-center">
                        <input type="text" id="username" placeholder="Username" class="bg-gray-700 text-white py-2 px-4 rounded-lg w-full max-w-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <input type="password" id="password" placeholder="Password" class="bg-gray-700 text-white py-2 px-4 rounded-lg w-full max-w-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <div class="flex space-x-4">
                            <button type="submit" id="signupBtn" class="bg-blue-500 text-white py-2 px-6 rounded-lg hover:bg-blue-600 transition-colors duration-200">Sign Up</button>
                            <button type="submit" id="loginBtn" class="bg-green-500 text-white py-2 px-6 rounded-lg hover:bg-green-600 transition-colors duration-200">Log In</button>
                        </div>
                    </form>
                    <p id="authMessage" class="text-gray-300 text-sm mt-2"></p>
                </div>
                
                <hr class="border-gray-700 my-8">

                <div id="mainContent" class="hidden">
                    <p id="loggedInStatus" class="text-gray-400 text-sm mb-4"></p>
                    <div id="dashboardSection">
                        <h2 class="text-xl font-bold mb-4">Your Dashboard</h2>
                        <ul id="receiptsList" class="text-left w-full max-w-lg mb-4"></ul>
                    </div>

                    <div id="createProofSection" class="mb-8 mt-8">
                        <h2 class="text-xl font-bold mb-4">Create a new LinkProof</h2>
                        <form id="uploadForm" class="flex flex-col items-center mb-6">
                            <label for="file-upload" class="cursor-pointer">
                                <div class="border-2 border-dashed border-gray-600 rounded-lg p-12 w-full max-w-lg mb-4 hover:border-blue-500 transition-colors duration-200">
                                    <p class="text-gray-400 mb-2">Drag & Drop a file here or</p>
                                    <button type="button" class="bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">Click to upload</button>
                                    <input id="file-upload" name="myFile" type="file" class="hidden" />
                                </div>
                            </label>
                        </form>
                        <p id="responseMessage" class="text-gray-300 text-sm"></p>
                        <a id="linkProof" href="#" class="text-blue-400 hover:text-blue-300 transition-colors duration-200 hidden mt-4"></a>
                    </div>

                    <hr class="border-gray-700 my-8">

                    <div id="verifyProofSection">
                        <h2 class="text-xl font-bold mb-4">Verify a file's existence</h2>
                        <form id="verifyForm" class="flex flex-col items-center mb-6">
                            <label for="verify-file-upload" class="cursor-pointer">
                                <div class="border-2 border-dashed border-gray-600 rounded-lg p-12 w-full max-w-lg mb-4 hover:border-blue-500 transition-colors duration-200">
                                    <p class="text-gray-400 mb-2">Drag & Drop a file here or</p>
                                    <button type="button" class="bg-gray-700 text-white py-2 px-4 rounded-lg hover:bg-gray-600 transition-colors duration-200">Click to verify</button>
                                    <input id="verify-file-upload" name="myFile" type="file" class="hidden" />
                                </div>
                            </label>
                        </form>
                        <p id="verifyMessage" class="text-gray-300 text-sm"></p>
                    </div>

                    <button id="logoutBtn" class="mt-8 bg-red-500 text-white py-2 px-6 rounded-lg hover:bg-red-600 transition-colors duration-200">Log Out</button>
                </div>
            </div>

            <footer class="mt-8 text-center text-sm text-gray-500">
                <p>&copy; 2025 All rights reserved to Muhammad Langdi.</p>
            </footer>

            <script>
                // Show/hide sections based on login state
                function showMainContent(username) {
                    document.getElementById('authSection').classList.add('hidden');
                    document.getElementById('mainContent').classList.remove('hidden');
                    document.getElementById('loggedInStatus').textContent = \`You are logged in as: \${username}\`;
                    fetchReceipts(); // Fetch and display user's receipts
                }

                // Redirect to homepage on logout
                document.getElementById('logoutBtn').addEventListener('click', async () => {
                    await fetch('/logout', { method: 'POST' });
                    window.location.href = '/';
                });

                async function fetchReceipts() {
                    const receiptsList = document.getElementById('receiptsList');
                    receiptsList.innerHTML = '<li class="text-center text-gray-400">Loading your receipts...</li>';

                    try {
                        const response = await fetch('/user-receipts');
                        const receipts = await response.json();

                        if (receipts.length > 0) {
                            receiptsList.innerHTML = ''; // Clear loading message
                            receipts.forEach(receipt => {
                                const li = document.createElement('li');
                                li.className = 'flex items-center justify-between py-2';
                                li.innerHTML = \`
                                    <span class="flex items-center space-x-2">
                                        <a href="/proof/\${receipt.hash}" class="text-blue-400 hover:text-blue-300 transition-colors duration-200 font-mono">\${receipt.filename}</a>
                                        <button onclick="copyHashToClipboard('\${receipt.hash}')" class="text-gray-500 hover:text-white focus:outline-none">
                                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                                                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                                            </svg>
                                        </button>
                                    </span>
                                    <span class="text-gray-400 text-sm">\${new Date(receipt.timestamp).toLocaleDateString()}</span>
                                \`;
                                receiptsList.appendChild(li);
                            });
                        } else {
                            receiptsList.innerHTML = '<li class="text-center text-gray-400">No receipts found. Upload a file to get started!</li>';
                        }
                    } catch (error) {
                        console.error('Error fetching receipts:', error);
                        receiptsList.innerHTML = '<li class="text-center text-red-400">Failed to load receipts.</li>';
                    }
                }

                function copyHashToClipboard(hash) {
                    navigator.clipboard.writeText(hash).then(() => {
                        alert('Hash copied to clipboard!');
                    }, (err) => {
                        console.error('Could not copy text: ', err);
                    });
                }

                // Auth form logic
                const authForm = document.getElementById('authForm');
                const usernameInput = document.getElementById('username');
                const passwordInput = document.getElementById('password');
                const authMessage = document.getElementById('authMessage');

                authForm.addEventListener('submit', async (event) => {
                    event.preventDefault();

                    const isSignUp = event.submitter.id === 'signupBtn';
                    const endpoint = isSignUp ? '/signup' : '/login';
                    const payload = {
                        username: usernameInput.value,
                        password: passwordInput.value
                    };

                    authMessage.textContent = 'Processing...';
                    authMessage.classList.add('text-yellow-400');

                    try {
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(payload)
                        });

                        const result = await response.json();

                        if (response.ok) {
                            authMessage.textContent = result.message;
                            authMessage.classList.remove('text-yellow-400');
                            authMessage.classList.add('text-green-400');
                            if (endpoint === '/login') showMainContent(result.user.username);
                            else if (endpoint === '/signup') {
                                usernameInput.value = '';
                                passwordInput.value = '';
                                authMessage.textContent = 'Sign up successful! Please log in now.';
                            }
                        } else {
                            authMessage.textContent = result.message || 'An error occurred.';
                            authMessage.classList.remove('text-yellow-400');
                            authMessage.classList.add('text-red-400');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        authMessage.textContent = 'An error occurred. Please try again.';
                        authMessage.classList.remove('text-yellow-400');
                        authMessage.classList.add('text-red-400');
                    }
                });

                // Create Proof
                const fileInput = document.getElementById('file-upload');
                const uploadButton = document.querySelector('#createProofSection button');
                const responseMessage = document.getElementById('responseMessage');
                const linkProof = document.getElementById('linkProof');

                uploadButton.addEventListener('click', () => {
                    fileInput.click();
                });

                fileInput.addEventListener('change', async (event) => {
                    const file = event.target.files[0];
                    if (!file) return;

                    responseMessage.textContent = 'Uploading...';
                    responseMessage.classList.add('text-yellow-400');
                    linkProof.classList.add('hidden');

                    const formData = new FormData();
                    formData.append('myFile', file);
                    formData.append('filename', file.name);

                    try {
                        const response = await fetch('/upload', {
                            method: 'POST',
                            body: formData,
                        });

                        const result = await response.json();

                        if (response.ok) {
                            responseMessage.textContent = 'Your LinkProof is:';
                            responseMessage.classList.remove('text-yellow-400');
                            responseMessage.classList.remove('text-red-400');
                            linkProof.href = result.link;
                            linkProof.textContent = result.link;
                            linkProof.classList.remove('hidden');
                            window.location.href = result.link;
                        } else {
                            responseMessage.textContent = result.message || 'An error occurred during upload.';
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

                // Verify Proof
                const verifyFileInput = document.getElementById('verify-file-upload');
                const verifyButton = document.querySelector('#verifyProofSection button');
                const verifyMessage = document.getElementById('verifyMessage');

                verifyButton.addEventListener('click', () => {
                    verifyFileInput.click();
                });

                verifyFileInput.addEventListener('change', async (event) => {
                    const file = event.target.files[0];
                    if (!file) return;

                    verifyMessage.textContent = 'Verifying...';
                    verifyMessage.classList.add('text-yellow-400');

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
                                verifyMessage.textContent = 'File verified! A digital receipt for this file exists.';
                                verifyMessage.classList.remove('text-yellow-400');
                                verifyMessage.classList.add('text-green-400');
                            } else {
                                verifyMessage.textContent = 'Verification failed. No digital receipt found for this file.';
                                verifyMessage.classList.remove('text-yellow-400');
                                verifyMessage.classList.add('text-red-400');
                            }
                        } else {
                            verifyMessage.textContent = result.message || 'An error occurred during verification.';
                            verifyMessage.classList.remove('text-yellow-400');
                            verifyMessage.classList.add('text-red-400');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                        verifyMessage.textContent = 'An error occurred during verification.';
                        verifyMessage.classList.remove('text-yellow-400');
                        verifyMessage.classList.add('text-red-400');
                        }
                });
            </script>
        </body>
        </html>
    `;
    res.send(htmlContent);
});

// Signup endpoint
app.post('/signup', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usersCollection = getDb().collection('users');
        const existingUser = await usersCollection.findOne({ username });
        if (existingUser) {
            return res.status(409).json({ message: 'Username already exists.' });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        await usersCollection.insertOne({ username, password: hashedPassword });
        res.status(201).json({ message: 'User created successfully! You can now log in.' });
    } catch (error) {
        console.error("Error during signup:", error);
        res.status(500).json({ message: 'An internal error occurred.' });
    }
});

// Login endpoint
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const usersCollection = getDb().collection('users');
        const user = await usersCollection.findOne({ username });
        if (!user) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid username or password.' });
        }
        req.session.userId = user._id;
        res.status(200).json({ message: 'Logged in successfully!', user: { username: user.username } });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).json({ message: 'An internal error occurred.' });
    }
});

// NEW: Logout endpoint
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('Could not log out.');
        }
        res.status(200).send('Logged out successfully.');
    });
});

// Endpoint to get user-specific receipts
app.get('/user-receipts', async (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    try {
        const receiptsCollection = getDb().collection('receipts');
        const userReceipts = await receiptsCollection.find({ userId: new ObjectId(req.session.userId) }).toArray();
        res.json(userReceipts);
    } catch (error) {
        console.error("Error fetching user receipts:", error);
        res.status(500).json({ message: "An error occurred." });
    }
});

// This is the upload endpoint.
app.post('/upload', upload.single('myFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }
    if (!req.session.userId) {
        return res.status(401).json({ message: 'You must be logged in to create a receipt.' });
    }
    const file = req.file;
    const filename = req.body.filename; // Corrected line
    try {
        const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const receiptsCollection = getDb().collection("receipts");
        const receiptDocument = {
            hash: hash,
            timestamp: new Date(),
            userId: new ObjectId(req.session.userId),
            filename: filename
        };
        await receiptsCollection.insertOne(receiptDocument);
        const link = `https://linkproof.co/proof/${hash}`;
        res.json({ link: link });
    } catch (error) {
        console.error("Error processing file upload:", error);
        res.status(500).json({ message: 'An error occurred during upload.' });
    }
});

// This is the verify endpoint.
app.post('/verify', upload.single('myFile'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded.' });
    }

    try {
        const hash = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
        const receiptsCollection = getDb().collection("receipts");
        const receipt = await receiptsCollection.findOne({ hash: hash });

        if (receipt) {
            res.json({ exists: true });
        } else {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error("Error processing file verification:", error);
        res.status(500).json({ message: 'An error occurred during verification.' });
    }
});

// This handles requests for the proof pages (e.g., /proof/c207e5...)
app.get('/proof/:hash', async (req, res) => {
    const hash = req.params.hash;
    try {
        const receiptsCollection = getDb().collection("receipts");
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
                    <p class="text-gray-400 text-sm mt-4">This receipt was created on **${receipt.timestamp.toUTCString()}**.</p>
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
    } catch (error) {
        console.error("Error processing proof request:", error);
        res.status(500).send("An error occurred.");
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
