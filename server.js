// This imports all the tools we need for our server.
const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const session = require('express-session');
const nodemailer = require('nodemailer');
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

// NEW: Serve static files from the 'public' directory
app.use(express.static('public'));

// Database connection setup
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = "linkproof-db";

// Nodemailer Transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Helper function to send email
const sendProofEmail = (to, filename, link) => {
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: to,
        subject: `Your LinkProof Receipt for "${filename}"`,
        html: `
            <p>Hello,</p>
            <p>Your digital receipt has been created successfully on LinkProof.co.</p>
            <p><strong>File Name:</strong> ${filename}</p>
            <p><strong>Link to your Proof:</strong> <a href="${link}">${link}</a></p>
            <p>This is a permanent, public record of your file's existence.</p>
            <p>Thank you for using LinkProof.co!</p>
        `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error sending email:', error);
        }
        console.log('Email sent:', info.response);
    });
};

// Connect to the database once when the server starts
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

// REMOVED: app.get('/') route is no longer needed
// The express.static('public') line handles serving index.html automatically

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
    const filename = req.body.filename;
    const email = req.body.email;
    try {
        const hash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const receiptsCollection = getDb().collection("receipts");
        const receiptDocument = {
            hash: hash,
            timestamp: new Date(),
            userId: new ObjectId(req.session.userId),
            filename: filename,
            email: email
        };
        await receiptsCollection.insertOne(receiptDocument);
        const link = `https://linkproof.co/proof/${hash}`;
        res.json({ link: link });

        // NEW: Send the email if an email address was provided
        if (email) {
            sendProofEmail(email, filename, link);
        }

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
