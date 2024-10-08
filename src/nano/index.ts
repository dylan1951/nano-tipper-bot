import {checkAddress, checkAmount, checkHash, convert, Unit} from "nanocurrency";

async function rpc(request: any) {
    console.log(request);

    const response = await fetch(`http://${process.env.PIPPIN_HOST}:11338`, {
        method: 'POST',
        body: JSON.stringify(request)
    });

    let data;

    try {
        data = await response.json();
    } catch {
        throw Error(`RPC status ${response.status}: failed to parse JSON`);
    }

    if ('error' in data) {
        console.error(`Pippin gave us this error: ${data['error']}`)
        throw Error(data['error']);
    }

    if (!response.ok) {
        throw Error(`RPC status ${response.status}: ${JSON.stringify(data, null, 4)}`);
    }

    console.log(data)
    return data;
}

async function balance(account: string) {
    const data = await rpc({
        action: "account_balance",
        account: account,
        include_only_confirmed: false
    });

    if (!data || !data.balance || !data.receivable) {
        throw Error("Failed to get balance.");
    }

    return {
        balance: convert(data.balance, {from: Unit.raw, to: Unit.Nano}),
        receivable: convert(data.receivable, {from: Unit.raw, to: Unit.Nano}),
    }
}

async function createAccount(): Promise<string> {
    const data = await rpc({
        action: 'account_create',
        wallet: process.env.WALLET
    });

    if (!data || !data.account || !checkAddress(data.account)) {
        throw Error("Failed to create account.");
    }

    return data.account;
}

async function send(destination: string, source: string, amount: string, id?: string): Promise<string> {
    if (!checkAddress(destination) || !checkAddress(source) || !checkAmount(amount)) {
        throw Error("Invalid parameters.");
    }

    const data = await rpc({
        action: "send",
        wallet: process.env.WALLET!,
        source: source,
        destination: destination,
        amount: amount,
        ...(id && { id: id })
    });

    if (!data || !data.block || !checkHash(data.block)) {
        throw Error("Failed to send nano.");
    }

    console.log(data);
    console.log("sent " + amount + " nano to " + destination);

    return data.block;
}

async function receive(account: string, blockHash: string) : Promise<string> {
    if (!checkAddress(account) || !checkHash(blockHash)) {
        throw Error("Receive: invalid parameters.")
    }

    const data = await rpc({
        action: "receive",
        wallet: process.env.WALLET!,
        account: account,
        block: blockHash,
    });

    if (!data || !data.block || !checkHash(data.block)) {
        throw Error("Failed to receive nano")
    }

    return data.block;
}

async function receive_all(account: string) {
    if (!checkAddress(account)) {
        throw Error("Receive: invalid parameters.")
    }

    const data: { received: number} = await rpc({
        action: "account_receive_all",
        wallet: process.env.WALLET!,
        account: account,
    });

    if (!data) {
        throw Error("Failed to receive all")
    }

    return data;
}

export default {
    send: send,
    createAccount: createAccount,
    balance: balance,
    receive_all: receive_all,
    receive: receive,
}