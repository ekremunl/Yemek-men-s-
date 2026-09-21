// lib/menu-generator/index.ts
export { generateMonthlyMenu, validateMonthlyMenu, MenuGenerationError } from './generator';
export type { FailureDiagnostics, RuleViolation } from './generator';
export { RULES, findViolation } from './rules';
export type { Rule, RuleId, RuleContext } from './rules';
export { DEFAULT_CONFIG } from './config';
export type { GeneratorConfig, GeneratorOptions, ScoringWeights, SoftPairing } from './config';
export type {
  Dish,
  DishCategory,
  DayMenu,
  Meal,
  MealSlot,
  MonthlyMenu,
  Tag,
  KnownTag,
} from './types';
