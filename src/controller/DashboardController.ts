import 'koa-body'
import { KoaController, Validate, Get, Controller, Validator } from 'koa-joi-controllers'

import { success } from 'lib/response'

import {
  getGeneralInfo,
  getTransactionVol,
  getBlockRewards,
  getSeigniorageProceeds,
  getStakingReturn,
  getStakingRatio,
  getAccountGrowth,
  getActiveAccounts,
  getRegisteredAccounts,
  lastHourOpsAndTxs
} from 'service/dashboard'

const Joi = Validator.Joi

@Controller(`/dashboard`)
export default class DashboardController extends KoaController {
  /**
   * @api {get} /dashboard Get information to be used on the dashboard
   * @apiName getDashboard
   * @apiGroup Dashboard
   *
   * @apiSuccess {Object} prices Current oracle price
   * @apiSuccess {string} prices.ukrw ukrw amount
   * @apiSuccess {string} prices.uluna uluna amount
   * @apiSuccess {string} prices.umnt umnt amount
   * @apiSuccess {string} prices.usdr usdr amount
   * @apiSuccess {string} prices.uusd uusd amount
   * @apiSuccess {String} taxRate Current tax rate
   * @apiSuccess {Object[]} taxCaps Current tax cap
   * @apiSuccess {string} taxCaps.denom denom name
   * @apiSuccess {string} taxCaps.taxCap tax cap amount
   * @apiSuccess {Object} issuances Total issuances of coins
   * @apiSuccess {string} issuances.ukrw ukrw amount
   * @apiSuccess {string} issuances.uluna uluna amount
   * @apiSuccess {string} issuances.umnt umnt amount
   * @apiSuccess {string} issuances.usdr usdr amount
   * @apiSuccess {string} issuances.uusd uusd amount
   * @apiSuccess {Object} stakingPool Current state of the staking pool
   * @apiSuccess {string} stakingPool.bondedTokens bonded token amount
   * @apiSuccess {string} stakingPool.notBondedTokens not bonded token amount
   * @apiSuccess {string} stakingPool.stakingRatio staking ratio
   * @apiSuccess {Object} communityPool Current state of the community pool
   * @apiSuccess {string} communityPool.ukrw ukrw amount
   * @apiSuccess {string} communityPool.uluna uluna amount
   * @apiSuccess {string} communityPool.umnt umnt amount
   * @apiSuccess {string} communityPool.usdr usdr amount
   * @apiSuccess {string} communityPool.uusd uusd amount
   */
  @Get('/')
  async getDashboard(ctx): Promise<void> {
    success(ctx, await getGeneralInfo())
  }

