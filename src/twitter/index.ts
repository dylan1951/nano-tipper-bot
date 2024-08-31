import {TwitterApi} from "twitter-api-v2";

const twitterClient = new TwitterApi({
    appKey: process.env.X_APP_KEY!,
    appSecret: process.env.X_APP_SECRET!,
    accessToken: process.env.X_ACCESS_TOKEN!,
    accessSecret: process.env.X_ACCESS_SECRET!
});

export async function replyToTweet(tweet_id: string, message: string) {
    console.log(`Replying to tweet ${tweet_id}: ${message}`);

    if (!tweet_id) {
        return
    }

    await twitterClient.v2.tweet(message, {
        reply: {
            in_reply_to_tweet_id: tweet_id
        }
    });
}