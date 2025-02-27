'use server';

import { createClient } from '@/utils/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  getURL,
  getErrorRedirect,
  getStatusRedirect,
  removeAccents,
  getUniqueSlug,
  parseFormData,
} from '@/utils/helpers';
import { getAuthTypes } from '@/utils/auth-helpers/settings';
import { v4 } from 'uuid';
import { supabase } from '@/lib/supabase/client';
import { Proposal } from '@/lib/types/db/proposals';
import { updateProposalById } from '@/lib/repositories/proposals/update';
import { insertUser } from '@/lib/repositories/users/insert';

function isValidEmail(email: string) {
  var regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return regex.test(email);
}

export async function redirectToPath(path: string) {
  return redirect(path);
}

export async function SignOut(formData: FormData) {
  const pathName = String(formData.get('pathName')).trim();

  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();

  if (error) {
    return getErrorRedirect(
      'https://rentscape.co',
      'Hmm... Something went wrong.',
      'You could not be signed out.'
    );
  }

  return 'https://rentscape.co';
}

export async function signInWithEmail(formData: FormData) {
  const cookieStore = await cookies();
  const callbackURL = getURL('/auth/callback');

  const email = String(formData.get('email')).trim();
  let redirectPath: string;

  if (!isValidEmail(email)) {
    redirectPath = getErrorRedirect(
      '/sign-in/email-signin',
      'Invalid email address.',
      'Please try again.'
    );
  }

  const supabase = await createClient();
  let options = {
    emailRedirectTo: callbackURL,
    shouldCreateUser: true,
  };

  // If allowPassword is false, do not create a new user
  const { allowPassword } = getAuthTypes();
  if (allowPassword) options.shouldCreateUser = false;
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: options,
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/sign-in/email-signin',
      'You could not be signed in.',
      error.message
    );
  } else if (data) {
    cookieStore.set('preferredSignInView', 'email-signin', { path: '/' });
    redirectPath = getStatusRedirect(
      '/sign-in/email-signin',
      'Success!',
      'Please check your email for a magic link. You may now close this tab.',
      true
    );
  } else {
    redirectPath = getErrorRedirect(
      '/sign-in/email-signin',
      'Hmm... Something went wrong.',
      'You could not be signed in.'
    );
  }

  return redirectPath;
}

export async function requestPasswordUpdate(formData: FormData) {
  const callbackURL = getURL('/auth/reset_password');

  // Get form data
  const values = JSON.parse((formData.get('values') as string) || '{}');
  const { email } = values;
  let redirectPath: string;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: callbackURL,
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/sign-in/forgot-password',
      error.message,
      'Please try again.'
    );
  } else if (data) {
    redirectPath =
      '/sign-in/forgot-password?complete=true&message=Check your email for a password reset link. You may now close this tab.';
  } else {
    redirectPath = getErrorRedirect(
      '/signin/forgot-password',
      'Hmm... Something went wrong.',
      'Password reset email could not be sent.'
    );
  }

  return redirectPath;
}

export async function signInWithPassword(formData: FormData) {
  const cookieStore = await cookies();
  const values = parseFormData(formData, 'values');
  const redirectTo = String(formData.get('redirectTo')).trim();
  const { email, password } = values;
  let redirectPath: string = '';
  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    redirectPath = getErrorRedirect(
      '/sign-in/password-signin',
      'Error',
      error.message
    );
  } else if (data.user) {
    cookieStore.set('preferredSignInView', 'password-signin', { path: '/' });
    const { data: signedInUser } = await supabase
      .from('users')
      .select()
      .eq('id', data.user?.id)
      .single();
    //!Here will be the list of proposals maybe
    let path = 'proposals';
    if (redirectTo) {
      path = redirectTo;
    }
    redirectPath = getStatusRedirect(`/${path}`, 'You are now signed in!');
  } else {
    redirectPath = getErrorRedirect(
      '/signin/password-signin',
      'Hmm... Something went wrong.',
      'You could not be signed in.'
    );
  }

  return redirectPath;
}
export async function checkSlug(slug: string) {
  const supabase = await createClient();
  let uniqueSlug = slug;
  let slugExists = true;
  let suffix = 1;

  while (slugExists) {
    const { data, error } = await supabase
      .from('managers')
      .select()
      .eq('slug', uniqueSlug)
      .single();

    if (!data) {
      slugExists = false;
    } else {
      uniqueSlug = `${slug}${suffix}`;
      suffix++;
    }
  }

  return { slugExists, uniqueSlug };
}

