import { Field, FormikErrors, FormikTouched, FormikValues } from 'formik';
import { FormLabelComponent } from './form-label';
import { Textarea } from '../../textarea';
import { ErrorMessage } from './error-message';
import { DynamicFieldType } from '@/lib/types/utils/form';

export const TextAreaInput = ({
  field,
  errors,
  touched,
  validationRules,
}: {
  field: DynamicFieldType;
  values: FormikValues;
  errors: FormikErrors<any>;
  touched: FormikTouched<any>;
  validationRules: any;
}) => {
  return (
    <div key={field?.name} className={field?.class}>
      <FormLabelComponent
        help={field?.help}
        label={field?.label}
        id={field?.name}
        required={field?.required}
      />
      <Field name={field.name} validate={validationRules}>
        {({ field, meta, form }: any) => (
          <Textarea
            {...field}
            required={field?.required}
            disabled={field?.disabled}
            readOnly={field?.readonly}
            rows={6}
            placeholder={
              (field?.placeholder && field?.placeholder) || field?.label
            }
          />
        )}
      </Field>

      <ErrorMessage
        errors={errors}
        id={field?.name}
        touched={touched}
        key={field?.name}
      />
    </div>
  );
};
