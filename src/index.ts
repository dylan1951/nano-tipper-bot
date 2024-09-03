import 'dotenv/config'
import app from "./api";
import * as https from "node:https";
import fs from 'fs'

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