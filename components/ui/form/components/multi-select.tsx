'use client';
import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { DynamicFieldType, OptionType } from '@/lib/types/utils/form';
import {
  Field,
  FormikErrors,
  FormikTouched,
  FormikValues,
  useFormikContext,
} from 'formik';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../../command';
import { FormLabelComponent } from './form-label';
import { ErrorMessage } from './error-message';

interface MultiSelectInputProps {
  field: DynamicFieldType;
  values: FormikValues;
  errors: FormikErrors<any>;
  touched: FormikTouched<any>;
  options: OptionType[];
  validationRules: any;
}

export function MultiSelectInput({
  values,
  errors,
  touched,
  field,
  options,
  validationRules,
}: MultiSelectInputProps) {
  const [open, setOpen] = React.useState(false);
  const [selectedOptions, setSelectedOptions] = React.useState<string[]>(
    values[field?.name] || []
  );
  const { setFieldValue } = useFormikContext();

  React.useEffect(() => {
    setFieldValue(field?.name, selectedOptions);
  }, [selectedOptions]);

  const handleSelect = (currentValue: string) => {
    if (selectedOptions.includes(currentValue)) {
      setSelectedOptions(selectedOptions.filter((v) => v !== currentValue));
    } else {
      setSelectedOptions([...selectedOptions, currentValue]);
    }
  };

  const handleRemove = (typeToRemove: string) => {
    setSelectedOptions(selectedOptions.filter((v) => v !== typeToRemove));
  };
  return (
    <div className={cn('', field?.class)}>
      <FormLabelComponent
        help={field?.help}
        label={field?.label}
        id={field?.name}
        required={field?.required}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="justify-between w-full"
          >
            <span className="truncate">
              {selectedOptions.length === 0
                ? field?.placeholder
                : `${selectedOptions.length} selected`}
            </span>
            <ChevronsUpDown className="w-4 h-4 ml-2 opacity-50 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0 ">
          <Command>
            <CommandInput placeholder={field?.placeholder} />
            <CommandList>
              <CommandEmpty>No options found.</CommandEmpty>
              <CommandGroup>
                {options.map((option) => (
                  <CommandItem
                    key={option.value}
                    onSelect={() => handleSelect(option.value)}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedOptions.includes(option.value)
                          ? 'opacity-100'
                          : 'opacity-0'
                      )}
                    />
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Field
        type="hidden"
        name={field?.name}
        value={selectedOptions}
        validate={validationRules}
      />
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {selectedOptions.map((option) => {
            const selectedOption = options.find((o) => o.value === option);
            if (!selectedOption) return null;
            return (
              <Badge
                key={option}
                variant="secondary"
                className="flex items-center gap-1"
              >
                {selectedOption.label}
                <button
                  type="button"
                  className="rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleRemove(option);
                    }
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => {
                    // if (field?.required && selectedOptions.length === 1) {
                    //   return;
                    // }
                    handleRemove(option);
                  }}
                >
                  <X className="w-3 h-3 text-muted-foreground hover:text-foreground" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}
      <ErrorMessage errors={errors} id={field?.name} touched={touched} />
    </div>
  );
}
