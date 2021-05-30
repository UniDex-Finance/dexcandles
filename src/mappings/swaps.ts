import { log, BigInt, BigDecimal, Value, Bytes, Address } from '@graphprotocol/graph-ts'
import { concat } from '@graphprotocol/graph-ts/helper-functions'
import { Swap, Sync } from '../types/templates/Pair/Pair'
import { PairCreated } from '../types/Factory/Factory'
import { Pair as PairTemplate } from '../types/templates'
import { Pair, Candle, Bundle, Token, Transaction } from '../types/schema'
import { ZERO_BD, fetchTokenSupply, fetchTokenDecimals, fetchTokenName, fetchTokenSymbol, convertTokenToDecimal, ZERO_BI } from './utils'
import { findBnbPerToken, getBnbPriceInUSD, getBNBQuotePrice, fetchReserve } from './utils/pricing'

let WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";

export function handleNewPair(event: PairCreated): void {
    let bundle = new Bundle("1");
    bundle.bnbPrice = ZERO_BD;
    bundle.save();

    let timestamp = event.block.timestamp.toI32();

    let pair = new Pair(event.params.pair.toHex());
    let token0 = Token.load(event.params.token0.toHex());
    if (token0 == null) {
        token0 = new Token(event.params.token0.toHex());
        token0.name = fetchTokenName(event.params.token0);
        token0.symbol = fetchTokenSymbol(event.params.token0);
        let decimals = fetchTokenDecimals(event.params.token0);
        if (decimals === null) {
            return;
        }
        let supply = fetchTokenSupply(event.params.token0);
        if (supply === null) {
            supply = ZERO_BI;
        }
        token0.supply = convertTokenToDecimal(supply, decimals);
        token0.totalTransactions = ZERO_BI
        token0.decimals = decimals;
        token0.derivedBNB = ZERO_BD;
        token0.derivedUSD = ZERO_BD;
        token0.totalLiquidity = ZERO_BD;
        token0.createdAt = timestamp;
        token0.save();
    }

    let token1 = Token.load(event.params.token1.toHex());
    if (token1 == null) {
        token1 = new Token(event.params.token1.toHex());
        token1.name = fetchTokenName(event.params.token1);
        token1.symbol = fetchTokenSymbol(event.params.token1);
        let decimals = fetchTokenDecimals(event.params.token1);
        if (decimals === null) {
            return;
        }
        let supply = fetchTokenSupply(event.params.token1);
        if (supply === null) {
            supply = ZERO_BI;
        }
        token1.supply = convertTokenToDecimal(supply, decimals);
        token1.decimals = decimals;
        token1.totalTransactions = ZERO_BI
        token1.derivedBNB = ZERO_BD;
        token1.derivedUSD = ZERO_BD;
        token1.totalLiquidity = ZERO_BD;
        token1.createdAt = timestamp;
        token1.save();
    }
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
    pair.token0Price = ZERO_BD;
    pair.token1Price = ZERO_BD;
    pair.reserve0 = convertTokenToDecimal(fetchReserve(Address.fromString(pair.id))[0], token0.decimals);
    pair.reserve1 = convertTokenToDecimal(fetchReserve(Address.fromString(pair.id))[1], token1.decimals);
    pair.reserveBNB = ZERO_BD;
    pair.reserveUSD = ZERO_BD;
    pair.createdAt = timestamp;
    pair.save();

    PairTemplate.create(event.params.pair)
}

