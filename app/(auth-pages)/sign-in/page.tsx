import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getDefaultSignInView } from '@/utils/auth-helpers/settings';

export default async function SignIn() {
  const cookiesO = await cookies();
  const preferredSignInView =
    cookiesO.get('preferredSignInView')?.value || null;
  const defaultView = getDefaultSignInView(preferredSignInView);

  return redirect(`/sign-in/${defaultView}`);
}
