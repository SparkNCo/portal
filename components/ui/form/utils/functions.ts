import {
  DynamicFieldType,
  FormPageType,
  LayoutType,
  OptionType,
  TagType,
} from '@/lib/types/utils/form';
import {
  validateDOB,
  validateEmail,
  validatePhone,
  validateProjectRequirements,
} from '../utils/validations';
import dayjs from 'dayjs';
import { projectRequirementOptions, projectStatusOptions } from './options';

export const getInitialValues = (layout: LayoutType, values: any = {}) => {
  const initialValues: any = {};

  const setInitialValue = (field: DynamicFieldType) => {
    if (field?.name) {
      if (values[field.name]) {
        initialValues[field.name] = values[field.name];
      } else if ('initial' in field) {
        initialValues[field.name] = field.initial;
      } else if (field.type == 'select' && field?.options) {
        initialValues[field.name] = field.options[0];
      } else if (field.type == 'number') {
        initialValues[field.name] = 0;
      } else {
        initialValues[field.name] = '';
      }
    }
  };

  layout?.forEach((step: FormPageType) => {
    step?.fields?.forEach((field: DynamicFieldType | DynamicFieldType[]) => {
      if (Array.isArray(field)) {
        field?.forEach(setInitialValue);
      } else {
        setInitialValue(field);
      }
    });
  });

  Object.keys(values).forEach((key) => {
    if (!(key in initialValues)) {
      initialValues[key] = values[key];
    }
  });

  return initialValues;
};

export const getSelectOptions = ({
  options,
  name,
  disabled,
  values,
  custom_options,
}: {
  options?: OptionType[] | string;
  name: string;
  disabled: boolean;
  values: any;
  custom_options: {};
}): { opt: OptionType[]; isDisabled: boolean } => {
  let opt: OptionType[] = []; // Initialize as an empty array
  let isDisabled: boolean = disabled;
  if (name == 'project_status') {
    opt = projectStatusOptions;
  }
  if (name == 'project_requirements') {
    opt = projectRequirementOptions;
  }
  if (
    options &&
    Array.isArray(options) &&
    typeof options !== 'string' &&
    options.length
  ) {
    opt = options; // If options are valid, assign them directly
  }
  // If after validating all the above, "opt" is still empty, then add a default option
  if (opt.length === 0) {
    opt = [{ label: 'No options', value: 'empty-opt', isDisabled: true }];
  }

  return { opt, isDisabled };
};

export const switchFieldType = (
  field: DynamicFieldType | DynamicFieldType[],
  values: any
): string => {
  if (Array.isArray(field)) {
    return 'text';
  }
  switch (field.type) {
    default:
      return field.type;
  }
};
export const getValidationRule = (field: any) => {
  switch (field.type) {
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    default:
      return field?.name;
  }
};
export const getMinValue = (field: DynamicFieldType, values: any) => {
  const pred_min_values: any = {
    today: dayjs().format('YYYY-MM-DD'),
  };
  if (field?.min) {
    const min: number = pred_min_values[field?.min] || field.min;
    return min;
  }
};
export const itsHidden = (field: DynamicFieldType, values: any) => {
  const langSpecificHide = field.hide;
  const statesToCheck = langSpecificHide || field.hide || {};

  const hideEntries = Object.entries(statesToCheck);
  const allHidden = hideEntries.some(([key, states]: [string, any]) => {
    return states.includes(values[key]);
  });
  return allHidden;
};
export const itsTitleHidden = (
  field: DynamicFieldType,
  prescreen_settings: any
) => {
  const statesToCheck = field?.conditions;
  const someFieldIsIncluded = prescreen_settings.some((item: any) => {
    let isIncluded = statesToCheck?.includes(item);
    return isIncluded;
  });
  return someFieldIsIncluded;
};

export const requiredFields = (required?: boolean) => {
  return (value: any) => {
    if (required) {
      if (typeof value == 'undefined' || !value || (required && value === '')) {
        return 'Required field';
      }
    }
  };
};
export const getTags = (name: string): TagType[] => {
  switch (name) {
    default:
      return [];
  }
};

export const validations = (values: any, required?: boolean, max?: number) => ({
  email: (value: string) => validateEmail(value),
  phone: (value: string) => validatePhone(value, required),
  birthDate: (value: string) => validateDOB(value),
  project_requirements: (value: string[]) => validateProjectRequirements(value),
});
