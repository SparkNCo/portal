import { Field, useFormikContext } from 'formik';
import React from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../select';
import { Input } from '../input';
import { DynamicFieldProps } from '@/lib/types/utils/form';
import { ColsFields } from './components/col-fields';
import {
  getSelectOptions,
  getValidationRule,
  itsHidden,
  requiredFields,
  switchFieldType,
  validations,
} from './utils/functions';
import GoogleAutoCompleteInput from './components/google-autocomplete';
import { FormLabelComponent } from './components/form-label';
import { HelpTooltip } from '../help-tooltip';
import { iconMap } from './components/icon-map';
import { ErrorMessage } from './components/error-message';
import './styles.css';
import { TextAreaInput } from './components/textarea';
import { MultiSelectInput } from './components/multi-select';

export function DynamicField({
  field,
  values,
  errors,
  touched,
}: DynamicFieldProps) {
  const { setFieldValue } = useFormikContext();

  if (Array.isArray(field)) {
    return (
      <ColsFields
        field={field}
        errors={errors}
        touched={touched}
        values={values}
      />
    );
  }

  const {
    name,
    type,
    label,
    placeholder,
    initial,
    required,
    options,
    hide,
    class: className,
    variant,
    icon,
    disabled = false,
    min,
    readonly,
    max,
    help,
    multiple,
    description,
    selectOptionsTitle,
  } = field;

  // -----------------------------
  // Visibility Handling (SAFE)
  // -----------------------------
  if (hide && itsHidden(field, values)) {
    if (name in values) {
      if (type === 'select' && options?.length) {
        setFieldValue(name, options[0]);
      } else {
        setFieldValue(name, initial ?? '');
      }
    }
    return null;
  }

  const fieldType = switchFieldType(field, values);

  const validationRule = getValidationRule(field);
  const validationRules =
    validations(values, required, max)[
      validationRule as keyof typeof validations
    ] || requiredFields(required);

  const { opt, isDisabled } = React.useMemo(() => {
    return getSelectOptions({
      options,
      name,
      disabled,
      values,
      custom_options: {
        countries: [{ value: 'AR', label: 'Argentina' }],
      },
    });
  }, [values[name], options, disabled, name, values]);

  const currentValue = values[name] ?? initial ?? '';

  // =====================================================
  // RENDER TYPES
  // =====================================================

  switch (fieldType) {
    case 'subtitle':
      return (
        <p
          className={`text-base mb-4 border-l-2 py-2 pl-2 border-foreground ${className}`}
        >
          {label}
        </p>
      );

    case 'textarea':
      return (
        <TextAreaInput
          field={field}
          values={values}
          errors={errors}
          touched={touched}
          validationRules={validationRules}
        />
      );

    case 'address_autocomplete':
      return (
        <div className={className || 'basis-full'}>
          <GoogleAutoCompleteInput
            {...field}
            values={values}
            errors={errors}
            touched={touched}
            validationRules={validationRules}
            countries={['AR']}
          />
        </div>
      );

    case 'select': {
      const selectedOption = opt?.find(
        (o) => o.value === currentValue
      );

      return (
        <div className={className}>
          <FormLabelComponent
            help={help}
            label={label}
            id={name}
            description={description}
            required={required}
          />

          <Select
            value={currentValue}
            disabled={isDisabled || readonly}
            onValueChange={(value: string | string[]) => {
              if (multiple) {
                setFieldValue(
                  name,
                  Array.isArray(value) ? value : [value]
                );
              } else {
                setFieldValue(name, value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder ?? label}>
                {selectedOption ? (
                  <div className="flex items-center justify-between w-full gap-4">
                    {selectedOption.icon &&
                      iconMap[selectedOption.icon]}
                    <span>{selectedOption.label}</span>
                  </div>
                ) : (
                  <span>{placeholder ?? label}</span>
                )}
              </SelectValue>
            </SelectTrigger>

            {!readonly && (
              <SelectContent className="max-h-[200px]">
                <SelectGroup>
                  {selectOptionsTitle && (
                    <SelectLabel>
                      {selectOptionsTitle}
                    </SelectLabel>
                  )}

                  {opt?.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value}
                      disabled={option.isDisabled}
                      className="cursor-pointer w-full"
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        {option.icon && (
                          <span>
                            {iconMap[option.icon]}
                          </span>
                        )}
                        <span>{option.label}</span>
                        {option.info && (
                          <HelpTooltip icon={iconMap['help']}>
                            {option.info}
                          </HelpTooltip>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            )}
          </Select>

          <ErrorMessage
            errors={errors}
            id={name}
            touched={touched}
          />
        </div>
      );
    }

    case 'multiselect':
      return (
        <MultiSelectInput
          field={field}
          options={opt}
          values={values}
          errors={errors}
          touched={touched}
          validationRules={validationRules}
        />
      );

    default:
      return (
        <div className={className}>
          <FormLabelComponent
            help={help}
            label={label}
            id={name}
            required={required}
          />

          <Field name={name} validate={validationRules}>
            {({ field: formikField, form }: any) => (
              <Input
                {...formikField}
                id={name}
                name={name}
                icon={icon}
                type={fieldType}
                required={required}
                min={min}
                max={max}
                disabled={disabled}
                readOnly={readonly}
                placeholder={placeholder ?? label}
                value={currentValue}
                variant={variant ?? 'outline'}
                onWheel={(e) => {
                  e.preventDefault();
                  formikField.onBlur(e);
                  form.setFieldTouched(name, true);
                }}
              />
            )}
          </Field>

          <ErrorMessage
            errors={errors}
            id={name}
            touched={touched}
          />
        </div>
      );
  }
}