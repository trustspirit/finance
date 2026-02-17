export interface BudgetCodeOption {
  code: number
  category: string
  description: string
}

export const BUDGET_CODES: BudgetCodeOption[] = [
  { code: 5862, category: 'Lodging', description: 'Lodging' },
  { code: 5862, category: 'Lodging', description: 'Other Lodging Related Expenses' },
  { code: 5862, category: 'Facilities', description: 'Facility Rental' },
  { code: 5862, category: 'Facilities', description: 'Equipment Rental' },
  { code: 5862, category: 'Facilities', description: 'Other Facilities Related Expenses' },
  { code: 5110, category: 'Transportation', description: 'Transportation for Participants' },
  { code: 5110, category: 'Transportation', description: 'Transportation for Committee Members' },
  { code: 5110, category: 'Transportation', description: 'Other Transportation Related Expenses' },
  { code: 5400, category: 'Meals', description: 'Meals' },
  { code: 5400, category: 'Meals', description: 'Other Meals' },
  { code: 5400, category: 'Insurance', description: 'Participants Insurance' },
  { code: 5400, category: 'Insurance', description: 'Volunteers Insurance' },
  { code: 5400, category: 'Insurance', description: 'Other Insurance Expenses' },
  { code: 5200, category: 'Activity', description: 'Activity Materials' },
  { code: 5200, category: 'Activity', description: 'Event Materials' },
  { code: 5400, category: 'Activity', description: 'Refreshments' },
  { code: 5200, category: 'Activity', description: 'Stationery' },
  { code: 5200, category: 'Activity', description: 'T-Shirts' },
  { code: 5400, category: 'Activity', description: 'Other Activity & Program Expenses' },
  { code: 5400, category: 'Administration', description: 'Promotion Expenses' },
  { code: 5200, category: 'Administration', description: 'Posters and Post Cards' },
  { code: 5200, category: 'Administration', description: 'Pamphlets' },
  { code: 5400, category: 'Administration', description: 'Communication Expenses' },
  { code: 5400, category: 'Administration', description: 'Meeting Refreshments & Meals' },
  { code: 5110, category: 'Administration', description: 'Meeting Lodging' },
  { code: 5400, category: 'Administration', description: 'Other Preparation Expenses' },
  { code: 5400, category: 'Administration', description: 'Other Administrative Expenses' },
  { code: 4500, category: 'Other', description: 'Participation Fee' },
]
