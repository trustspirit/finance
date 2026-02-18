export const UNIQUE_BUDGET_CODES = [5862, 5110, 5400, 5200, 4500] as const

// i18n key for budget code labels: t(`budgetCode.${code}`)
// i18n key for budget code item descriptions: t(`budgetCode.items.${descKey}`)

export interface BudgetCodeOption {
  code: number
  category: string
  descKey: string
}

export const BUDGET_CODES: BudgetCodeOption[] = [
  { code: 5862, category: 'Lodging', descKey: 'lodging' },
  { code: 5862, category: 'Lodging', descKey: 'otherLodging' },
  { code: 5862, category: 'Facilities', descKey: 'facilityRental' },
  { code: 5862, category: 'Facilities', descKey: 'equipmentRental' },
  { code: 5862, category: 'Facilities', descKey: 'otherFacilities' },
  { code: 5110, category: 'Transportation', descKey: 'transportParticipants' },
  { code: 5110, category: 'Transportation', descKey: 'transportCommittee' },
  { code: 5110, category: 'Transportation', descKey: 'otherTransport' },
  { code: 5400, category: 'Meals', descKey: 'meals' },
  { code: 5400, category: 'Meals', descKey: 'otherMeals' },
  { code: 5400, category: 'Insurance', descKey: 'insuranceParticipants' },
  { code: 5400, category: 'Insurance', descKey: 'insuranceVolunteers' },
  { code: 5400, category: 'Insurance', descKey: 'otherInsurance' },
  { code: 5200, category: 'Activity', descKey: 'activityMaterials' },
  { code: 5200, category: 'Activity', descKey: 'eventMaterials' },
  { code: 5400, category: 'Activity', descKey: 'refreshments' },
  { code: 5200, category: 'Activity', descKey: 'stationery' },
  { code: 5200, category: 'Activity', descKey: 'tshirts' },
  { code: 5400, category: 'Activity', descKey: 'otherActivity' },
  { code: 5400, category: 'Administration', descKey: 'promotion' },
  { code: 5200, category: 'Administration', descKey: 'posters' },
  { code: 5200, category: 'Administration', descKey: 'pamphlets' },
  { code: 5400, category: 'Administration', descKey: 'communication' },
  { code: 5400, category: 'Administration', descKey: 'meetingMeals' },
  { code: 5110, category: 'Administration', descKey: 'meetingLodging' },
  { code: 5400, category: 'Administration', descKey: 'otherPreparation' },
  { code: 5400, category: 'Administration', descKey: 'otherAdmin' },
  { code: 4500, category: 'Other', descKey: 'participationFee' },
]
