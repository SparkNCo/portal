import { cn } from '@/lib/utils';

export const FormLabelComponent = ({
  label,
  id,
  required,
  className,
  description,
  help,
  ...props
}: {
  label: string;
  id?: string;
  help?: string;
  required?: boolean;
  description?: string;
  className?: string;
  [x: string]: any;
}) => {
  return (
    <div className="flex flex-col  gap-1 w-full">
      <div className="flex items-center w-full">
        <label {...props} htmlFor={id} className={` text-sm mr-1 ${className}`}>
          {label}
        </label>
        {required && <span className="text-red-500">*</span>}
        {help && (
          <span className="text-sm text-muted-foreground ml-1">{help}</span>
        )}
      </div>
      {description && (
        <p
          className={cn('text-[0.8rem] text-muted-foreground', className)}
          {...props}
        >
          {description}
        </p>
      )}
    </div>
  );
};