export function handleSwap(event: Swap): void {
    let pair = Pair.load(event.address.toHex());
    let token0 = Token.load(pair.token0);
    let token1 = Token.load(pair.token1);

    let token0Amount: BigDecimal = convertTokenToDecimal(event.params.amount0In.minus(event.params.amount0Out).abs(), token0.decimals);
    let token1Amount: BigDecimal = convertTokenToDecimal(event.params.amount1Out.minus(event.params.amount1In).abs(), token1.decimals);
    let token0AmountRaw: BigDecimal = event.params.amount0In.minus(event.params.amount0Out).toBigDecimal();
    let token1AmountRaw: BigDecimal = event.params.amount1In.minus(event.params.amount1Out).toBigDecimal();
    if (token0Amount.equals(ZERO_BD) || token1Amount.equals(ZERO_BD)) {
        return;
    }

    let swapType = "BUY";
    if (token0AmountRaw > ZERO_BD) {
        swapType = "SELL";
    }
    if (token1AmountRaw > ZERO_BD) {
        swapType = "BUY";
    }

    let price = token1Amount.div(token0Amount);
    let trxAmount: BigDecimal = token1Amount;
    if (token0.id == WBNB_ADDRESS) {
        price = token0Amount.div(token1Amount)
        trxAmount = token0Amount;
    }

    let tokens = concat(Bytes.fromHexString(pair.token0), Bytes.fromHexString(pair.token1));
    let timestamp = event.block.timestamp.toI32();
    let trxId = concat(Bytes.fromI32(timestamp), tokens).toHex();
    let transaction = Transaction.load(trxId);
    pair.reserve0 = convertTokenToDecimal(fetchReserve(Address.fromString(pair.id))[0], token0.decimals);
    pair.reserve1 = convertTokenToDecimal(fetchReserve(Address.fromString(pair.id))[1], token1.decimals);
    pair.save();
    if (transaction == null) {
        transaction = new Transaction(trxId);
        transaction.token0 = token0.id;
        transaction.token1 = token1.id;
        transaction.token0Name = token0.name;
        transaction.token1Name = token1.name;
        transaction.token0Symbol = token0.symbol;
        transaction.token1Symbol = token1.symbol;
        transaction.token0Id = token0.id;
        transaction.token1Id = token1.id;
        transaction.time = timestamp;
        transaction.from = event.params.sender.toHex();
        transaction.to = event.params.to.toHex();
        transaction.block = event.block.number.toI32();
        transaction.swapType = swapType;
        transaction.hash = event.transaction.hash.toHex();
        transaction.transactionAmount = trxAmount;
        transaction.transactionAmountInUSD = transaction.transactionAmount.times(getBNBQuotePrice());
        transaction.save();
        token0.totalTransactions = token0.totalTransactions.plus(BigInt.fromI32(1));
        token1.totalTransactions = token1.totalTransactions.plus(BigInt.fromI32(1));
    }
    let bnbPrice = getBNBQuotePrice();
    let t0DerivedBNB = findBnbPerToken(token0 as Token);
    token0.derivedBNB = t0DerivedBNB;
    token0.derivedUSD = t0DerivedBNB.times(bnbPrice);
    token0.save();

    let t1DerivedBNB = findBnbPerToken(token1 as Token);
    token1.derivedBNB = t1DerivedBNB;
    token1.derivedUSD = t1DerivedBNB.times(bnbPrice);
    token1.save();

    let periods: i32[] = [1 * 60, 5 * 60, 10 * 60, 15 * 60, 30 * 60, 60 * 60, 4 * 60 * 60, 12 * 60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60];
    for (let i = 0; i < periods.length; i++) {
        let time_id = timestamp / periods[i];
        let candle_id = concat(concat(Bytes.fromI32(time_id), Bytes.fromI32(periods[i])), tokens).toHex();
        let candle = Candle.load(candle_id);
        let bundle = Bundle.load("1");
        bundle.bnbPrice = getBNBQuotePrice();
        bundle.save();

        if (candle === null) {
            candle = new Candle(candle_id);
            candle.time = timestamp;
            candle.period = periods[i];
            candle.token0 = pair.token0;
            candle.token1 = pair.token1;
            candle.token0Symbol = token0.symbol;
            candle.token1Symbol = token1.symbol;
            candle.token0Id = token0.id;
            candle.token1Id = token1.id;
            candle.token0Name = token0.name;
            candle.token1Name = token1.name;
            candle.token0createdAt = token0.createdAt;
            candle.token1createdAt = token1.createdAt;
            candle.open = price;
            candle.low = price;
            candle.high = price;
            candle.token0TotalAmount = ZERO_BD;
            candle.token1TotalAmount = ZERO_BD;
        }
        else {
            if (price < candle.low) {
                candle.low = price;
            }
            if (price > candle.high) {
                candle.high = price;
            }
        }

        candle.lastBnbPrice = bundle.bnbPrice;
        candle.close = price;
        candle.lastBlock = event.block.number.toI32();
        candle.token0TotalAmount = candle.token0TotalAmount.plus(token0Amount);
        candle.token1TotalAmount = candle.token1TotalAmount.plus(token1Amount);
        if (token1.id == WBNB_ADDRESS) {
            candle.tradeAmountUSD = candle.token1TotalAmount.times(bundle.bnbPrice);
        } else {
            candle.tradeAmountUSD = candle.token0TotalAmount.times(bundle.bnbPrice);
        }
        candle.save();
    }
}


export function handleSync(event: Sync): void {
    let pair = Pair.load(event.address.toHex());
    let token0 = Token.load(pair.token0);
    let token1 = Token.load(pair.token1);

    // reset token total liquidity amounts
    token0.totalLiquidity = token0.totalLiquidity.minus(pair.reserve0);
    token1.totalLiquidity = token1.totalLiquidity.minus(pair.reserve1);

    pair.reserve0 = convertTokenToDecimal(event.params.reserve0, token0.decimals);
    pair.reserve1 = convertTokenToDecimal(event.params.reserve1, token1.decimals);

    if (pair.reserve1.notEqual(ZERO_BD)) pair.token0Price = pair.reserve0.div(pair.reserve1);
    else pair.token0Price = ZERO_BD;
    if (pair.reserve0.notEqual(ZERO_BD)) pair.token1Price = pair.reserve1.div(pair.reserve0);
    else pair.token1Price = ZERO_BD;

    let bundle = Bundle.load("1");
    bundle.bnbPrice = getBNBQuotePrice();
    bundle.save();

    let t0DerivedBNB = findBnbPerToken(token0 as Token);
    token0.derivedBNB = t0DerivedBNB;
    token0.derivedUSD = t0DerivedBNB.times(bundle.bnbPrice);
    token0.save();

    let t1DerivedBNB = findBnbPerToken(token1 as Token);
    token1.derivedBNB = t1DerivedBNB;
    token1.derivedUSD = t1DerivedBNB.times(bundle.bnbPrice);
    token1.save();

    // use derived amounts within pair
    pair.reserveBNB = pair.reserve0
        .times(token0.derivedBNB as BigDecimal)
        .plus(pair.reserve1.times(token1.derivedBNB as BigDecimal));
    pair.reserveUSD = pair.reserveBNB.times(bundle.bnbPrice);

    // now correctly set liquidity amounts for each token
    token0.totalLiquidity = token0.totalLiquidity.plus(pair.reserve0);
    token1.totalLiquidity = token1.totalLiquidity.plus(pair.reserve1);

    // save entities
    pair.save();
    token0.save();
    token1.save();
}