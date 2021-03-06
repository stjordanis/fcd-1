import got from 'got'
import { exec } from 'child_process'
import { get } from 'lodash'

import { FCD_PORT, FCD_PM2_PROCESS_NAME } from './constants'
import { create, update } from './pagerduty'

let alive = true
let incidentId: string | undefined
let downTimestamp: number | undefined

const alert = async (): Promise<void> => {
  const res = await create('Fcd is down.')
  const id = get(res, 'incident.id')
  incidentId = id
}

const resolve = async (): Promise<void> => {
  if (incidentId) {
    await update(incidentId, 'resolved')
  }
  incidentId = undefined
}

const fcdHealthCheck = async (): Promise<boolean> => {
  return got
    .get(`http://localhost:${FCD_PORT}/health`)
    .then((res) => {
      if (!res || res.body !== 'OK') {
        return false
      }

      return true
    })
    .catch(() => false)
}

export default async (): Promise<void> => {
  const aliveNow = await fcdHealthCheck()
  console.log(`fcd alive: ${aliveNow}`)
  const now = Date.now()

  // up => down
  if (!aliveNow && alive) {
    await alert()
    downTimestamp = now
    // down => up
  } else if (aliveNow && !alive) {
    await resolve()
    downTimestamp = undefined
  }

  // restart fcd if down condition persists for 5 minutes
  if (!aliveNow && downTimestamp && now - downTimestamp > 1000 * 60 * 5) {
    exec(`pm2 restart ${FCD_PM2_PROCESS_NAME}`, () => {
      downTimestamp = now
    })
  }

  alive = aliveNow
}
