import { default as parseDuration } from 'parse-duration'
import { collectorLogger as logger } from 'lib/logger'
import RPCWatcher, { RpcResponse } from 'lib/RPCWatcher'

import config from 'config'
import { blockCollector, validatorCollector, proposalCollector } from '../collector'

const SOCKET_URL = `${config.RPC_URI}/websocket`
const BLOCK_Q = `tm.event='NewBlock'`
const VALIDATOR_Q = `tm.event='ValidatorSetUpdates'`
const STAKING_Q = `tm.event='Tx' AND message.module='staking'`
const GOVERNANCE_Q = `tm.event='Tx' AND message.module='governance'`

export async function rpcEventWatcher() {
  const watcher = new RPCWatcher({
    url: SOCKET_URL,
    logger
  })

  watcher.registerSubscriber(BLOCK_Q, async (data: RpcResponse) => {
    await blockCollector.run()
  })

  watcher.registerSubscriber(GOVERNANCE_Q, async (data: RpcResponse) => {
    await proposalCollector.run()
  })

  watcher.registerSubscriber(STAKING_Q, async (data: RpcResponse) => {
    await validatorCollector.run()
  })

  watcher.registerSubscriber(VALIDATOR_Q, async (data: RpcResponse) => {
    await validatorCollector.run()
  })

  await watcher.start()
}
