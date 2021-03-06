import { DashboardEntity } from 'orm'

import { getDashboardHistory } from './dashboardHistory'

export default async function getRegisteredAccounts(daysBefore?: number): Promise<AccountStatReturn> {
  let prevDaysHistory

  if (daysBefore) {
    // getting an extra days history to get daysBefore amount of history in periodic property
    prevDaysHistory = daysBefore + 1
  }
  const dashboards = await getDashboardHistory(prevDaysHistory)

  if (dashboards.length === 0) {
    return {
      total: 0,
      periodic: [],
      cumulative: []
    }
  }

  const cumulativeRegistered: CountInfoByDate[] = dashboards.map((item: DashboardEntity) => ({
    datetime: item.timestamp.getTime(),
    value: item.totalAccount
  }))

  const periodicRegistered: CountInfoByDate[] = dashboards.map((item: DashboardEntity, index) => ({
    datetime: item.timestamp.getTime(),
    value: item.totalAccount - (index > 0 ? dashboards[index - 1].totalAccount : 0)
  }))

  const index = dashboards.length - prevDaysHistory > 0 ? dashboards.length - prevDaysHistory : 0

  return {
    total: dashboards[dashboards.length - 1].totalAccount - (daysBefore ? dashboards[index].totalAccount : 0),
    periodic: periodicRegistered.slice(1),
    cumulative: cumulativeRegistered.slice(1)
  }
}
