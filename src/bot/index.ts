import db from "../utils/db"
import nano from "../nano"
import {checkAddress, checkAmount, convert, Unit} from "nanocurrency";
import {Tweet} from "../scraper";
import {RateLimiterMemory} from "rate-limiter-flexible";

const perMinuteLimiter = new RateLimiterMemory({points: 3, duration: 60});
const perDayLimiter = new RateLimiterMemory({points: 50, duration: 60 * 60 * 24});
const mentionLimiter = new RateLimiterMemory({points: 5, duration: 60 * 60 * 24});

export async function handleMention(tweet: Tweet): Promise<string | null> {
    console.log("Handling tweet: " + tweet.full_text)

    try {
        await db.tweets.create({data: {id: tweet.id_str}});
    } catch (error) {
        console.log("Already processed this tweet");
        return null;
    }

    const amount = checkTipString(tweet.full_text);

    if (!amount) {
        console.log(`Couldn't parse tip from tweet: ${tweet.full_text}`);
        return null;
    }

    try {
        await mentionLimiter.consume(tweet.user_id_str);
    } catch (e) {
        console.log(`User ${tweet.user_id_str} hit the mention rate limit`);
        return null;
    }

    try {
        const amountRaw = convert(amount, {from: Unit.Nano, to: Unit.raw});
        const destination = (await getUser(tweet.in_reply_to_user_id_str)).account;
        const source = (await getUser(tweet.user_id_str)).account;
        const block = await nano.send(destination, source, amountRaw, tweet.id_str);
        return getFunResponse(amount, tweet.in_reply_to_screen_name, block);
    } catch (e) {
        console.log(`Failed to execute tip for ${tweet.user_id_str}: ${e}`);
    }

    return null;
}

export async function handleMessage(message: string, user_id: string, message_id: string): Promise<string | null> {
    try {
        await perMinuteLimiter.consume(user_id);
        await perDayLimiter.consume(user_id);
    } catch (e) {
        console.log(`User ${user_id} hit the message rate limit`);
        return null;
    }

    if (message === "!account") {
        return (await getUser(user_id)).account;
    }

    if (message === "!balance") {
        const account = (await getUser(user_id)).account;
        return (await nano.balance(account)) + ' Ӿ';
    }

    if (message.startsWith("!send")) {
        const words = message.split(" ");
        if (words.length != 3) {
            return "usage: !send nano_yournanoaddreess 50";
        }
        const [command, address, amount] = words

        if (!checkAddress(address)) {
            return "usage: !send nano_yournanoaddreess 50";
        }

        const account = (await getUser(user_id)).account;

        try {
            const amountRaw = convert(amount, {from: Unit.Nano, to: Unit.raw})
            const block = await nano.send(address, account, amountRaw, message_id)
            return `Send successful. Block hash: ${block}`;
        } catch (e) {
            console.error(e);
            return "usage: !send nano_yournanoaddreess 50";
        }
    }

    return null
}

export async function getUser(user_id: string) {
    return db.$transaction(async (tx) => {
        let user = await tx.users.findUnique({
            where: {
                id: user_id
            }
        });

        if (!user) {
            const account = await nano.createAccount();

            user = await tx.users.create({
                data: {
                    id: user_id,
                    account: account
                }
            });
        }

        return user;
    });
}

export async function updateUsername(user_id: string, username: string) {
    await db.users.update({
        where: {
            id: user_id,
        },
        data: {
            username: username,
        }
    });
}

function checkTipString(input: string): string | null {
    const regex = /!tip\s(\d+(\.\d+)?)$/;
    const match = input.match(regex);

    if (match) {
        return match[1];
    } else {
        return null;
    }
}

