import 'dotenv/config'
import puppeteer from "puppeteer-core";
import readline from 'node:readline';
import Scraper from "./scraper";
import app from "./api";
import * as https from "node:https";
import fs from 'fs'

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

if (process.env.SSL) {
    https.createServer({
        key: fs.readFileSync(`/etc/letsencrypt/live/api.bot.thenano.wiki/privkey.pem`),
        cert: fs.readFileSync(`/etc/letsencrypt/live/api.bot.thenano.wiki/fullchain.pem`)
    }, app).listen(443, () => {
        console.log("API listening on port 443 using SSL")
    });
} else {
    app.listen(process.env.PORT, () => {
        console.log(`API listening on port ${process.env.PORT}`)
    });
}

rl.question(`Websocket URL: `, async url => {
    rl.close();

    const browser = await puppeteer.connect({browserWSEndpoint: url});

    for (const page of await browser.pages()) {
        await page.close();
    }

    const page = await browser.newPage()
    await page.setViewport(null);
    new Scraper(page).start();
});

