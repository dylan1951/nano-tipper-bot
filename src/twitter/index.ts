import {TwitterApi, UserV2} from "twitter-api-v2";
import { TwitterApiRateLimitPlugin } from '@twitter-api-v2/plugin-rate-limit'
import storage from 'node-persist';

void storage.init();

const rateLimitPlugin = new TwitterApiRateLimitPlugin()

const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!,
    appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_SECRET!
}, { plugins: [rateLimitPlugin] });

export async function replyToTweet(tweet_id: string, message: string, excluded_user_ids: string[]) {
    console.log(`Replying to tweet ${tweet_id}: ${message}`);

    if (!tweet_id) {
        return
    }

    await twitterClient.v2.tweet(message, {
        reply: {
            in_reply_to_tweet_id: tweet_id,
            exclude_reply_user_ids: excluded_user_ids,
        }
    });

    const rateLimit = rateLimitPlugin.v2.getRateLimit('tweets', 'POST');
    await storage.setItem('tweet-rate-limit', rateLimit);
}

export async function getUserFromUsername(username: string) : Promise<UserV2 | null> {
    console.log(`Fetching user for ${username} using V2 API`);

    const user = await twitterClient.v2.userByUsername(username);

    if (user && user.data) {
        return user.data;
    }

    return null;
}

export async function getTweetRateLimit() {
    return await storage.getItem('tweet-rate-limit');
}
