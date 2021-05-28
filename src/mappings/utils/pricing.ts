/* eslint-disable prefer-const */
import { BigDecimal, Address, BigInt } from "@graphprotocol/graph-ts/index";
import { Pair, Bundle, Token } from "../../types/schema";
import { ZERO_BD, factoryContract, ADDRESS_ZERO, ONE_BD, fetchTokenSymbol, fetchTokenName, fetchTokenDecimals, ZERO_BI } from "./index";
import { Router } from "../../types/Factory/Router";
import { exponentToBigDecimal, ONE_BI } from "./index";

let ROUTER_ADDRESS = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
let WBNB_ADDRESS = "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c";
let USDT_ADDRESS = "0x55d398326f99059ff775485246999027b3197955";
let BUSD_ADDRESS = "0xe9e7cea3dedca5984780bafc599bd69add087d56";
let BUSD_WBNB_PAIR = "0x58f876857a02d6762e0101bb5c46a8c1ed44dc16"; // created block 589414
let USDT_WBNB_PAIR = "0x16b9a82891338f9ba80e2d6970fdda79d1eb0dae"; // created block 648115

export function getBnbPriceInUSD(): BigDecimal {
    // fetch eth prices for each stablecoin
    let usdtPair = Pair.load(USDT_WBNB_PAIR); // usdt is token0
    let busdPair = Pair.load(BUSD_WBNB_PAIR); // busd is token1
    if (usdtPair == null) {
        let token0 = Token.load(USDT_ADDRESS);
        if (token0 == null) {
            token0 = new Token(USDT_ADDRESS);
            token0.name = fetchTokenName(Address.fromString(USDT_ADDRESS));
            token0.symbol = fetchTokenSymbol(Address.fromString(USDT_ADDRESS));
            let decimals = fetchTokenDecimals(Address.fromString(USDT_ADDRESS));
            if (decimals === null) {
                decimals = ZERO_BI;
            }
            token0.decimals = decimals;
            token0.derivedBNB = ZERO_BD;
            token0.derivedUSD = ZERO_BD;
            token0.totalLiquidity = ZERO_BD;
            token0.save();
        }

        let token1 = Token.load(WBNB_ADDRESS);
        if (token1 == null) {
            token1 = new Token(WBNB_ADDRESS);
            token1.name = fetchTokenName(Address.fromString(WBNB_ADDRESS));
            token1.symbol = fetchTokenSymbol(Address.fromString(WBNB_ADDRESS));
            let decimals = fetchTokenDecimals(Address.fromString(WBNB_ADDRESS));
            if (decimals === null) {
                decimals = ZERO_BI;
            }
            token1.decimals = decimals;
            token1.derivedBNB = ZERO_BD;
            token1.derivedUSD = ZERO_BD;
            token1.totalLiquidity = ZERO_BD;
            token1.save();
        }

        usdtPair = new Pair(USDT_WBNB_PAIR);
        usdtPair.token0 = token0.id;
        usdtPair.token1 = token1.id;
        usdtPair.factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
        usdtPair.token0Price = ZERO_BD;
        usdtPair.token1Price = ZERO_BD;
        usdtPair.reserve0 = ZERO_BD;
        usdtPair.reserve1 = ZERO_BD;
        usdtPair.reserveBNB = ZERO_BD;
        usdtPair.reserveUSD = ZERO_BD;
        usdtPair.save();
    }

    if (busdPair == null) {
        let token0 = Token.load(WBNB_ADDRESS);
        if (token0 == null) {
            token0 = new Token(WBNB_ADDRESS);
            token0.name = fetchTokenName(Address.fromString(WBNB_ADDRESS));
            token0.symbol = fetchTokenSymbol(Address.fromString(WBNB_ADDRESS));
            let decimals = fetchTokenDecimals(Address.fromString(WBNB_ADDRESS));
            if (decimals === null) {
                decimals = ZERO_BI;
            }
            token0.decimals = decimals;
            token0.derivedBNB = ZERO_BD;
            token0.derivedUSD = ZERO_BD;
            token0.totalLiquidity = ZERO_BD;
            token0.save();
        }

        let token1 = Token.load(BUSD_ADDRESS);
        if (token1 == null) {
            token1 = new Token(BUSD_ADDRESS);
            token1.name = fetchTokenName(Address.fromString(BUSD_ADDRESS));
            token1.symbol = fetchTokenSymbol(Address.fromString(BUSD_ADDRESS));
            let decimals = fetchTokenDecimals(Address.fromString(BUSD_ADDRESS));
            if (decimals === null) {
                decimals = ZERO_BI;
            }
            token1.decimals = decimals;
            token1.derivedBNB = ZERO_BD;
            token1.derivedUSD = ZERO_BD;
            token1.totalLiquidity = ZERO_BD;
            token1.save();
        }

        busdPair = new Pair(BUSD_WBNB_PAIR);
        busdPair.token0 = token0.id;
        busdPair.token1 = token1.id;
        busdPair.factory = '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73';
        busdPair.token0Price = ZERO_BD;
        busdPair.token1Price = ZERO_BD;
        busdPair.reserve0 = ZERO_BD;
        busdPair.reserve1 = ZERO_BD;
        busdPair.reserveBNB = ZERO_BD;
        busdPair.reserveUSD = ZERO_BD;
        busdPair.save();
    }

    if (busdPair !== null && usdtPair !== null) {
        let totalLiquidityBNB = busdPair.reserve0.plus(usdtPair.reserve1);
        if (totalLiquidityBNB.notEqual(ZERO_BD)) {
            let busdWeight = busdPair.reserve0.div(totalLiquidityBNB);
            let usdtWeight = usdtPair.reserve1.div(totalLiquidityBNB);
            return busdPair.token1Price.times(busdWeight).plus(usdtPair.token0Price.times(usdtWeight));
        } else {
            return ZERO_BD;
        }
    } else if (busdPair !== null) {
        return busdPair.token1Price;
    } else if (usdtPair !== null) {
        return usdtPair.token0Price;
    } else {
        return ZERO_BD;
    }
}

