import * as sentry from '@sentry/node'
import * as bech32 from 'bech32'
import { get } from 'lodash'
import { getTime, getMinutes } from 'date-fns'
import { getRepository, getManager, DeepPartial, EntityManager } from 'typeorm'

import config from 'config'
import { BlockEntity, BlockRewardEntity, ValidatorInfoEntity } from 'orm'
import { splitDenomAndAmount } from 'lib/common'
import { plus } from 'lib/math'
import { collectorLogger as logger } from 'lib/logger'
import * as lcd from 'lib/lcd'
import * as rpc from 'lib/rpc'

import { saveTxs, generateTxEntities } from './tx'
import { saveWasmCodeAndContract } from './wasm'

import { setReward } from 'collector/reward'
import { setSwap } from 'collector/swap'
import { setNetwork } from 'collector/network'

function getTxHashesFromBlock(block: LcdBlock): string[] {
  const txStrings = get(block, 'block.data.txs')
  if (!txStrings || !txStrings.length) {
    return []
  }
  const hashes = txStrings.map(lcd.getTxHash)
  return hashes
}

async function getRecentlySyncedBlock(): Promise<BlockEntity | undefined> {
  const latestBlock = await getRepository(BlockEntity).find({
    where: {
      chainId: config.CHAIN_ID
    },
    order: {
      id: 'DESC'
    },
    take: 1
  })

  if (!latestBlock || latestBlock.length === 0) {
    return
  }

  return latestBlock[0]
}

function getBlockEntity(
  lcdBlock: LcdBlock,
  reward: BlockRewardEntity,
  validator: ValidatorInfo
): DeepPartial<BlockEntity> {
  const chainId = lcdBlock.block.header.chain_id
  const timestamp = lcdBlock.block.header.time
  const height = +lcdBlock.block.header.height

  const blockEntity: DeepPartial<BlockEntity> = {
    chainId,
    height,
    timestamp,
    reward,
    validator
  }

  return blockEntity
}

const totalRewardReducer = (acc: DenomMap, item: Coin & { validator: string }): DenomMap => {
  acc[item.denom] = plus(acc[item.denom], item.amount)
  return acc
}

const validatorRewardReducer = (acc: DenomMapByValidator, item: Coin & { validator: string }): DenomMapByValidator => {
  if (!acc[item.validator]) {
    acc[item.validator] = {}
  }

  acc[item.validator][item.denom] = plus(acc[item.validator][item.denom], item.amount)
  return acc
}

export async function getBlockReward(block: LcdBlock): Promise<DeepPartial<BlockRewardEntity>> {
  const height = get(block, 'block.header.height')
  const chainId = get(block, 'block.header.chain_id')
  const timestamp = get(block, 'block.header.time')

  const decodedRewardsAndCommission = await rpc.getRewards(height)

  const totalReward = {}
  const totalCommission = {}
  const rewardPerVal = {}
  const commissionPerVal = {}

  decodedRewardsAndCommission &&
    decodedRewardsAndCommission.forEach((item) => {
      if (!item.amount) {
        return
      }

      if (item.type === 'rewards') {
        const rewards = item.amount
          .split(',')
          .map((amount) => ({ ...splitDenomAndAmount(amount), validator: item.validator }))

        rewards.reduce(totalRewardReducer, totalReward)
        rewards.reduce(validatorRewardReducer, rewardPerVal)
      } else if (item.type === 'commission' && item.amount) {
        const commissions = item.amount
          .split(',')
          .map((amount) => ({ ...splitDenomAndAmount(amount), validator: item.validator }))

        commissions.reduce(totalRewardReducer, totalCommission)
        commissions.reduce(validatorRewardReducer, commissionPerVal)
      }
    })

  const blockReward: DeepPartial<BlockRewardEntity> = {
    chainId,
    height,
    timestamp,
    reward: totalReward,
    commission: totalCommission,
    rewardPerVal,
    commissionPerVal
  }
  return blockReward
}

