import { filter, orderBy } from 'lodash'
import { DeepPartial, getRepository } from 'typeorm'

import config from 'config'
import { ValidatorInfoEntity, ValidatorStatus } from 'orm'

import * as lcd from 'lib/lcd'
import { convertValAddressToAccAddress, sortDenoms } from 'lib/common'
import { div, plus, times } from 'lib/math'
import { APIError, ErrorTypes } from 'lib/error'
import { SLASHING_PERIOD } from 'lib/constant'
import getAvatar from 'lib/keybase'
import { VotingPower } from 'service/staking'

const TOKEN_MICRO_UNIT_MULTIPLICAND = '1000000'

function getSelfDelegation(
  delegators: Delegator[],
  accountAddr: string
): {
  amount: string
  weight: string
} {
  const selfDelegations = filter(delegators, ['address', accountAddr])
  return selfDelegations.length > 0
    ? {
        amount: selfDelegations[0].amount,
        weight: selfDelegations[0].weight
      }
    : { amount: '0', weight: '0' }
}

async function getDelegators(operatorAddress: string): Promise<Delegator[]> {
  const lcdDelegators = await lcd.getValidatorDelegations(operatorAddress)

  if (!lcdDelegators) {
    return []
  }

  const delegateTotal = lcdDelegators.reduce((acc, curr) => plus(acc, curr.shares), '0')

  const delegators: Delegator[] = lcdDelegators.map((delegator) => {
    return {
      address: delegator.delegator_address,
      amount: delegator.shares,
      weight: div(delegator.shares, delegateTotal)
    }
  })

  return orderBy(delegators, [(d) => Number(d.weight)], ['desc'])
}

function getUptime(signingInfo: LcdValidatorSigningInfo): number {
  const missedBlocksCounter = +signingInfo.missed_blocks_counter || 0
  return 1 - missedBlocksCounter / SLASHING_PERIOD || 0
}

function getValidatorStatus(validatorInfo: LcdValidator): ValidatorStatus {
  const { status, jailed } = validatorInfo

  if (jailed) {
    return ValidatorStatus.JAILED
  }

  switch (status) {
    case 0: {
      return ValidatorStatus.INACTIVE
    }
    case 1: {
      return ValidatorStatus.UNBONDING
    }
    case 2: {
      return ValidatorStatus.ACTIVE
    }
    default: {
      return ValidatorStatus.UNKNOWN
    }
  }
}

export async function saveValidatorDetail(
  lcdValidator: LcdValidator,
  validatorSets: LcdValidatorSet[],
  activePrices: CoinByDenoms,
  votingPowers: VotingPower
) {
  if (!lcdValidator) {
    throw new APIError(ErrorTypes.VALIDATOR_DOES_NOT_EXISTS)
  }

  const { operator_address: operatorAddress, consensus_pubkey: consensusPubkey } = lcdValidator
  const accountAddress = convertValAddressToAccAddress(operatorAddress)
  const consensusAddress = validatorSets.find((v) => v.pub_key === consensusPubkey)?.address
  const totalVotingPower = votingPowers.totalVotingPower
  const votingPower = votingPowers.votingPowerByPubKey[consensusPubkey]
  const keyBaseId = lcdValidator.description?.identity

  const [delegators, missedVote, signingInfo, lcdRewardPool, profileIcon] = await Promise.all([
    getDelegators(operatorAddress).catch(() => [] as Delegator[]),
    lcd.getMissedOracleVotes(operatorAddress),
    lcd.getSigningInfo(consensusPubkey).catch(() => ({} as LcdValidatorSigningInfo)),
    lcd.getValidatorRewards(operatorAddress).catch(() => [] as LcdRewardPoolItem[]),
    keyBaseId && getAvatar(keyBaseId)
  ])

  const selfDelegation = getSelfDelegation(delegators, accountAddress)

  const upTime = getUptime(signingInfo)
  let rewardPoolTotal = '0'
  const rewardPool = lcdRewardPool
    ? lcdRewardPool.map(({ denom, amount }: LcdRewardPoolItem) => {
        const adjustedAmount: string =
          denom === 'uluna' ? amount : activePrices[denom] ? div(amount, activePrices[denom]) : '0'
        rewardPoolTotal = plus(rewardPoolTotal, adjustedAmount)
        return { denom, amount, adjustedAmount }
      })
    : []

  const { details, identity, moniker, website } = lcdValidator.description
  const validatorDetails: DeepPartial<ValidatorInfoEntity> = {
    chainId: config.CHAIN_ID,
    operatorAddress,
    consensusAddress,
    consensusPubkey,
    accountAddress,
    details,
    identity,
    moniker,
    website,
    tokens: lcdValidator.tokens,
    delegatorShares: lcdValidator.delegator_shares,
    unbondingHeight: +lcdValidator.unbonding_height,
    unbondingTime: new Date(lcdValidator.unbonding_time),
    profileIcon: profileIcon ? profileIcon : '',
    status: getValidatorStatus(lcdValidator),
    jailed: lcdValidator.jailed,
    missedOracleVote: +missedVote,
    upTime,
    votingPower: times(votingPower, TOKEN_MICRO_UNIT_MULTIPLICAND),
    votingPowerWeight: div(votingPower, totalVotingPower),
    commissionRate: lcdValidator.commission.commission_rates.rate,
    maxCommissionRate: lcdValidator.commission.commission_rates.max_rate,
    maxCommissionChangeRate: lcdValidator.commission.commission_rates.max_change_rate,
    rewardPoolTotal,
    commissionChangeDate: new Date(lcdValidator.commission.update_time),
    selfDelegation: selfDelegation.amount,
    selfDelegationWeight: selfDelegation.weight,
    signingInfo,
    rewardPool: sortDenoms(rewardPool)
  }

  const repo = getRepository(ValidatorInfoEntity)
  const validator = await repo.findOne({ operatorAddress, chainId: config.CHAIN_ID })

  if (!validator) {
    await repo.save(repo.create(validatorDetails))
  } else {
    await repo.update(validator.id, validatorDetails)
  }
}
