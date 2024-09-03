import express, { Express } from "express"
import cors from 'cors';
import {TwitterApi} from "twitter-api-v2";
import {getUser, handleMention, updateUsername} from "../bot";
import nano, {balance} from "../nano";
import {checkAddress, convert, Unit} from "nanocurrency";
import cookieParser from "cookie-parser";

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

/**
 * This endpoint is for submitting mentions gathered externally (a browser running on another machine). It is secured
 * with an API key.
 */
app.post("/mention", async (req, res) => {
    if (!req.headers.authorization || req.headers.authorization !== process.env.SCRAPER_API_KEY) {
        return res.sendStatus(401);
    }

    if (!req.body.tweet) {
        return res.sendStatus(400);
    }

    const tweet = req.body.tweet;

    console.log(`Bot was mentioned in tweet ${tweet.id_str}: ${tweet.full_text}`);

    void handleMention(req.body.tweet);

    return res.sendStatus(200);
});

/**
 * A user endpoint for making withdrawals secured with a signed cookie containing the X user id.
 */
app.post("/withdraw", async (req, res) => {
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
        const block = await nano.send(address, user.account, amountRaw);
        console.log(`${user.username} withdrew ${amount} Nano to ${address}`);
        return res.json({ block: block });
    } catch (e) {
        if (e instanceof Error) {
            return res.status(400).send(e.message);
        }
        throw e;
    }
});

/**
 * A user endpoint for retrieving account information secured with a signed cookie containing the X user id.
 */
app.get('/account', async (req, res) => {
    const userId = req.signedCookies.user_id;

    if (!userId) {
        return res.status(401).send('Authentication required');
    }

    const user = await getUser(userId);

    console.log(`${user.username} requested their account balance`);

    return res.json({
        account: user.account,
        balance: await balance(user.account),
        username: user.username
    });
});

app.get('/authenticate', async (req , res) => {
    const client = new TwitterApi({ clientId: process.env.X_CLIENT_ID!, clientSecret: process.env.X_CLIENT_SECRET! });
    console.log("CALLBACK_URL: " + CALLBACK_URL);
    const { url, codeVerifier, state } = client.generateOAuth2AuthLink(CALLBACK_URL);
    codeVerifiers.set(state, codeVerifier);
    res.redirect(url);
});

app.get('/callback', async (req, res) => {
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
});

export default app;