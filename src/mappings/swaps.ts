import { log, BigInt, BigDecimal, Value, Bytes, Address } from '@graphprotocol/graph-ts'
import { concat } from '@graphprotocol/graph-ts/helper-functions'
import { Swap } from '../types/templates/Pair/Pair'
import { PairCreated } from '../types/Factory/Factory'
import { Pair as PairTemplate } from '../types/templates'
import { Pair, Candle, Bundle, Token } from '../types/schema'
import { ZERO_BD, fetchTokenDecimals, fetchTokenName, fetchTokenSymbol } from './utils'
import { getBnbPriceInUSD, findBnbPerToken } from './utils/pricing'

export function handleNewPair(event: PairCreated): void {
    let bundle = new Bundle("1");
    bundle.bnbPrice = ZERO_BD;
    bundle.save();
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
        token0.decimals = decimals;
        token0.derivedBNB = ZERO_BD;
        token0.derivedUSD = ZERO_BD;
        token0.totalLiquidity = ZERO_BD;
        token0.save();
    }

    let token1 = Token.load(event.params.token1.toHex());
    if (token1 == null) {
        token1 = new Token(event.params.token1.toHex());
        token1.name = fetchTokenName(event.params.token0);
        token1.symbol = fetchTokenSymbol(event.params.token0);
        let decimals = fetchTokenDecimals(event.params.token0);
        if (decimals === null) {
            return;
        }
        token1.decimals = decimals;
        token1.derivedBNB = ZERO_BD;
        token1.derivedUSD = ZERO_BD;
        token1.totalLiquidity = ZERO_BD;
        token1.save();
    }
    pair.token0 = token0.id;
    pair.token1 = token1.id;
    pair.factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
    pair.token0Price = ZERO_BD;
    pair.token1Price = ZERO_BD;
    pair.reserve0 = ZERO_BD;
    pair.reserve1 = ZERO_BD;
    pair.reserveBNB = ZERO_BD;
    pair.reserveUSD = ZERO_BD;
    pair.save();

    PairTemplate.create(event.params.pair)
}

export function handleSwap(event: Swap): void {
    let token0Amount: BigInt = event.params.amount0In.minus(event.params.amount0Out).abs();
    let token1Amount: BigInt = event.params.amount1Out.minus(event.params.amount1In).abs();
    if (token0Amount.isZero() || token1Amount.isZero()) {
        return;
    }

    let pair = Pair.load(event.address.toHex());
    let price = token0Amount.divDecimal(token1Amount.toBigDecimal());
    let tokens = concat(Bytes.fromHexString(pair.token0), Bytes.fromHexString(pair.token1));
    let timestamp = event.block.timestamp.toI32();

    let token0 = Token.load(pair.token0);
    let token1 = Token.load(pair.token1);

    let periods: i32[] = [1 * 60, 5 * 60, 10 * 60, 15 * 60, 30 * 60, 60 * 60, 4 * 60 * 60, 12 * 60 * 60, 24 * 60 * 60, 7 * 24 * 60 * 60];
    for (let i = 0; i < periods.length; i++) {
        let time_id = timestamp / periods[i];
        let candle_id = concat(concat(Bytes.fromI32(time_id), Bytes.fromI32(periods[i])), tokens).toHex();
        let candle = Candle.load(candle_id);
        let bundle = Bundle.load("1");
        bundle.bnbPrice = getBnbPriceInUSD();
        bundle.save();

        let t0DerivedBNB = findBnbPerToken(token0 as Token);
        token0.derivedBNB = t0DerivedBNB;
        token0.derivedUSD = t0DerivedBNB.times(bundle.bnbPrice);
        token0.save();

        let t1DerivedBNB = findBnbPerToken(token1 as Token);
        token1.derivedBNB = t1DerivedBNB;
        token1.derivedUSD = t1DerivedBNB.times(bundle.bnbPrice);
        token1.save();

        if (candle === null) {
            candle = new Candle(candle_id);
            candle.time = timestamp;
            candle.period = periods[i];
            candle.token0 = pair.token0;
            candle.token1 = pair.token1;
            candle.open = price;
            candle.low = price;
            candle.high = price;
            candle.token0TotalAmount = BigInt.fromI32(0);
            candle.token1TotalAmount = BigInt.fromI32(0);
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
        candle.tradeAmountUSD = candle.token1TotalAmount.toBigDecimal().times(bundle.bnbPrice);
        candle.save();
    }
}
