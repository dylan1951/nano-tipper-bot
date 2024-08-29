import 'dotenv/config'
import puppeteer from "puppeteer-core";
import readline from 'node:readline';
import Scraper from "./scraper";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question(`Websocket URL: `, async url => {
    rl.close();

    const browser = await puppeteer.connect({browserWSEndpoint: url});
    const page = await browser.newPage()
    await page.setViewport(null);
    new Scraper(page).start();
});