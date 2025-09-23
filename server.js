const express = require('express');
const path = require('path');
const app = express();

app.get('/', (req, res) => {
    res.send('<h1>Hello, LinkProof!</h1>');
});

app.listen(3000, () => {
    console.log('App listening on port 3000');
});
