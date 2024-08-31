# Nano Tipper Bot

## How to start tipping

This is Nano tip bot for post-Musk Twitter/X designed around the pitiful API availability.

To use the tip bot you can head to https://bot.thenano.wiki to link your X account and deposit some Nano.

To make a tip simply reply to a tweet and mention @NanoTipperBot using the command `!tip [amount]`

You cannot specify the recipient because it would put such a massive strain on X's server to lookup the user ID that you would need to pay hundreds of dollars per month.

Note that this bot doesn't work on communites including The Nano Community because of API limitations.

## Run this tip bot yourself

1. Setup Pippin Nano Wallet.
2. Register an automated X bot account and developer account.
3. Host the frontend https://github.com/dylan1951/nano-tipper-bot-svelte
4. Ensure the frontend and backend share the same domain and are secured with HTTPS.
5. Register the X OAuth callback url in the developer portal.
6. Set up all environment variables specified in .env.example 
7. Start a chrome browser in remote debugging mode and login to the bot account.
8. `npm install`
9. `npx prisma db push`
10. `npm run patch`
11. `npm run start`
12. Enter the websockets CDP url for your browser.

## Contributing

Feel free to offer any suggestions or feature requests in the issues page.
