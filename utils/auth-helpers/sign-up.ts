'use server';
import { Proposal } from '@/lib/types/db/proposals';
import { getErrorRedirect, getStatusRedirect, parseFormData } from '../helpers';
import { createClient } from '../supabase/server';
import { revalidatePath } from 'next/cache';
import { insertUser } from '@/lib/repositories/users/insert';
import { updateProposalById } from '@/lib/repositories/proposals/update';

export async function signUp(formData: FormData) {
  const values = parseFormData(formData, 'values');
  const proposalId = String(formData.get('proposalId'));
  const supabase = await createClient();
  const returnUrl = `/sign-in/user-sign-up/${proposalId}`;
  const { password } = values;

  const proposal = await fetchProposal(supabase, proposalId);
  if (!proposal)
    return getErrorRedirect(
      '/sign-in/user-sign-up',
      'Error',
      'Proposal not found. Please, use the link we sent to your email to finish the sign up process.'
    );

  if (proposal.user_id) {
    return getErrorRedirect(
      returnUrl,
      'Error',
      'This proposal already has an owner.'
    );
  }

  const { signUpError, data } = await signUpUser(
    supabase,
    proposal,
    password,
    returnUrl
  );
  if (signUpError) return signUpError;

  const redirectPath = await handleUserSignUp(
    supabase,
    data,
    proposal,
    proposalId,
    returnUrl,
    password
  );
  return redirectPath;
}

async function fetchProposal(supabase: any, proposalId: string) {
  const { data: proposal } = await supabase
    .from('proposals')
    .select()
    .eq('id', proposalId)
    .single();

  if (!proposal) {
    return;
  }

  return proposal;
}

async function signUpUser(
  supabase: any,
  proposal: Proposal,
  password: string,
  returnUrl: string
): Promise<{ signUpError: string | null; data: any }> {
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

  if (signUpError) {
    return {
      signUpError: getErrorRedirect(returnUrl, 'Error', signUpError.message),
      data: null,
    };
  }

  return { signUpError: null, data };
}

async function handleUserSignUp(
  supabase: any,
  data: any,
  proposal: Proposal,
  proposalId: string,
  returnUrl: string,
  password: string
) {
  let redirectPath: string = '';

  if (data.session && data.user) {
    const user_id = data.user.id;

    const insertUserError = await insertUserAndHandleError(
      user_id,
      proposal.client_email,
      returnUrl
    );
    if (insertUserError) return insertUserError;

    const updateProposalError = await updateProposalAndHandleError(
      supabase,
      proposalId,
      user_id,
      returnUrl
    );
    if (updateProposalError) return updateProposalError;

    const signInError = await signInUser(
      supabase,
      proposal.client_email,
      password,
      returnUrl
    );
    if (signInError) return signInError;

    revalidatePath(`/proposals/${proposalId}`);
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
      returnUrl,
      'Error',
      'There is already an email associated with this account. If you forgot your password, you can reset it.'
    );
  } else {
    redirectPath = getErrorRedirect(
      returnUrl,
      'Hmm... Something went wrong.',
      'We could not sign you up, please try again.'
    );
  }

  return redirectPath;
}

async function insertUserAndHandleError(
  user_id: string,
  email: string,
  returnUrl: string
) {
  const { error: insertUserError } = await insertUser({ id: user_id, email });
  if (insertUserError) {
    console.log(insertUserError);
    return getErrorRedirect(
      returnUrl,
      'There was an error while creating your account. Please try again later or contact support for further assistance.'
    );
  }
  console.log('inserted user');
  return null;
}

async function updateProposalAndHandleError(
  supabase: any,
  proposalId: string,
  user_id: string,
  returnUrl: string
) {
  const { error } = await updateProposalById(proposalId, { user_id });
  if (error) {
    console.log(error);
    return getErrorRedirect(
      returnUrl,
      'Hmm... Something went wrong.',
      'We could not sign you up, please try again.'
    );
  }
  console.log('updated proposal');
  return null;
}

async function signInUser(
  supabase: any,
  email: string,
  password: string,
  returnUrl: string
) {
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (signInError) {
    return getErrorRedirect(returnUrl, 'Error', signInError.message);
  }
  console.log('signed in');
  return null;
}
