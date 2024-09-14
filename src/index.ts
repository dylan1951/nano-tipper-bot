import 'dotenv/config'
import app from "./api";
import * as https from "node:https";
import fs from 'fs'
import db from "./utils/db";
import nano from './nano';
import {convert, Unit} from "nanocurrency";

if (process.env.SSL) {
    https.createServer({
        key: fs.readFileSync(`/etc/letsencrypt/live/api.bot.thenano.wiki/privkey.pem`),
        cert: fs.readFileSync(`/etc/letsencrypt/live/api.bot.thenano.wiki/fullchain.pem`)
    }, app).listen(443, () => {
        console.log("API listening on port 443 using SSL");
    });
} else {
    app.listen(process.env.PORT, () => {
        console.log(`API listening on port ${process.env.PORT}`);
    });
}

const refundTips = async () => {
    console.log('Checking for tips to refund');

    const toRefund = await db.tips.findMany({
        where: {
            claimed: false,
            refundHash: null,
            date: {
                lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
            },
        },
        include: {
            to: true,
            from: true
        }
    });

    console.log(`Refunding ${toRefund.length} tips`);

    for (const tip of toRefund) {
        console.log(`Refunding tip ${tip.hash}`)
        try {
            const amountRaw = convert(tip.amount, {from: Unit.Nano, to: Unit.raw});
            await nano.receive(tip.to.account, tip.hash);
            console.log(`Successfully received ${tip.hash} during the refund process`)

            const block = await nano.send(tip.from.account, tip.to.account, amountRaw);

            await db.tips.update({
                where: {
                    hash: tip.hash
                },
                data: {
                    refundHash: block
                }
            });

            console.log(`Successfully refunded tip ${tip.hash}: ${block}`)
        } catch (e) {
            console.error(`Failed to refund tip ${tip.hash}: ${e}`);
        }
    }
};

void refundTips();

// check for refunds every hour
setInterval(refundTips, 1000*60*60);
