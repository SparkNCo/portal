import AuthFormLayout from '@/components/ui/wrappers/auth-form-wrapper';
import PasswordSignIn from '@/components/ui/auth/sign-in';
import SignUp from '@/components/ui/auth/sign-up';
import {
  getAuthTypes,
  getDefaultSignInView,
  getRedirectMethod,
  getViewTypes,
} from '@/utils/auth-helpers/settings';
import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { Metadata } from 'next';
import ForgotPassword from '@/components/ui/auth/forgot-password';
import UpdatePassword from '@/components/ui/auth/update-password';
export const metadata: Metadata = {
  title: 'Sign In & Account Access | Spark&Co ',
  description: 'Securely sign in to your Spark&Co account.',
  keywords: [
    'sign in',
    'login',
    'Spark&Co access',
    'forgot password',
    'update password',
    'sign up Spark&Co',
  ],
  robots: 'noindex, nofollow',
  authors: [{ name: 'Spark&Co', url: 'https://rentscape.co/' }],
  creator: 'Spark&Co',
  publisher: 'Spark&Co',
  applicationName: 'Spark&Co',
  icons: {
    icon: '/favicon.ico',
  },
};
export default async function Layout({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    id: string;
    complete?: string;
    message?: string;
    redirectTo?: string;
    proposalId?: string;
  }>;
}) {
  const { id } = await params;
  const {
    id: view,
    complete,
    message,
    proposalId,
    redirectTo,
  } = await searchParams;
  const { allowOauth, allowEmail, allowPassword } = getAuthTypes();
  const viewTypes = getViewTypes();
  const redirectMethod = getRedirectMethod();
  let viewProp: string;
  const cookiesO = await cookies();
  if (typeof id === 'string' && viewTypes.includes(id)) {
    viewProp = id;
  } else {
    const preferredSignInView =
      cookiesO.get('preferredSignInView')?.value || null;
    viewProp = getDefaultSignInView(preferredSignInView);
    return redirect(`/sign-in/${viewProp}`);
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && viewProp !== 'update-password') {
    return redirect('/proposals');
  } else if (!user && viewProp === 'update-password') {
    return redirect('/sign-in');
  }
  const title = getTitle({ complete: complete, viewProp });
  return (
    <AuthFormLayout bgImage={''} title={title}>
      {complete == 'true' && (
        <div className="border-l-2 border-zinc-800 dark:border-zinc-300 pl-4 py-2 ">
          <p className="text-gray-600 dark:text-foreground text-sm">
            {message}
          </p>
        </div>
      )}
      {!complete && (
        <>
          {viewProp === 'password-signin' && (
            <PasswordSignIn
              allowPassword={allowPassword}
              redirectMethod={redirectMethod}
            />
          )}
          {viewProp === 'forgot-password' && (
            <ForgotPassword
              allowEmail={allowEmail}
              redirectMethod={redirectMethod}
            />
          )}
          {viewProp === 'update-password' && (
            <UpdatePassword redirectMethod={redirectMethod} />
          )}
          {viewProp === 'user-sign-up' && (
            <SignUp
              allowEmail={allowEmail}
              proposalId={proposalId}
              redirectMethod={redirectMethod}
            />
          )}
        </>
      )}
    </AuthFormLayout>
  );
}
const getTitle = ({
  complete,
  viewProp,
}: {
  complete?: string;
  viewProp: string;
}): string | null => {
  if (complete) {
    return 'You are almost there!';
  }
  switch (viewProp) {
    case 'forgot-password':
      return null;

    case 'update-password':
      return null;
    case 'sign-up':
      return null;
    case 'user-sign-up':
      return null;
    case 'organization-sign-up':
      return null;

    default:
      return null;
    // return 'Sign In';
  }
};
