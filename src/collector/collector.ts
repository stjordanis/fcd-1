import { init as initORM } from 'orm'
import * as nodeCron from 'node-cron'
import { get } from 'lodash'
import { default as parseDuration } from 'parse-duration'

import { collectorLogger as logger } from 'lib/logger'
import { initializeSentry } from 'lib/errorReporting'
import Semaphore from './Semaphore'

import { collectValidator, calculateValidatorsReturn } from './staking'
import { collectBlock } from './block'
import { collectPrice } from './price'
import { collectorGeneral } from './general'
import { collectProposal } from './gov'
import { collectDashboard } from './dashboard'
import { rpcEventWatcher } from './watcher'
import { collectRichList } from './richlist'
import { collectUnvested } from './unvested'

process.on('unhandledRejection', (err) => {
  logger.error({
    type: 'SYSTEM_ERROR',
    message: get(err, 'message'),
    stack: get(err, 'stack')
  })
})

const TEN_MINUTES = parseDuration('10m')

export const blockCollector = new Semaphore('BlockCollector', collectBlock, logger)
export const validatorCollector = new Semaphore('ValidatorCollector', collectValidator, logger)
export const priceCollector = new Semaphore('PriceCollector', collectPrice, logger)
export const generalCollector = new Semaphore('GeneralCollector', collectorGeneral, logger)
export const proposalCollector = new Semaphore('ProposalCollector', collectProposal, logger)
export const returnCalculator = new Semaphore('ReturnCalculator', calculateValidatorsReturn, logger, TEN_MINUTES) // 10 min timeout
export const dashboardCollector = new Semaphore('DashboardCollector', collectDashboard, logger, TEN_MINUTES) // 20 mins as took 3 mins go get users count
export const richListCollector = new Semaphore('RichListCollector', collectRichList, logger, TEN_MINUTES) // run once a day and huge data
export const vestingCollector = new Semaphore('VestingCollector', collectUnvested, logger, TEN_MINUTES) // run once a day

const jobs = [
  // Per minute
  {
    method: generalCollector.run.bind(generalCollector),
    cron: '0 * * * * *'
  },
  {
    method: proposalCollector.run.bind(proposalCollector),
    cron: '5 * * * * *'
  },
  {
    method: validatorCollector.run.bind(validatorCollector),
    cron: '10 * * * * *'
  },
  {
    method: priceCollector.run.bind(priceCollector),
    cron: '50 * * * * *'
  },
  // Per day
  {
    method: returnCalculator.run.bind(returnCalculator),
    cron: '0 10 0 * * *'
  },
  {
    method: dashboardCollector.run.bind(dashboardCollector),
    cron: '0 20 0 * * *'
  },
  {
    method: richListCollector.run.bind(richListCollector),
    cron: '0 0 13 * * *' // used 1pm daily rather midnight cause some rich list file generated after 12PM daily. its rare though
  },
  {
    method: vestingCollector.run.bind(vestingCollector),
    cron: '0 0 13 * * *' // used 1pm daily rather midnight cause some rich list file generated after 12PM daily. its rare though
  }
]

async function createJobs() {
  for (const job of jobs) {
    nodeCron.schedule(job.cron, job.method)
  }
}

const init = async () => {
  initializeSentry()
  await initORM()
  await rpcEventWatcher()
}

init()
  .then(() => {
    createJobs().catch((err) => {
      logger.error(err)
    })
  })
  .catch(logger.error)