function getFunResponse(amount: string, recipient: string, blockHash: string) {
    const nanoTipBotResponses = [
        `💸 Just sent ${amount} Nano to @${recipient}! Block Hash: ${blockHash} 🚀`,
        `Done! ${amount} Nano has been sent to @${recipient}. Block Hash: ${blockHash} 👍`,
        `✨ @${recipient} just got ${amount} Nano! Block Hash: ${blockHash}. Enjoy! 💫`,
        `🚀 Tipped ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Nano on its way! 🌟`,
        `💰 ${amount} Nano sent to @${recipient} with love! Block Hash: ${blockHash} 💙`,
        `🎉 ${amount} Nano just landed in @${recipient}'s wallet! Block Hash: ${blockHash} 🎊`,
        `⚡️ Fast as lightning! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash} 🌩️`,
        `💎 @${recipient} received ${amount} Nano! Block Hash: ${blockHash}. Stay shiny! 🌟`,
        `🚀 Nano delivered! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}.`,
        `🌐 ${amount} Nano has been tipped to @${recipient}! Block Hash: ${blockHash}. Smooth transaction!`,
        `🎁 Gifted ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Spread the joy! 🎀`,
        `💸 Just dropped ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Nano to the moon! 🚀`,
        `🌟 Your tip of ${amount} Nano has been sent to @${recipient}. Block Hash: ${blockHash}. Shine on!`,
        `⚡ Tip successful! ${amount} Nano has been delivered to @${recipient}. Block Hash: ${blockHash}.`,
        `💥 Boom! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}. That was quick!`,
        `💫 ${amount} Nano just flew to @${recipient}! Block Hash: ${blockHash}. Nano in action!`,
        `📬 You've got mail! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}.`,
        `🏅 ${amount} Nano sent to @${recipient}! Block Hash: ${blockHash}. Nano tipping like a pro!`,
        `🎯 Direct hit! ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}.`,
        `🏁 Tip complete! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}. Race you to the next tip!`,
        `🎉 ${amount} Nano tipped to @${recipient}! Block Hash: ${blockHash}. Nano power activated!`,
        `🔗 Your ${amount} Nano tip has been sent to @${recipient}. Block Hash: ${blockHash}. Chain complete!`,
        `💨 Just sent ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Fast and feeless!`,
        `💡 @${recipient} just got ${amount} Nano! Block Hash: ${blockHash}. Bright idea!`,
        `🎁 Tip sent! ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}. Pay it forward!`,
        `🚀 ${amount} Nano has been tipped to @${recipient}. Block Hash: ${blockHash}. All systems go!`,
        `🌈 Sent ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Colorful and feeless!`,
        `🎉 @${recipient} just received ${amount} Nano! Block Hash: ${blockHash}. Party time!`,
        `💥 Tipped ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Nano in action!`,
        `⚡️ ${amount} Nano sent to @${recipient}! Block Hash: ${blockHash}. Lightning speed!`,
        `🌟 ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}. Shining bright!`,
        `📦 Tip complete! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}. Nano package delivered!`,
        `🎁 Tipped ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Nano surprise!`,
        `🚀 ${amount} Nano has landed in @${recipient}'s wallet! Block Hash: ${blockHash}. Nano mission success!`,
        `💸 Just sent ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Nano for the win!`,
        `🌟 ${amount} Nano tipped to @${recipient}. Block Hash: ${blockHash}. Keep shining!`,
        `🔔 Tip alert! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}.`,
        `🏅 ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}. Tip of champions!`,
        `💨 ${amount} Nano has been sent to @${recipient}! Block Hash: ${blockHash}. Speedy transaction!`,
        `🎯 Tip sent! ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}. Right on target!`,
        `📬 You've got Nano! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}.`,
        `🚀 ${amount} Nano has been tipped to @${recipient}. Block Hash: ${blockHash}. Nano launch successful!`,
        `💎 ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}. Shiny and bright!`,
        `💸 Just sent ${amount} Nano to @${recipient}! Block Hash: ${blockHash}. Fast, feeless, Nano!`,
        `🌟 Tip successful! ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}.`,
        `🎉 ${amount} Nano sent to @${recipient}! Block Hash: ${blockHash}. Enjoy the Nano love!`,
        `⚡ ${amount} Nano delivered to @${recipient}. Block Hash: ${blockHash}. Lightning fast!`,
        `📦 ${amount} Nano has been sent to @${recipient}. Block Hash: ${blockHash}. Package delivered!`,
        `🚀 Tip complete! ${amount} Nano sent to @${recipient}. Block Hash: ${blockHash}. All systems go!`
    ];
    const randomIndex = Math.floor(Math.random() * nanoTipBotResponses.length);
    return nanoTipBotResponses[randomIndex];
}

export default {
    handleMessage,
    handleMention
}