export async function signUp(formData: FormData) {
  const callbackURL = getURL(
    '/sign-in/password-signin?status=Tu cuenta ha sido verificada correctamente, ya puedes iniciar sesión.'
  );
  const values = parseFormData(formData, 'values');
  console.log(values);
  const { proposalId, password } = values;
  const { data: proposal } = await supabase
    .from('proposals')
    .select()
    .eq('id', proposalId)
    .single<Proposal>();
  if (!proposal) {
    return getErrorRedirect(
      '/sign-in/user-sign-up',
      'Error',
      'Proposal not found. Please, use the link we sent to your email to finish the sign up process.'
    );
  }
  const { error: signUpError, data } = await supabase.auth.signUp({
    email: proposal.client_email,
    password,

    phone: String(proposal.client_phone),
    options: {
      data: {
        display_name: proposal.client_name,
      },
    },
  });
  let redirectPath: string = '';
  if (signUpError) {
    redirectPath = getErrorRedirect(
      '/sign-in/user-sign-up',
      'Error',
      signUpError.message
    );
  } else if (data.session && data.user) {
    const user_id = data.user.id;

    const { error: insertUserError } = await insertUser({
      id: user_id,
      email: proposal.client_email,
    });
    if (insertUserError) {
      console.log(insertUserError);
      return (redirectPath = getErrorRedirect(
        '/sign-in/user-sign-up',
        'There was an error while creating your account. Please try again later or contact support for further assistance.'
      ));
    }
    const { error } = await updateProposalById(proposalId, {
      user_id,
    });

    if (error) {
      console.log(error);
      return (redirectPath = getErrorRedirect(
        '/sign-in/user-sign-up',
        'Hmm... Something went wrong.',
        'We could not sign you up, please try again.'
      ));
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: proposal.client_email,
      password,
    });
    if (signInError) {
      return (redirectPath = getErrorRedirect(
        '/sign-in/user-sign-up',
        signInError.message
      ));
    }
    redirectPath = getStatusRedirect(
      `/proposals/${proposalId}`,
      'Your account has been created successfully!'
    );
  } else if (
    data.user &&
    data.user.identities &&
    data.user.identities.length == 0
  ) {
    redirectPath = getErrorRedirect(
      '/sign-in/user-sign-up',
      'Error',
      'There is already an email asociated with this account. If you forgot your password, you can reset it.'
    );
  } else if (data.user) {
  } else {
    redirectPath = getErrorRedirect(
      '/sign-in/user-sign-up',
      'Hmm... Something went wrong.',
      'We could not sign you up, please try again.'
    );
  }

  return redirectPath;
}

export async function updatePassword(formData: FormData) {
  const values = JSON.parse((formData.get('values') as string) || '{}');
  const { password, passwordConfirm } = values;
  let redirectPath: string;
  // Check that the password and confirmation match
  if (password !== passwordConfirm) {
    return (redirectPath = getErrorRedirect(
      '/signin/update-password',
      'Your password could not be updated.',
      'Passwords do not match.'
    ));
  }
  const supabase = await createClient();
  const { error, data } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirectPath = getErrorRedirect(
      '/signin/update-password',
      'Your password could not be updated.',
      error.message
    );
  } else if (data.user) {
    redirectPath = getStatusRedirect(
      '/signin/password-signin',
      'Success!',
      'Your password has been updated.'
    );
  } else {
    redirectPath = getErrorRedirect(
      '/signin/update-password',
      'Hmm... Something went wrong.',
      'Your password could not be updated.'
    );
  }

  return redirectPath;
}

export async function updateEmail(formData: FormData) {
  // Get form data
  const newEmail = String(formData.get('newEmail')).trim();

  // Check that the email is valid
  if (!isValidEmail(newEmail)) {
    return getErrorRedirect(
      '/signin/password-signin',
      'Your email could not be updated.',
      'Invalid email address.'
    );
  }

  const supabase = await createClient();

  const callbackUrl = getURL(
    getStatusRedirect(
      '/signin/password-signin',
      'Success!',
      `Your email has been updated.`
    )
  );

  const { error } = await supabase.auth.updateUser(
    { email: newEmail },
    {
      emailRedirectTo: callbackUrl,
    }
  );

  if (error) {
    return getErrorRedirect(
      '/signin/password-signin',

      'Your email could not be updated.',
      error.message
    );
  } else {
    return getStatusRedirect(
      '/signin/password-signin',
      'Confirmation emails sent.',
      `You will need to confirm the update by clicking the links sent to both the old and new email addresses.`
    );
  }
}

export async function updateName(formData: FormData) {
  // Get form data
  const fullName = String(formData.get('fullName')).trim();

  const supabase = await createClient();
  const { error, data } = await supabase.auth.updateUser({
    data: { full_name: fullName },
  });

  if (error) {
    return getErrorRedirect(
      '/signin/password-signin',
      'Your name could not be updated.',
      error.message
    );
  } else if (data.user) {
    return getStatusRedirect(
      '/signin/password-signin',
      'Success!',
      'Your name has been updated.'
    );
  } else {
    return getErrorRedirect(
      '/signin/password-signin',
      'Hmm... Something went wrong.',
      'Your name could not be updated.'
    );
  }
}
