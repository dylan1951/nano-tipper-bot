import 'dotenv/config'
import puppeteer from "puppeteer-core";
import readline from 'node:readline';
import Scraper from "./scraper";
import app from "./api";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

app.listen(process.env.PORT, () => {
    console.log(`App listening on port ${process.env.PORT}`);

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
});

