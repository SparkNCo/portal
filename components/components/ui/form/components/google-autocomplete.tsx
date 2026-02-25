import {
  Field,
  FormikErrors,
  FormikTouched,
  FormikValues,
  useFormikContext,
} from "formik";
import React, { useState } from "react";

import {
  useJsApiLoader,
  Autocomplete,
  Libraries,
} from "@react-google-maps/api";

import { DynamicFieldType } from "@/lib/types/utils/form";
import { FormLabelComponent } from "./form-label";
import { Input } from "../../input";
import { ErrorMessage } from "./error-message";

const VALIDCOUNTRIES = ["CA", "US"];

const INCONSISTENT_STATES: string[][] = [
  ["Buenos Aires", "Provincia de Buenos Aires"],
];

const LIBRARIES: Libraries = ["places"];

type Props = Partial<DynamicFieldType> & {
  countries?: string[];
  values: FormikValues;
  validationRules?: any;
  errors: FormikErrors<any>;
  touched: FormikTouched<any>;
};

const GoogleAutoCompleteInput = ({
  name = "",
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
}: Props) => {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY as string,
    libraries: LIBRARIES,
    region: "AR",
  });

  const [address, setAddress] =
    useState<google.maps.places.Autocomplete | null>(null);

  const { setFieldValue } = useFormikContext<FormikValues>();

  const onLoad = (autocomplete: google.maps.places.Autocomplete) => {
    setAddress(autocomplete);
  };

  const handleSelect = () => {
    if (!address) return;

    const place = address.getPlace();
    if (!place || !place.address_components) return;

    // Build full address
    const fullAddress = place.address_components
      .reduce((acc: string, result: google.maps.GeocoderAddressComponent) => {
        const type = result.types?.[0];
        if (!type) return acc;

        const value = result.long_name ?? "";

        switch (type) {
          case "route":
            return acc + value + ", ";
          case "street_number":
            return acc + value + " ";
          case "administrative_area_level_2":
            return acc + value + ", ";
          case "administrative_area_level_1":
            return acc + value;
          default:
            return acc;
        }
      }, "")
      .trim()
      .replace(/,\s*$/, "");

    setFieldValue("address", fullAddress);

    // Map components
    place.address_components.forEach((component) => {
      const componentType = component.types?.[0];
      if (!componentType) return;

      let longNameValue = component.long_name ?? "";
      const shortNameValue = component.short_name ?? "";

      switch (componentType) {
        case "country":
          setFieldValue("country", shortNameValue);
          break;

        case "administrative_area_level_1":
          INCONSISTENT_STATES.forEach(([suggestion, actualState]) => {
            if (suggestion === longNameValue) {
              //   longNameValue = actualState;
            }
          });
          setFieldValue("province", longNameValue);
          break;

        case "administrative_area_level_2":
          setFieldValue("city", longNameValue);
          break;

        case "postal_code":
          setFieldValue("postal", longNameValue);
          break;

        case "street_number":
          setFieldValue("street_number", longNameValue);
          break;

        case "route":
          setFieldValue("street_name", longNameValue);
          break;

        default:
          break;
      }
    });
  };

  if (!isLoaded) return null;

  return (
    <div>
      <FormLabelComponent label={label ?? ""} id={name} required={required} />

      <Autocomplete
        options={{
          componentRestrictions: { country: "AR" },
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
              max={max}
              disabled={disabled}
              readOnly={readonly}
              placeholder={placeholder ?? label}
              value={(values?.[name] as string) ?? initial ?? ""}
              onWheel={(e) => {
                e.preventDefault();
                field.onBlur(e);
                form.setFieldTouched(name, true);
              }}
              variant={variant ?? "outline"}
            />
          )}
        </Field>
      </Autocomplete>

      <ErrorMessage errors={errors} id={name} touched={touched} />
    </div>
  );
};

export default GoogleAutoCompleteInput;