  /**
   * @api {get} /dashboard/tx_volume Get tx volume history
   * @apiName getTxVolume
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days history from today
   *
   * @apiSuccess {Object[]} cumulative
   * @apiSuccess {string} cumulative.denom denom name
   * @apiSuccess {Object[]} cumulative.data history data
   * @apiSuccess {number} cumulative.data.datetime unix time
   * @apiSuccess {string} cumulative.data.txVolume time wise cumulative tx volume
   *
   * @apiSuccess {Object[]} periodic
   * @apiSuccess {string} periodic.denom denom name
   * @apiSuccess {Object[]} periodic.data
   * @apiSuccess {number} periodic.data.datetime unix time
   * @apiSuccess {string} periodic.data.txVolume periodic tx volume
   */
  @Get('/tx_volume')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async getTxVolume(ctx): Promise<void> {
    success(ctx, await getTransactionVol(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/block_rewards Get block reward history
   * @apiName getBlockReward
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days history from today
   *
   * @apiSuccess {Object[]} cumulative cumulative history
   * @apiSuccess {Number} cumulative.datetime unix timestamp
   * @apiSuccess {Number} cumulative.blockReward cumulative reward
   *
   * @apiSuccess {Object[]} periodic periodic history
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.blockReward periodic reward on that timestamp
   */
  @Get('/block_rewards')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async getBlockRewards(ctx): Promise<void> {
    success(ctx, await getBlockRewards(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/seigniorage_proceeds Get the amount of seigniorage in the start of the day
   * @apiName getSeigniorageProc
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days from today
   *
   * @apiSuccess {Object[]} seigniorage
   * @apiSuccess {Number} seigniorage.datetime unix time of history data
   * @apiSuccess {String} seigniorage.seigniorageProceeds amount of seigniorage on datetime
   */
  @Get('/seigniorage_proceeds')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async getSeigniorageProc(ctx): Promise<void> {
    success(ctx, await getSeigniorageProceeds(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/staking_return Get staking return history
   * @apiName getStakingReturn
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days history from today
   *
   * @apiSuccess {Object[]} seigniorage return history
   * @apiSuccess {Number} seigniorage.datetime unix timestamp
   * @apiSuccess {Number} seigniorage.dailyReturn daily return
   * @apiSuccess {Number} seigniorage.annualizedReturn annualized return
   *
   */
  @Get('/staking_return')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async getStakingReturn(ctx): Promise<void> {
    success(ctx, await getStakingReturn(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/staking_ratio Get the historical staking ratio
   * @apiName getStakingRatio
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days from today
   *
   * @apiSuccess {Object[]} stakingHistory
   * @apiSuccess {Number} stakingHistory.datetime unix timestamp
   * @apiSuccess {String} stakingHistory.stakingRatio staking ratio
   */
  @Get('/staking_ratio')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async getStakingRatio(ctx): Promise<void> {
    success(ctx, await getStakingRatio(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/account_growth Get account growth history
   * @apiName getAccountGrowth
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days history from today
   *
   * @apiSuccess {Object[]} cumulative cumulative history data
   * @apiSuccess {Number} cumulative.datetime unix timestamp
   * @apiSuccess {Number} cumulative.totalAccount total account
   * @apiSuccess {Number} cumulative.activeAccount active account count
   *
   * @apiSuccess {Object[]} periodic periodic history
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.totalAccount total account on datetime
   * @apiSuccess {Number} periodic.activeAccount active account on datetime
   */
  @Get('/account_growth')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async getAccountGrowth(ctx): Promise<void> {
    success(ctx, await getAccountGrowth(+ctx.request.query.count))
  }
  /**
   * @api {get} /dashboard/active_accounts Get active accounts count history
   * @apiName getActiveAccounts
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days history from today
   *
   * @apiSuccess {Number} total total active accounts in the time period
   * @apiSuccess {Object[]} periodic daily active account info's
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.value active account count
   */
  @Get('/active_accounts')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async activeAccounts(ctx): Promise<void> {
    success(ctx, await getActiveAccounts(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/registered_accounts Get registered accounts count history
   * @apiName getRegisteredAccounts
   * @apiGroup Dashboard
   *
   * @apiParam {number} [count] number of previous days history from today
   *
   * @apiSuccess {Number} total total registered accounts in the time period
   * @apiSuccess {Object[]} periodic daily periodic account info's
   * @apiSuccess {Number} periodic.datetime unix timestamp
   * @apiSuccess {Number} periodic.value daily registered account count
   * @apiSuccess {Object[]} cumulative cumulative registered account count info's
   * @apiSuccess {Number} cumulative.datetime unix timestamp
   * @apiSuccess {Number} cumulative.value daily cumulative account count from genesis
   */
  @Get('/registered_accounts')
  @Validate({
    query: {
      count: Joi.number().default(0).min(0).description('Number days history')
    }
  })
  async registeredAccounts(ctx): Promise<void> {
    success(ctx, await getRegisteredAccounts(+ctx.request.query.count))
  }

  /**
   * @api {get} /dashboard/last_hour_ops_txs_count Get registered accounts count history
   * @apiName getLastHourTxAndOpsCount
   * @apiGroup Dashboard
   *
   * @apiSuccess {Number} last_1h_op total ops count in last hour
   * @apiSuccess {Number} last_1h_tx total txs count in last hour
   */

  @Get('/last_hour_ops_txs_count')
  @Validate({})
  async lastHourOpsAndTxs(ctx): Promise<void> {
    success(ctx, await lastHourOpsAndTxs())
  }
}
