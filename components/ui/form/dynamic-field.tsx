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
  getTags,
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
import { Textarea } from '../textarea';
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
    tags,
  } = field;
  if (hide) {
    const hidden = itsHidden(field, values);
    if (hidden) {
      if (name in values) {
        if (field.type === 'select' && options) {
          values[name] = options[0];
        } else {
          values[name] = initial || '';
        }
      }
      return;
    }
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
  }, [values[name]]);
  switch (fieldType) {
    case 'subtitle':
      return (
        <p
          className={`text-base mb-4 border-l-2 py-2 pl-2 border-foreground  ${className}`}
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
        <div key={name} className={className || 'basis-full'}>
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

    case 'select':
      return (
        <div className={className}>
          <FormLabelComponent
            help={help}
            label={label}
            id={name}
            description={description}
            required={required}
          />
          <Field
            as={Select}
            validate={validationRules}
            name={name}
            id={name}
            required={required}
            value={values[name] || initial}
            placeholder={placeholder || label}
            readOnly={readonly}
            disabled={isDisabled}
            onValueChange={(value: string | string[]) => {
              if (multiple) {
                setFieldValue(name, Array.isArray(value) ? value : [value]);
              } else {
                setFieldValue(name, value);
              }
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder={placeholder || label}>
                {/* {multiple
                  ? (values[name] || [])
                      .map(
                        (val: string) => opt.find((o) => o.value === val)?.label
                      )
                      .join(', ')
                  : opt.find((o) => o.value === values[name])?.label ||
                    placeholder ||
                    label} */}
                {(() => {
                  const selectedOption = opt.find(
                    (o) => o.value === values[name]
                  );

                  return selectedOption ? (
                    <p className="flex items-center justify-between w-full gap-4">
                      {selectedOption?.icon && iconMap[selectedOption.icon]}
                      <span>{selectedOption.label}</span>
                    </p>
                  ) : (
                    <span>{placeholder || label}</span>
                  );
                })()}
              </SelectValue>
            </SelectTrigger>
            {!readonly && (
              <SelectContent className="max-h-[200px]">
                <SelectGroup>
                  {selectOptionsTitle && (
                    <SelectLabel>{selectOptionsTitle}</SelectLabel>
                  )}
                  {opt?.map((option) => (
                    <SelectItem
                      className="cursor-pointer w-full"
                      key={option.value}
                      disabled={option.isDisabled}
                      value={option.value}
                    >
                      <div className="flex items-center justify-between w-full gap-4">
                        {option.icon && <span>{iconMap[option.icon]}</span>}
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
          </Field>
          <ErrorMessage errors={errors} id={name} touched={touched} />
        </div>
      );
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
        <div key={name} className={className}>
          <FormLabelComponent
            help={help}
            label={label}
            id={name}
            required={required}
          />
          <Field name={name} validate={validationRules}>
            {({ field, meta, form }: any) => (
              <Input
                {...field}
                id={name}
                name={name}
                icon={icon}
                type={fieldType}
                required={required}
                min={min}
                value={values[name] || initial || ''}
                max={max}
                disabled={disabled}
                readOnly={readonly}
                placeholder={(placeholder && placeholder) || label}
                onWheel={(e) => {
                  e?.preventDefault();
                  field.onBlur(e);
                  form.setFieldTouched(name, true);
                }}
                variant={variant || 'outline'}
              />
            )}
          </Field>

          <ErrorMessage errors={errors} id={name} touched={touched} />
        </div>
      );
  }
}
