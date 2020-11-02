import { Column, Entity, PrimaryGeneratedColumn, Index, OneToOne, JoinColumn } from 'typeorm'

import BlockEntity from './BlockEntity'

@Entity('blockreward')
export default class BlockRewardEntity {
  @PrimaryGeneratedColumn()
  id: number

  @Column({ nullable: true })
  height: number

  @Index('blockreward_timestamp')
  @Column({ nullable: true })
  timestamp: Date

  @Index('blockreward_chain_id')
  @Column({ nullable: true })
  chainId: string

  @Column({ type: 'jsonb' })
  reward: CoinByDenoms

  @Column({ type: 'jsonb' })
  commission: CoinByDenoms

  @Column({ type: 'jsonb' })
  rewardPerVal: { [operatorAddress: string]: CoinByDenoms }

  @Column({ type: 'jsonb' })
  commissionPerVal: { [operatorAddress: string]: CoinByDenoms }

  @Index('block_reward_block')
  @OneToOne(() => BlockEntity, (block) => block.reward, { onDelete: 'CASCADE' })
  @JoinColumn()
  block: BlockEntity
}