export function exponentToBigInt(decimals: BigInt): BigInt {
    let bd = BigInt.fromI32(1);
    for (let i = ZERO_BI; i.lt(decimals as BigInt); i = i.plus(ONE_BI)) {
        bd = bd.times(BigInt.fromI32(10));
    }
    return bd;
}

export function getBNBQuotePrice(): BigDecimal {
    let path: Address[] = [Address.fromString(USDT_ADDRESS), Address.fromString(WBNB_ADDRESS)];
    let router = Router.bind(Address.fromString(ROUTER_ADDRESS));
    let amountsOut: BigInt = BigInt.fromI32(1).times(exponentToBigInt(BigInt.fromI32(18)));
    let price = router.try_getAmountsIn(amountsOut, path).value;
    return price[0].divDecimal(exponentToBigDecimal(BigInt.fromI32(18)));
}

// token where amounts should contribute to tracked volume and liquidity
let WHITELIST: string[] = [
    "0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c", // WBNB
    "0xe9e7cea3dedca5984780bafc599bd69add087d56", // BUSD
    "0x55d398326f99059ff775485246999027b3197955", // USDT
    "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d", // USDC
    "0x23396cf899ca06c4472205fc903bdb4de249d6fc", // UST
    "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", // BTCB
    "0x2170ed0880ac9a755fd29b2688956bd959f933f8", // WETH
];

// minimum liquidity for price to get tracked
let MINIMUM_LIQUIDITY_THRESHOLD_BNB = BigDecimal.fromString("0");

/**
 * Search through graph to find derived BNB per token.
 * @todo update to be derived BNB (add stablecoin estimates)
 **/
export function findBnbPerToken(token: Token): BigDecimal {
    if (token.id == WBNB_ADDRESS) {
        return ONE_BD;
    }
    // loop through whitelist and check if paired with any
    for (let i = 0; i < WHITELIST.length; ++i) {
        let pairAddress = factoryContract.getPair(Address.fromString(token.id), Address.fromString(WHITELIST[i]));
        if (pairAddress.toHex() != ADDRESS_ZERO) {
            let pair = Pair.load(pairAddress.toHex());
            if (pair.token0 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
                let token1 = Token.load(pair.token1);
                return pair.token1Price.times(token1.derivedBNB as BigDecimal); // return token1 per our token * BNB per token 1
            }
            if (pair.token1 == token.id && pair.reserveBNB.gt(MINIMUM_LIQUIDITY_THRESHOLD_BNB)) {
                let token0 = Token.load(pair.token0);
                return pair.token0Price.times(token0.derivedBNB as BigDecimal); // return token0 per our token * BNB per token 0
            }
        }
    }
    return ZERO_BD; // nothing was found return 0
}