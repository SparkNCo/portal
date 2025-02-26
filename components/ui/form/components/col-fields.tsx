import { DynamicFieldProps } from '@/lib/types/utils/form';
import { DynamicField } from './dynamic-field';

export const ColsFields = ({
  values,
  field: cols,
  errors,
  touched,
}: DynamicFieldProps) => {
  if (!Array.isArray(cols)) return null;
  return (
    <div className="flex items-center justify-between flex-wrap sm:flex-nowrap w-full gap-2">
      {cols?.map((col, colIndex) => {
        return (
          <div key={colIndex} className="w-full">
            <DynamicField
              touched={touched}
              errors={errors}
              key={`col-${col.name}-${colIndex}`}
              field={col}
              values={values}
            />
          </div>
        );
      })}
    </div>
  );
};
