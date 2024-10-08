import db from "../utils/db"
import nano from "../nano"
import {convert, Unit} from "nanocurrency";
import {Tweet, User} from "../scraper"
import {getUserFromUsername, replyToTweet} from "../twitter";
import {parseTip} from "./parseTip";
import {getGPTFunResponse} from "./funResponse";
import {extractNanoAddress} from "../utils";

export async function handleMention(tweet: Tweet, user: User): Promise<void> {
    console.log(`Handling mention from ${user.screen_name}: ` + tweet.full_text)

    try {
        await db.tweets.create({data: {id: tweet.id_str}});
    } catch (error) {
        console.log("Already processed this tweet");
        return;
    }

    const tipsToday = await db.tips.count({
        where: {
            fromUserId: tweet.user_id_str,
            date: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            }
        }
    });

    console.log(`Tips today for user ${user.screen_name}: `, tipsToday);

    if (tipsToday >= 5) {
        console.log(`User ${tweet.user_id_str} hit the rate limit.`);
        return;
    }

    let recipientUserId = tweet.in_reply_to_user_id_str;
    let recipientUsername = tweet.in_reply_to_screen_name;
    const parsedTip = await parseTip(tweet.full_text);

    if (!parsedTip) {
        console.log(`Couldn't parse tip from tweet: ${tweet.full_text}`);
        return;
    }

    console.log(parsedTip)

    if (parsedTip.recipient && parsedTip.recipient.charAt(0) === '@') {
        console.log(`recipient was specified`);
        const username = parsedTip.recipient!.slice(1).toLowerCase();
        const recipientMention = tweet.entities.user_mentions.find(user => user.screen_name.toLowerCase() === username);

        if (!recipientMention) {
            console.log(`Recipient ${parsedTip.recipient} was not found in user mentions`);
            const fetched_user = await getUserFromUsername(username);
            if (!fetched_user || !fetched_user.id) {
                console.log(`Recipient ${parsedTip.recipient} does not exist.`);
                return;
            }
            recipientUserId = fetched_user.id;
            recipientUsername = fetched_user.username;
            console.log(`fetched recipient ${recipientUsername} using API, id: ${recipientUserId}`)
        } else {
            recipientUserId = recipientMention.id_str;
            recipientUsername = recipientMention.screen_name;
            console.log(`found recipient ${recipientUsername} in user mentions with id ${recipientUserId}`)
        }
    } else if (!tweet.in_reply_to_status_id_str) {
        console.log("Mentioned in a top-level post without specifying recipient, ignoring")
        return;
    } else {
        console.log(`recipient was NOT specified`);
    }

    const excluded_user_ids = tweet.entities.user_mentions
        .map((mention) => mention.id_str)
        .filter((id) => id !== recipientUserId);

    const recipient = await getUser(recipientUserId);
    const sender = await getUser(tweet.user_id_str);

    await updateUsername(recipientUserId, recipientUsername);
    await updateUsername(tweet.user_id_str, user.screen_name);

    try {
        const amountRaw = convert(parsedTip.amount, {from: Unit.Nano, to: Unit.raw});
        const destination = recipient.account;
        const source = sender.account;
        const block = await nano.send(destination, source, amountRaw, tweet.id_str);

        await db.tips.create({
            data: {
                hash: block,
                amount: parsedTip.amount,
                toUserId: recipientUserId,
                fromUserId: tweet.user_id_str,
                tweetId: tweet.id_str
            }
        });

        const response = await getGPTFunResponse(parsedTip.amount, user.screen_name, recipientUsername, tweet.full_text);
        await replyToTweet(tweet.id_str, response, excluded_user_ids);
    } catch (e) {
        console.log(`Failed to execute tip for ${tweet.user_id_str}: ${e}`);
    }

    return;
}

export async function handleGiveaway(tweet: Tweet, user: User) {
    // if (user.followers_count < 100 && !user.ext_is_blue_verified) {
    //     console.log("User didn't meet the requirements for the giveaway.");
    //     return;
    // }

    const address = extractNanoAddress(tweet.full_text);

    if (!address) {
        console.log("Couldn't parse address from giveaway reply");
        return;
    }

    try {
        await db.giveawayParticipants.create({
            data: {
                userId: tweet.user_id_str,
                giveawayPostId: "1834083324156854678",
                tweetId: tweet.id_str,
                address: address,
            }
        });
    } catch (e) {
        console.log(`${user.screen_name} has already participated in this giveaway`);
        return;
    }

    try {
        await nano.send(address, "nano_1yu3u8zq9s9wgr6anjseqsuzg7d3ezns8yf3mwwexc75bypwhyw3y69xymen", "10000000000000000000000000000", tweet.id_str);
        console.log("Successfully handled giveaway reply from " + user.screen_name);
    } catch (e) {
        console.error(`Failed to send nano to ${user.screen_name} for giveaway: ${e}`)
    }
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