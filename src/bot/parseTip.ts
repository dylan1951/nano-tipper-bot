import OpenAI from 'openai';

const client = new OpenAI();

export async function parseTip(text: string): Promise<{amount: string, recipient: string | null} | null> {
    const chatCompletion = await client.chat.completions.create({
        messages: [{ role: 'system', content: `You are a Nano (Nanocurrency) tip bot on X/Twitter.
        Your job is to allow people to send Nano to another X user by mentioning you (@NanoSprinkle) and indicating
        they want to make a tip, specifying the amount in Nano and optionally the recipient.
        
        If the recipient is omitted the tip will default to being sent to whomever the user replied to.
        
        You have been mentioned in a tweet. You need to first determine if they are trying to make a tip,
        and if so, extract the amount and optionally the intended recipient of the tip.
        
        You will be provided the full tweet text and your response must be valid, parsable JSON without markdown.
        
        If the tweet is not explicitly requesting a tip to be executed then respond with an empty JSON object.
        
        Only if the user is explicitly requesting that @NanoSprinkle execute the tip then respond with a JSON object with 
        exactly 2 keys: 'amount' and 'recipient'.
        
        The 'amount' is a numeric string.
        'recipient' is either a string beginning with @, or null if the recipient was not specified.
        
        DO NOT USE MARKDOWN. ONLY RESPOND WITH A JSON STRING.` },
            { role: 'user', content: `@Dylan11951 @john @NanoSprinkle tip 0.001`},
            { role: 'assistant', content: `{"amount":"0.001","recipient":null}`},
            { role: 'user', content: `@john you use @NanoSprinkle like this: "@NanoSprinkle send 0.1 to @Nathan"`},
            { role: 'assistant', content: `{}`},
            { role: 'user', content: `Ciao @NanoSprinkle, manda un !tip di 3x a @ilgattolillo!`},
            { role: 'assistant', content: `{"amount":"3","recipient":"@ilgattolillo"}`},
            { role: 'user', content: `Such that I can tip Lillo in italian 😊🍝\n"Ciao @NanoSprinkle, manda un !tip di 3x a @ilgattolillo!"`},
            { role: 'assistant', content: `{}`},
            { role: 'user', content: text},
        ],
        model: 'gpt-4o',
    });

    if (!chatCompletion.choices[0].message.content) {
        throw new Error("failed to call GPT")
    }

    const data = JSON.parse(chatCompletion.choices[0].message.content);

    if (!data || !data.amount) {
        return null
    }

    return data;
}