export function isNewMinuteBlock(prevBlock: BlockEntity | undefined, newBlock: BlockEntity): number {
  const prevBlockTime = prevBlock ? prevBlock.timestamp : undefined
  const newBlockTime = newBlock.timestamp

  if (prevBlockTime && getMinutes(prevBlockTime) !== getMinutes(newBlockTime)) {
    return getTime(newBlockTime)
  }

  return 0
}

interface NewBlockInfo {
  recentlySyncedHeight: number
  latestHeight: number
}
export async function getLatestBlockInfo(): Promise<NewBlockInfo> {
  const recentlySyncedBlock = await getRecentlySyncedBlock()
  const recentlySyncedHeight = recentlySyncedBlock ? recentlySyncedBlock.height : 0
  const latestBlock = await lcd.getLatestBlock()
  const latestHeight = Number(get(latestBlock, 'block.header.height'))

  return {
    recentlySyncedHeight,
    latestHeight
  }
}

async function saveBlockInformation(
  lcdBlock: LcdBlock,
  lastSyncedBlock: BlockEntity | undefined
): Promise<BlockEntity | undefined> {
  const height: string = lcdBlock.block.header.height
  logger.info(`collectBlock: begin transaction for block ${height}`)

  const result: BlockEntity | undefined = await getManager()
    .transaction(async (mgr: EntityManager) => {
      // Save block rewards
      const newBlockReward = await mgr.getRepository(BlockRewardEntity).save(await getBlockReward(lcdBlock))

      // Find validator by proposer address
      const consensusAddress = bech32.encode(
        'terravalcons',
        bech32.toWords(Buffer.from(lcdBlock.block.header.proposer_address, 'hex'))
      )
      const validatorInfo = await mgr.getRepository(ValidatorInfoEntity).findOneOrFail({
        consensusAddress
      })

      // save block entity
      const newBlockEntity = await mgr
        .getRepository(BlockEntity)
        .save(getBlockEntity(lcdBlock, newBlockReward, validatorInfo))

      // get block tx hashes
      const txHashes = getTxHashesFromBlock(lcdBlock)

      if (txHashes) {
        const txEntities = await generateTxEntities(txHashes, height, newBlockEntity)
        // save transactions
        await saveTxs(mgr, newBlockEntity, txEntities)
        // save wasm
        await saveWasmCodeAndContract(mgr, txEntities)
      }

      // new block timestamp
      const newBlockTimeStamp = isNewMinuteBlock(lastSyncedBlock, newBlockEntity)

      if (newBlockTimeStamp) {
        await setReward(mgr, newBlockTimeStamp)
        await setSwap(mgr, newBlockTimeStamp)
        await setNetwork(mgr, newBlockTimeStamp)
      }
      return newBlockEntity
    })
    .then((block: BlockEntity) => {
      logger.info('collectBlock: transaction finished')
      return block
    })
    .catch((err) => {
      logger.error(err)
      if (
        err instanceof Error &&
        typeof err.message === 'string' &&
        err.message.includes('transaction not found on node')
      ) {
        return undefined
      }
      sentry.captureException(err)
      return undefined
    })
  return result
}

export async function collectBlock(): Promise<void> {
  const { recentlySyncedHeight, latestHeight } = await getLatestBlockInfo()
  let nextSyncHeight = recentlySyncedHeight + 1
  let lastSyncedBlock = await getRecentlySyncedBlock()

  while (nextSyncHeight <= latestHeight) {
    const lcdBlock = await lcd.getBlock(nextSyncHeight)

    if (!lcdBlock) {
      break
    }

    lastSyncedBlock = await saveBlockInformation(lcdBlock, lastSyncedBlock)

    // Exit the loop after transaction error whether there's more blocks or not
    if (!lastSyncedBlock) {
      break
    }

    nextSyncHeight = nextSyncHeight + 1
  }
}
