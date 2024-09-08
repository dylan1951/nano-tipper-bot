import OpenAI from "openai";

const client = new OpenAI();

export async function getGPTFunResponse(amount: string, sender: string, recipient: string, tweet: string) {
    const chatCompletion = await client.chat.completions.create({
        messages: [{ role: 'user', content: `You are a Nano (Nanocurrency) tip bot on X/Twitter.

        Your name is @NanoSprinkle. You like to sprinkle Nano around the world. When someone wants to make
        a tip they mention you, for example, '@NanoSprinkle !tip 5'.You will write a creative, fun reply for the user
        after successfully tipping the amount.
        
        Write a response after handling this tweet: '${tweet}' and executing a tip of amount ${amount} XNO from user @${sender} to @${recipient}. Be sure to include the amount.
        
        Here is a random fact about Nano: ${getRandomFact()}
        
        You can include a random fun Nano fact to make your response informative and interesting (include all details and be accurate).
        
        Don't use a discourse marker or prefatory expression with a ':' such as "Fun fact:"
        
        Be creative, unpredictable and fun.
        
        Keep your response to one line. Don't use water emojis. Don't use the word "splash".` }],
        model: 'gpt-4o',
    });

    if (!chatCompletion.choices[0].message.content) {
        throw new Error("failed to call GPT")
    }

    return chatCompletion.choices[0].message.content;
}

function getRandomFact() {
    const facts = [
        "Nano transactions are fully confirmed in less than a second.",
        "Nano used to be called RaiBlocks, after the Rai stones used as currency on the Micronesian Island of Yap.",
        "There is a conspiracy theory posted on Reddit that Colin LeMahieu (who started Nano) is Satoshi Nakamoto.",
        "Nano is one of the few cryptocurrencies that is fully distributed. No additional Nano can ever be created.",
        "Nano node versions are generally named after ancient coins (Lydia, Daric, Follis)",
        "Nano is extremely energy-efficient. 15 million Nano transactions use about as much electricity as one Bitcoin transaction.",
        "The first-ever crypto transaction inside the British Houses of Parliament was done using Nano, during the launch of the Centre of Fintech.",
        "There is a Nano around the globe video where community members transfer a single Nano across 11 countries in 6 continents in under a minute.",
        "Nano's initial distribution was done through free faucets. These got so popular that they captured a significant amount of total captcha traffic after which Google reached out to Colin LeMahieu!",
        "Nano's node software is written in C++, but a developer is currently also porting it to Rust. He does coding livestreams where you can follow along!",
        "The Nano developers host weekly developer Spaces on Twitter where anyone can join in. Transcripts and summaries are posted on r/nanocurrency by community members.",
        "Nano has no inbuilt limits. Its throughput is dependent on the hardware and bandwidth of the nodes running the network. If they get stronger, the network's throughput increases.",
        "Nano is one of very few crypto where there is no 'dust'. Even if you have 0.00000000000000001 Nano, you will always still be able to move it due to Nano being feeless.",
        "Nano uses a unique block-lattice architecture, where each account has its own blockchain.",
        "Nano's block-lattice system allows transactions to be asynchronous, making it extremely fast.",
        "Nano transactions are feeless, making it a popular choice for micropayments and international transfers.",
        "Nano's consensus mechanism is called Open Representative Voting (ORV), allowing users to choose representatives to vote on their behalf.",
        "Nano's instant finality ensures that once a transaction is confirmed, it is irreversible and immutable.",
        "Nano has no smart contracts or tokenization, keeping the focus purely on fast, secure currency transactions.",
        "Nano's transaction speed makes it suitable for real-world use cases like point-of-sale payments and online shopping.",
        "Nano's total supply of 133,248,297 tokens was fully distributed through faucets, promoting fairness in its initial distribution compared to traditional ICOs or pre-mining.",
        "Nano has no need for staking, mining, or complex consensus mechanisms, which keeps it environmentally friendly and scalable.",
        "Nano's Open Representative Voting (ORV) consensus mechanism giving voting power to anyone who holds Nano.",
        "Nano's block-lattice structure allows each account to independently update their blockchain, reducing network congestion.",
    ]
    const randomIndex = Math.floor(Math.random() * facts.length);
    return facts[randomIndex];
}