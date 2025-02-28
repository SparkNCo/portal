import { FormikTouched } from 'formik';
import { CircleAlert } from 'lucide-react';

export const ErrorMessage = ({
  errors,
  id,
  touched,
  index,
}: {
  errors: any;
  id?: string;
  touched: FormikTouched<any>;
  index?: number;
}) => {
  if (!id) {
    return null;
  }
  const errorValue = errors[id];
  const touchedValue = touched[id];
  if (!errorValue || !touchedValue) return null;

  const getErrorText = (): string | null => {
    if (typeof errorValue === 'string') return errorValue;

    if (Array.isArray(errorValue) && index !== undefined) {
      if (errorValue[index] === undefined) return null;

      if (typeof errorValue[index] === 'string') return errorValue[index];
      if (typeof errorValue[index] === 'object' && id)
        return errorValue[index][id] || null;
    }

    return null;
  };

  const errorText = getErrorText();

  if (!errorText) return null;

  return (
    <div className="text-destructive dark:text-destructive flex items-center gap-1 mt-1 text-sm">
      <CircleAlert className="text-destructive w-4 h-4" />
      <span>{errorText}</span>
    </div>
  );
};
