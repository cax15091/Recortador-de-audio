const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');

const app = express();
app.use((req, res, next) => {
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    next();
});
app.use(express.static(__dirname));

const server = app.listen(3000, async () => {
    console.log('Server started');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    await page.goto('http://localhost:3000');
    
    // Simulate file upload
    const fileInput = await page.$('#file-input');
    // Create a dummy audio file
    const fs = require('fs');
    fs.writeFileSync('dummy.mp3', Buffer.alloc(1024));
    await fileInput.uploadFile('dummy.mp3');
    
    // Click process
    await page.click('#process-btn');
    
    // Wait 5 seconds to see logs
    await new Promise(r => setTimeout(r, 5000));
    
    await browser.close();
    server.close();
    console.log('Test finished');
});
