import * as lcd from 'lib/lcd'
import { collectorLogger as logger } from 'lib/logger'
import { calculateVotingPowers } from 'service/staking'

import { saveValidatorDetail } from './validatorDetails'

export async function collectValidator() {
  logger.info('Validator collector started.')
  const validatorList = await lcd.getValidators()
  logger.info(`Got a list of ${validatorList.length} validators`)
  const validatorSets = await lcd.getValidatorSets()
  const votingPowers = calculateVotingPowers(validatorSets)
  const activePrices = await lcd.getActiveOraclePrices()

  for (const lcdValidator of validatorList) {
    logger.info(`Updating validator ${lcdValidator.operator_address}`)

    try {
      await saveValidatorDetail(lcdValidator, validatorSets, activePrices, votingPowers)
      logger.info('Update complete')
    } catch (error) {
      logger.info('Could not save validator info due to error ', lcdValidator.operator_address)
      logger.error(error)
    }
  }

  logger.info('Validator collector completed.')
}
