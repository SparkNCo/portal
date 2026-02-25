import { emailReg, phoneReg } from '@/components/ui/form/utils/regex';
import dayjs from 'dayjs';

export const validateMaxValue = (value: number, max: number): string | null => {
  if (!max) return null;
  let message;

  if (typeof value === 'undefined' || !value) {
    message = 'Value required';
    return message;
  }
  if (Number(value) > Number(max)) {
    message = `Maximum value is ${max}`;
    return message;
  }
  return null;
};
export const validateEmail = (email: string): string | null => {
  if (typeof email !== 'string') return null;
  let message;
  if (typeof email == 'undefined' || email === '') {
    message = 'Email required';
    return message;
  }
  if (!email.match(emailReg)) {
    message = 'Invalid email';
    return message;
  }
  return null;
};

export const validatePhone = (
  numberPhone: string,
  required?: boolean
): string | null => {
  const phone = String(numberPhone);
  let message;
  if (required) {
    if (typeof phone == 'undefined' || phone === '') {
      message = 'Phone number required';
      return message;
    }
  }
  if (phone === '') return null;
  if (!phone.match(phoneReg)) {
    message = 'Invalid phone number';
    return message;
  }

  return null;
};
export const validateDOB = (birthDate: string): string | null => {
  let message;
  if (typeof birthDate === 'undefined' || birthDate === '') {
    message = 'Date required';
    return message;
  }
  const today = new Date();
  const minAgeDate = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate()
  );

  const dobDate = new Date(birthDate);

  message = validDate(birthDate);
  if (message) return message;
  if (dobDate > minAgeDate) {
    message = 'Must be at least 18 years old';
    return message;
  }

  return null;
};

export const validDate = (value: string) => {
  if (!value) return null;

  const date = dayjs(value).toDate();
  if (isNaN(date.getTime())) {
    return 'Invalid date';
  }
  const currentDate = new Date();
  const hundredYearsAgo = new Date();
  hundredYearsAgo.setFullYear(currentDate.getFullYear() - 100);
  const hundredYearsFromNow = new Date();
  hundredYearsFromNow.setFullYear(currentDate.getFullYear() + 100);
  if (date < hundredYearsAgo || date > hundredYearsFromNow) {
    return 'Invalid date';
  }
  return null;
};

export const validateProjectRequirements = (
  projectRequirements: string[]
): string | null => {
  if (
    typeof projectRequirements === 'undefined' ||
    !projectRequirements ||
    projectRequirements.length === 0
  ) {
    return 'Select at least one requirement';
  }
  return null;
};
