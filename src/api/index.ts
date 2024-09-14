import express, { Express, Request, Response } from "express"
import cors from 'cors';
import {TwitterApi} from "twitter-api-v2";
import {getUser, handleGiveaway, handleMention, updateUsername} from "../bot";
import nano from "../nano";
import {checkAddress, convert, Unit} from "nanocurrency";
import cookieParser from "cookie-parser";
import db from "../utils/db";
import {getTweetRateLimit} from "../twitter";
import { RateLimiterMemory } from "rate-limiter-flexible";
import {Tweet, User} from "../scraper";

const asyncHandler = (fn: Function) => (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const withdrawRateLimiter = new RateLimiterMemory({
    points: 2,
    duration: 60,
});

const balanceRateLimiter = new RateLimiterMemory({
    points: 10,
    duration: 60,
});

const codeVerifiers = new Map();

const app: Express = express();

const corsOptions = {
    origin: `${process.env.FRONT_END_URL!}`,
    credentials: true,
}

app.use(cors(corsOptions));
app.use(cookieParser(process.env.COOKIE_SECRET!));
app.use(express.json());

const CALLBACK_URL = `${process.env.BACK_END_URL!}/callback`;

app.get("/rate-limit", asyncHandler(async (req: Request, res: Response) => {
    res.json(await getTweetRateLimit());
}));

/**
 * This endpoint is for submitting mentions gathered externally (a browser running on another machine). It is secured
 * with an API key.
 */
app.post("/mention", asyncHandler(async (req: Request, res: Response) => {
    if (!req.headers.authorization || req.headers.authorization !== process.env.SCRAPER_API_KEY) {
        return res.sendStatus(401);
    }

    if (!req.body.tweet) {
        return res.sendStatus(400);
    }

    const tweet: Tweet = req.body.tweet;
    const user: User = req.body.user;

    const [start, end] = tweet.display_text_range;
    const displayText = tweet.full_text.slice(start, end);

    if (tweet.in_reply_to_status_id_str === "1834083324156854678") {
        void handleGiveaway(tweet, user);
    } else if (/@nanosprinkle/i.test(displayText)) {
        void handleMention(tweet, user);
    }

    return res.sendStatus(200);
}));

app.get("/tips", asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    const skip = (page - 1) * pageSize;

    try {
        const tips = await db.tips.findMany({
            skip: skip,
            take: pageSize,
            orderBy: {
                date: 'desc'
            },
            include: {
                to: true,
                from: true
            }
        });

        return res.json(tips);
    } catch (error) {
        console.error("Error fetching tips:", error);
        return res.status(500).json({ error: "Failed to fetch tips" });
    }
}));

/**
 * A user endpoint for making withdrawals secured with a signed cookie containing the X user id.
 */
app.post("/withdraw", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.signedCookies.user_id;

    if (!userId) {
        return res.status(401).send('Authentication required');
    }

    const amount = req.body.amount;
    const address = req.body.address;

    if (!checkAddress(address)) {
        return res.status(400).send('Invalid address');
    }

    let amountRaw = null;

    try {
        amountRaw = convert(amount, {from: Unit.Nano, to: Unit.raw});
    } catch {
        return res.status(400).send('Invalid amount');
    }

    const user = await getUser(userId);

    try {
        await withdrawRateLimiter.consume(userId);
        const block = await nano.send(address, user.account, amountRaw);
        console.log(`${user.username} withdrew ${amount} Nano to ${address}`);
        return res.json({ block: block });
    } catch (e) {
        if (e instanceof Error) {
            return res.status(400).send(e.message);
        }
        throw e;
    }
}));

app.post("/receive", asyncHandler(async (req: Request, res: Response) => {
    const userId = req.signedCookies.user_id;

    if (!userId) {
        return res.status(401).send('Authentication required');
    }

    const receivable = req.body.block;
    const user = await getUser(userId);
    await nano.receive(user.account, receivable);

    try {
        await db.tips.update({
            where: {
                hash: receivable
            },
            data: {
                claimed: true
            }
        });
    } catch (e) {
        console.log("not a tip");
    }

    return res.sendStatus(200);
}));

/**
 * A user endpoint for retrieving account information secured with a signed cookie containing the X user id.
 */
app.get('/account', asyncHandler(async (req: Request, res: Response) => {
    const userId = req.signedCookies.user_id;

    if (!userId) {
        return res.status(401).send('Authentication required');
    }

    try {
        await balanceRateLimiter.consume(userId);
    } catch (e) {
        return res.status(400).send('Hit rate limit');
    }

    const user = await getUser(userId);

    console.log(`${user.username} requested their account balance`);

    const tipsToday = await db.tips.count({
        where: {
            fromUserId: user.id,
            date: {
                gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            }
        },
    });

    const unclaimedTips = await db.tips.findMany({
        where: {
            toUserId: user.id,
            claimed: false,
            refundHash: null
        },
        include: {
            from: true,
        }
    });

    const balance = await nano.balance(user.account);

    return res.json({
        account: user.account,
        balance: balance.balance,
        receivable: balance.receivable,
        username: user.username,
        tipsToday: tipsToday,
        unclaimedTips: unclaimedTips
    });
}));

app.get('/authenticate', asyncHandler(async (req: Request, res: Response) => {
    const client = new TwitterApi({ clientId: process.env.X_CLIENT_ID!, clientSecret: process.env.X_CLIENT_SECRET! });
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL, { scope: ['tweet.read', 'users.read'] });
    const redirectUrl = new URL(url);
    redirectUrl.host = 'x.com';

    codeVerifiers.set(state, codeVerifier);
    res.redirect(redirectUrl.toString());
}));

app.get('/callback', asyncHandler(async (req: Request, res: Response) => {
    const { state, code } = req.query;
    const codeVerifier = codeVerifiers.get(state);
    codeVerifiers.delete(state);

    if (!state || !code || !codeVerifier) {
        return res.status(400).send('You denied the app or your session expired!');
    }

    const client = new TwitterApi({ clientId: process.env.X_CLIENT_ID!, clientSecret: process.env.X_CLIENT_SECRET! });

    try {
        const { client: loggedClient } = await client.loginWithOAuth2({ code: code as string, codeVerifier, redirectUri: CALLBACK_URL })
        const user = await loggedClient.v2.me();
        await getUser(user.data.id);
        await updateUsername(user.data.id, user.data.username);
        const oneYearInMilliseconds = 31536000000;

        return res.cookie('user_id', user.data.id, {
            httpOnly: true,
            secure: true,
            sameSite: 'none',
            signed: true,
            maxAge: oneYearInMilliseconds,
            expires: new Date(Date.now() + oneYearInMilliseconds)
        }).redirect(`${process.env.FRONT_END_URL!}/dashboard`);

    } catch (e) {
        console.error(e);
        res.status(403).send('Invalid verifier or access tokens!');
    }
}));

export default app;