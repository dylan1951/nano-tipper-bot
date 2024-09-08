import 'dotenv/config'
import puppeteer, {Page} from "puppeteer-core";
import readline from "node:readline";

export type Tweet = {
    id_str: string;
    full_text: string;
    entities: {
        user_mentions: Array<{
            id_str: string;
            screen_name: string;
        }>;
    };
    in_reply_to_user_id_str: string;
    in_reply_to_screen_name: string;
    user_id_str: string;
    in_reply_to_status_id_str: string;
    user_screen_name: string;
};

type User = {
    id_str: string;
    screen_name: string;
}

type GlobalObjects = {
    globalObjects: {
        tweets?: Record<string, Tweet>;
        users?: Record<string, User>
    };
};

class Index {
    private readonly page: Page;

    constructor(page: Page) {
        this.page = page;

        page.on("response", async (response) => {
            if (response.url().includes("/i/api/2/notifications/all.json")) {
                const res: GlobalObjects = await response.json();

                if (res.globalObjects.tweets && res.globalObjects.users) {
                    for (const tweet of Object.values(res.globalObjects.tweets)) {

                        const botMentioned = tweet.entities.user_mentions.some(
                            (mention) => mention.id_str === process.env.X_USER_ID!
                        );

                        tweet.user_screen_name = res.globalObjects.users[tweet.user_id_str].screen_name;

                        if (botMentioned) {
                            console.log(`Bot was mentioned in tweet ${tweet.id_str}: ${tweet.full_text}`);

                            await fetch(`${process.env.BACK_END_URL!}/mention`, {
                                method: "POST",
                                headers: {
                                    'Authorization': process.env.SCRAPER_API_KEY!,
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    tweet: tweet
                                })
                            });
                        }
                    }
                }
            }
        });

    }

    public start() {
        void this.page.goto('https://x.com/notifications');
    }
}

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
});

rl.question(`Websocket URL: `, async url => {
    rl.close();

    const browser = await puppeteer.connect({browserWSEndpoint: url});

    for (const page of await browser.pages()) {
        await page.close();
    }

    const page = await browser.newPage();
    await page.setViewport(null);
    new Index(page).start();
});