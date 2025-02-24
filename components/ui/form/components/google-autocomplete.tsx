import {
  Field,
  FormikErrors,
  FormikTouched,
  FormikValues,
  useFormikContext,
} from 'formik';
import React, { useState } from 'react';

import {
  GoogleMap,
  useJsApiLoader,
  StandaloneSearchBox,
  Libraries,
  Autocomplete,
} from '@react-google-maps/api';
import { DynamicFieldType } from '@/lib/types/utils/form';
import { FormLabelComponent } from './form-label';
import { Input } from '../../input';
import { ErrorMessage } from './error-message';
type PlaceResult = google.maps.places.PlaceResult;
const VALIDCOUNTRIES = ['CA', 'US'];
const INCONSISTENT_STATES: string[][] = [
  ['Buenos Aires', 'Provincia de Buenos Aires'],
];
const LIBRARIES: Libraries = ['places'];

const GoogleAutoCompleteInput = ({
  name,
  label,
  icon,
  type,
  required,
  min,
  max,
  disabled,
  readonly,
  placeholder,
  variant,
  values,
  initial,
  errors,
  validationRules,
  touched,
}: Partial<DynamicFieldType> & {
  countries?: string[];
  values: FormikValues;
  validationRules: any;
  errors: FormikErrors<any>;
  touched: FormikTouched<any>;
}) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY as string,
    libraries: LIBRARIES,
    region: 'AR',
  });

  //-----------
  const [address, setAddress] = useState<google.maps.places.Autocomplete>();

  const { setFieldValue }: any = useFormikContext();
  const onLoad = (address: google.maps.places.Autocomplete) => {
    setAddress(address);
  };
  const handleSelect = async () => {
    if (!address) return;
    const place = address.getPlace();
    console.log(place);
    if (!place) return;
    const full_address = place.address_components
      ?.reduce((acc: string, result: any) => {
        switch (result.types[0]) {
          case 'route':
            acc += result.long_name + ', ';
            break;
          case 'street_number':
            acc += result.long_name + ' ';
            break;
          case 'administrative_area_level_2':
            acc += result.long_name + ', ';
            break;
          case 'administrative_area_level_1':
            acc += result.long_name;
            break;
          case 'postal_code':
          case 'country':
            return acc;
        }
        return acc;
      }, '')
      .trim()
      .replace(/,\s*$/, ''); // Remueve coma final si existe
    setFieldValue('address', full_address);
    place.address_components?.forEach((component) => {
      let componentType = component.types[0];
      let longNameValue = component.long_name;
      let shortNameValue = component.short_name;
      switch (componentType) {
        case 'country':
          let country = longNameValue;
          // if (!VALIDCOUNTRIES.includes(shortNameValue)) {
          //   country = 'INTERNATIONAL';
          // }
          setFieldValue('country', shortNameValue);
          break;
        case 'administrative_area_level_1':
          INCONSISTENT_STATES.forEach(([suggestion, actual_state]) => {
            if (suggestion === longNameValue) {
              longNameValue = actual_state;
            }
          });
          setFieldValue('province', longNameValue);
          break;
        case 'administrative_area_level_2':
          setFieldValue('city', longNameValue);
          break;
        case 'postal_code':
          setFieldValue('postal', longNameValue);
          break;
        case 'street_number':
          setFieldValue('street_number', longNameValue);
          break;
        case 'route':
          setFieldValue('street_name', longNameValue);
          break;
        default:
          return;
      }
    });
  };

  return (
    <div>
      {isLoaded && (
        <>
          <FormLabelComponent
            label={label || ''}
            id={name || ''}
            required={required}
          />
          <Autocomplete
            options={{
              componentRestrictions: { country: 'AR' },
            }}
            onPlaceChanged={handleSelect}
            onLoad={onLoad}
          >
            <Field name={name} validate={validationRules}>
              {({ field, meta, form }: any) => (
                <Input
                  {...field}
                  id={name}
                  name={name}
                  icon={icon}
                  type={type}
                  required={required}
                  min={min}
                  value={values[name || ''] || initial || ''}
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
          </Autocomplete>
          <ErrorMessage errors={errors} id={name || ''} touched={touched} />
        </>
      )}
    </div>
  );
};

export default GoogleAutoCompleteInput;
