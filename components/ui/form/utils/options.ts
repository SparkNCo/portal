import { OptionType } from '@/lib/types/utils/form';
import { ProjectStatusEnum } from '@/lib/types/db/proposals';
export const projectRequirementOptions: OptionType[] = [
  {
    value: 'add_product_offering',
    label: 'Add Product Offering,',
    icon: 'dollar',
  },
  {
    value: 'new_feature',
    label: 'New Feature',
    icon: 'trending-up',
  },
  {
    value: 'migrate_legacy_systems',
    label: 'Migrate Legacy Systems',
    icon: 'crown',
  },
  {
    value: 'automate_operations',
    label: 'Automate Operations',
    icon: 'lightbulb',
  },
];
export const projectStatusOptions: OptionType[] = [
  {
    value: ProjectStatusEnum.NEW_IDEA,
    label: 'New Idea',
    icon: 'lightbulb',
  },
  {
    value: ProjectStatusEnum.GENERATING_REVENUE,
    label: 'Generating Revenue',
    icon: 'dollar',
  },
  {
    value: ProjectStatusEnum.GROWTH_PHASE,
    label: 'Growth Phase',
    icon: 'trending-up',
  },
  {
    value: ProjectStatusEnum.INDUSTRY_LEADER,
    label: 'Industry Leader',
    icon: 'crown',
  },
];
