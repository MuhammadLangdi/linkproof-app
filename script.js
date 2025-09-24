// This script contains all the client-side logic for LinkProof.co.
// It handles user authentication (login/signup), file uploads, file verification,
// and manages the UI to show and hide sections based on login status.

document.addEventListener('DOMContentLoaded', () => {

    // Helper function to update the user interface based on login status.
    function updateUI(isLoggedIn = false, username = '') {
        const authSection = document.getElementById('authSection');
        const mainContent = document.getElementById('mainContent');
        const loggedInStatus = document.getElementById('loggedInStatus');

        if (isLoggedIn) {
            authSection.classList.add('hidden');
            mainContent.classList.remove('hidden');
            loggedInStatus.textContent = `Welcome, ${username}!`;
        } else {
            authSection.classList.remove('hidden');
            mainContent.classList.add('hidden');
        }
    }

    // Fetches and displays the user's past receipts.
    async function fetchUserReceipts() {
        const receiptsList = document.getElementById('receiptsList');
        receiptsList.innerHTML = ''; // Clear the list before populating.
        try {
            const response = await fetch('/user-receipts');
            if (response.ok) {
                const receipts = await response.json();
                if (receipts.length > 0) {
                    receipts.forEach(receipt => {
                        const listItem = document.createElement('li');
                        const timestamp = new Date(receipt.timestamp).toLocaleString();
                        listItem.innerHTML = `
                            <p class="text-sm font-semibold">${receipt.filename || 'Untitled File'}</p>
                            <p class="text-xs text-gray-500">${timestamp}</p>
                            <a href="/proof/${receipt.hash}" class="text-blue-400 hover:underline text-xs" target="_blank">View Proof Link</a>
                        `;
                        listItem.classList.add('bg-gray-700', 'p-3', 'rounded-lg', 'mb-2');
                        receiptsList.appendChild(listItem);
                    });
                } else {
                    receiptsList.innerHTML = '<p class="text-gray-400 text-sm">No receipts found.</p>';
                }
            }
        } catch (error) {
            console.error("Error fetching receipts:", error);
        }
    }

    // Checks if a user is already logged in when the page loads.
    async function checkLoginStatus() {
        try {
            const response = await fetch('/user-receipts');
            if (response.ok) {
                const userReceipts = await response.json();
                if (userReceipts) {
                    updateUI(true, 'User');
                    fetchUserReceipts();
                }
            } else {
                updateUI(false);
            }
        } catch (error) {
            updateUI(false);
        }
    }
    checkLoginStatus();

    // Get references to HTML elements.
    const authForm = document.getElementById('authForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const authMessage = document.getElementById('authMessage');

    // Add event listener to the entire authentication form.
    // This handles both signup and login button clicks.
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault(); // Prevents the page from reloading on form submission.

        const username = usernameInput.value;
        const password = passwordInput.value;
        const isSignup = e.submitter.id === 'signupBtn';
        const url = isSignup ? '/signup' : '/login';

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await response.json();
            authMessage.textContent = result.message;
            authMessage.style.color = response.ok ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)';

            if (response.ok && !isSignup) {
                updateUI(true, username);
                fetchUserReceipts();
            }
        } catch (error) {
            authMessage.textContent = 'An internal error occurred.';
            authMessage.style.color = 'rgb(239, 68, 68)';
            console.error('Fetch error:', error);
        }
    });

    // File upload section.
    const uploadForm = document.getElementById('uploadForm');
    const fileInput = document.getElementById('file-upload');
    const responseMessage = document.getElementById('responseMessage');
    const linkProof = document.getElementById('linkProof');
    const emailInput = document.getElementById('email');

    // Handles the file upload process.
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = fileInput.files[0];
        const email = emailInput.value;
        if (!file) {
            responseMessage.textContent = 'Please select a file to upload.';
            responseMessage.style.color = 'rgb(239, 68, 68)';
            return;
        }

        responseMessage.textContent = 'Uploading...';
        responseMessage.style.color = 'rgb(147, 197, 253)';
        linkProof.classList.add('hidden');

        const formData = new FormData();
        formData.append('myFile', file);
        formData.append('filename', file.name);
        formData.append('email', email);

        try {
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                responseMessage.textContent = 'File uploaded successfully!';
                responseMessage.style.color = 'rgb(34, 197, 94)';
                linkProof.href = result.link;
                linkProof.textContent = 'View your digital receipt';
                linkProof.classList.remove('hidden');
                fetchUserReceipts();
            } else {
                responseMessage.textContent = result.message || 'An error occurred during upload.';
                responseMessage.style.color = 'rgb(239, 68, 68)';
            }
        } catch (error) {
            responseMessage.textContent = 'An error occurred during upload.';
            responseMessage.style.color = 'rgb(239, 68, 68)';
            console.error('Fetch error:', error);
        }
    });

    // File verification section.
    const verifyForm = document.getElementById('verifyForm');
    const verifyFileInput = document.getElementById('verify-file-upload');
    const verifyMessage = document.getElementById('verifyMessage');

    // Handles file verification.
    verifyForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const file = verifyFileInput.files[0];
        if (!file) {
            verifyMessage.textContent = 'Please select a file to verify.';
            verifyMessage.style.color = 'rgb(239, 68, 68)';
            return;
        }

        verifyMessage.textContent = 'Verifying...';
        verifyMessage.style.color = 'rgb(147, 197, 253)';

        const formData = new FormData();
        formData.append('myFile', file);

        try {
            const response = await fetch('/verify', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();
            if (response.ok) {
                if (result.exists) {
                    verifyMessage.textContent = 'This file has a valid digital receipt!';
                    verifyMessage.style.color = 'rgb(34, 197, 94)';
                } else {
                    verifyMessage.textContent = 'No digital receipt found for this file.';
                    verifyMessage.style.color = 'rgb(239, 68, 68)';
                }
            } else {
                verifyMessage.textContent = 'An error occurred during verification.';
                verifyMessage.style.color = 'rgb(239, 68, 68)';
            }
        } catch (error) {
            verifyMessage.textContent = 'An error occurred during verification.';
            verifyMessage.style.color = 'rgb(239, 68, 68)';
            console.error('Fetch error:', error);
        }
    });

    // Logout button.
    const logoutBtn = document.getElementById('logoutBtn');

    // Handles the logout process.
    logoutBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/logout', {
                method: 'POST'
            });
            if (response.ok) {
                window.location.reload();
            } else {
                console.error('Logout failed.');
            }
        } catch (error) {
            console.error('Logout error:', error);
        }
    });

    // Enables the hidden file input fields to be triggered by button clicks.
    const fileUploadButton = document.getElementById('file-upload-button');
    const verifyFileUploadButton = document.getElementById('verify-file-upload-button');
    const fileInputTrigger = document.getElementById('file-upload');
    const verifyInputTrigger = document.getElementById('verify-file-upload');

    if (fileUploadButton) {
        fileUploadButton.addEventListener('click', () => {
            fileInputTrigger.click();
        });
    }

    if (verifyFileUploadButton) {
        verifyFileUploadButton.addEventListener('click', () => {
            verifyInputTrigger.click();
        });
    }
});
