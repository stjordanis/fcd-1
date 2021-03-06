import 'koa-body'
import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import config from 'config'

import { success } from 'lib/response'
import { ErrorCodes } from 'lib/error'
import { getPrice, getSwapRate } from 'service/market'
import { TimeIntervals } from 'lib/common'

const Joi = Validator.Joi

@Controller(`/market`)
export default class MarketController extends KoaController {
  /**
   * @api {get} /market/price Get price history
   * @apiName getMarketPrice
   * @apiGroup Market
   *
   * @apiParam {string} denom Coin denomination
   * @apiParam {string} interval Price interval
   * @apiParam {number} [count=50]
   *
   * @apiSuccess {number} lastPrice
   * @apiSuccess {string} oneDayVariation
   * @apiSuccess {string} oneDayVariationRate
   * @apiSuccess {Object[]} prices Price history
   * @apiSuccess {string} prices.denom Coin denomination
   * @apiSuccess {number} prices.datetime
   * @apiSuccess {number} prices.price
   */
  @Get('/price')
  @Validate({
    query: {
      interval: Joi.string().required().valid(Object.values(TimeIntervals)).description('Time interval'),
      denom: Joi.string().required().valid(config.ACTIVE_DENOMS).description('Denoms string'),
      count: Joi.number().min(0).max(100000000).default(50).description('Price data points count')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getDenomPrice(ctx) {
    success(ctx, await getPrice(ctx.request.query))
  }

  /**
   * @api {get} /market/swaprate/:base Get current swaprate
   * @apiName getSwapRate
   * @apiGroup Market
   *
   * @apiParam {string} base Coin denomination
   *
   * @apiSuccess {Object[]} rates
   * @apiSuccess {string} rates.denom Coin denomination
   * @apiSuccess {string} rates.swaprate Current swap rate
   * @apiSuccess {string} rates.oneDayVariation
   * @apiSuccess {string} rates.oneDayVariationRate
   */
  @Get('/swaprate/:base')
  @Validate({
    params: {
      base: Joi.string().required().valid(config.ACTIVE_DENOMS).description('Base denoms of swap')
    },
    failure: ErrorCodes.INVALID_REQUEST_ERROR
  })
  async getDenomSwapRate(ctx) {
    success(ctx, await getSwapRate(ctx.params.base))
  }
}
