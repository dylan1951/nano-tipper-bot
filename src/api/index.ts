import express, { Express } from "express"
import cors from 'cors';
import {TwitterApi} from "twitter-api-v2";
import cookieParser from 'cookie-parser'
import {getAccountForUser} from "../bot";
import nano, {balance} from "../nano";
import {checkAddress, convert, Unit} from "nanocurrency";

const oauthSecrets = new Map();

const app: Express = express();

const corsOptions = {
    origin: `http://${process.env.FRONT_END_HOST!}`,
    credentials: true,
}

app.use(cors(corsOptions));
app.use(cookieParser(process.env.COOKIE_SECRET!));
app.use(express.json());

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

    const account = await getAccountForUser(userId);

    try {
        const block = await nano.send(address, account, amountRaw);
        return res.json({ block: block });
    } catch (e) {
        if (e instanceof Error) {
            return res.status(400).send(e.message);
        }
        throw e;
    }
});

app.get('/account', async (req, res) => {
    const userSession = req.signedCookies.user_id;

    if (!userSession) {
        return res.status(401).send('Authentication required');
    }

    const account = await getAccountForUser(userSession);

    return res.json({
        account: account,
        balance: await balance(account)
    });
});

app.get('/authenticate', async (req , res) => {
    const client = new TwitterApi({appKey: process.env.X_APP_KEY!, appSecret: process.env.X_APP_SECRET!});
    const authLink = await client.generateAuthLink(`http://${process.env.BACK_END_HOST!}/callback`);
    oauthSecrets.set(authLink.oauth_token, authLink.oauth_token_secret);
    res.redirect(authLink.url);
});

app.get('/callback', async (req, res) => {
    const { oauth_token, oauth_verifier } = req.query;
    const oauth_token_secret = oauthSecrets.get(oauth_token);
    oauthSecrets.delete(oauth_token);

    if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
        return res.status(400).send('You denied the app or your session expired!');
    }

    const client = new TwitterApi({
        appKey: process.env.X_APP_KEY!,
        appSecret: process.env.X_APP_SECRET!,
        accessToken: oauth_token as string,
        accessSecret: oauth_token_secret as string
    });

    try {
        const { client: loggedClient } = await client.login(oauth_verifier as string);
        const user = await loggedClient.v2.me();
        console.log("user: " + user.data.username);
        res.cookie('user_id', user.data.id, {
            httpOnly: true,
            // secure: true,
            sameSite: 'none',
            signed: true,
            maxAge: 31536000,
            expires: new Date(Date.now() + 31536000)
        });
        console.log("set cookie")
        res.redirect(`http://${process.env.FRONT_END_HOST!}/dashboard`);
    } catch (e) {
        res.status(403).send('Invalid verifier or access tokens!');
    }
});

export default app;