import {Page} from "puppeteer-core";
import bot from "../bot"
import {createCursor, GhostCursor, installMouseHelper} from "ghost-cursor";
import {replyToTweet} from "../twitter";

type User = {
    id_str: string;
    screen_name: string;
}

interface MessageData {
    text: string;
    sender_id: string;
    id: string;
}

interface Entry {
    message: {
        message_data: MessageData;
        conversation_id: string
    } | undefined;
}

interface UserEventsResponse {
    user_events: {
        entries: Entry[] | undefined;
        users: { [key: string]: User } | undefined;
        conversations: { [key: string]: { trusted: boolean} } | undefined;
    };
}

export type Tweet = {
    id_str: string;
    full_text: string;
    entities: {
        user_mentions: Array<{
            id_str: string;
        }>;
    };
    in_reply_to_user_id_str: string;
    in_reply_to_screen_name: string;
    user_id_str: string;
};

type GlobalObjects = {
    globalObjects: {
        tweets?: Record<string, Tweet>;
    };
};

export default class Scraper {
    private readonly page: Page;
    private replyQueue: Promise<void> = Promise.resolve();
    private cursor: GhostCursor;

    constructor(page: Page) {
        this.page = page;
        this.cursor = createCursor(this.page, {x: 476, y: 167}, false, {
            click: {
                hesitate: 48,
                randomizeMoveDelay: true,
                moveDelay: 2000,
            },
            move: {
                paddingPercentage: 20
            }
        });

        page.on("response", async (response) => {
            if (response.url().includes("/i/api/1.1/dm/user_updates.json")) {
                const res: UserEventsResponse = await response.json();

                const entries = res.user_events?.entries ?? [];
                const users = res.user_events?.users ?? {};
                const conversations = res.user_events?.conversations ?? {};

                for (const entry of entries) {
                    if (entry.message) {
                        const { sender_id, text, id } = entry.message.message_data;

                        if (sender_id === process.env.X_USER_ID!) {
                            continue
                        }

                        const trusted = conversations[entry.message.conversation_id].trusted;

                        console.log(`Received message ${id} from ${users[sender_id].screen_name}: ${text}`);

                        bot.handleMessage(text, sender_id, id).then(botResponse => {
                            if (botResponse) {
                                console.log(`Queued a response to message ${id} for user ${users[sender_id].screen_name}: ${botResponse}`);
                                this.queueReply(users[sender_id].screen_name, botResponse, trusted);
                            }
                        });
                    }
                }
            }

            if (response.url().includes("/i/api/2/notifications/all.json")) {
                const res: GlobalObjects = await response.json();

                if (res.globalObjects.tweets) {
                    for (const tweet of Object.values(res.globalObjects.tweets)) {
                        const userMentioned = tweet.entities.user_mentions.some(
                            (mention) => mention.id_str === process.env.X_USER_ID!
                        );

                        if (userMentioned) {
                            console.log({
                                id_str: tweet.id_str,
                                user_id_str: tweet.user_id_str,
                                in_reply_to_user_id_str: tweet.in_reply_to_user_id_str,
                                full_text: tweet.full_text,
                            });

                            console.log(`Bot was mentioned in tweet ${tweet.id_str}: ${tweet.full_text}`);

                            bot.handleMention(tweet).then(botResponse => {
                                if (botResponse) {
                                    replyToTweet(tweet.id_str, botResponse);
                                }
                            });
                        }
                    }
                }
            }
        });

    }

    public start() {
        installMouseHelper(this.page).then(() => {
            void this.page.goto('https://x.com/messages');
        });
    }

    private queueReply(username: string, message: string, trusted: boolean) {
        this.replyQueue = this.replyQueue.then(() => this.reply(username, message, trusted));
    }

    private async reply(username: string, message: string, trusted: boolean) {
        if (!trusted) {
            console.log(`Conversation with ${username} is a message request, heading there now`)
            await this.page.waitForSelector(`a[href="/messages/requests"]`);
            await this.cursor.click(`a[href="/messages/requests"]`);
        }

        console.log(`Waiting for conversation with ${username}`)

        try {
            await this.page.waitForSelector(`div[data-testid="conversation"]:has(a[href="/${username}"]) > div > div:nth-child(2)`);
        } catch (error) {
            console.error(`Failed to get conversation for ${username}`);
            return
        }

        console.log(`Found conversation with ${username}, now replying.`)
        await this.cursor.click(`div[data-testid="conversation"]:has(a[href="/${username}"]) > div > div:nth-child(2)`);

        if (!trusted) {
            console.log("Waiting for Accept button");
            await this.page.waitForSelector(`div[data-viewportview="true"]:not([data-testid]) + * button`);
            console.log("Found accept button!");
            await this.cursor.click(`div[data-viewportview="true"]:not([data-testid]) + * button`)
        }

        await this.page.waitForSelector('div[data-testid="dmComposerTextInput_label"]');
        await this.cursor.click('div[data-testid="dmComposerTextInput_label"]')
        await this.page.keyboard.type(message, {delay: 20});
        await this.page.keyboard.press('Enter');
    }
}