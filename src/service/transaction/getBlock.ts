import { BlockEntity } from 'orm'
import { getRepository } from 'typeorm'
import config from 'config'
import { omit } from 'lodash'

export async function getBlock(height: number): Promise<Partial<BlockEntity> | null> {
  const blockEntity = await getRepository(BlockEntity).findOne(
    { chainId: config.CHAIN_ID, height },
    {
      relations: ['txs']
    }
  )

  if (!blockEntity) {
    return null
  }

  return omit(blockEntity, ['id'])
}
