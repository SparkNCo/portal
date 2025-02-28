import LogOutButton from '@/components/ui/buttons/logout-button';
import { Separator } from '@/components/ui/separator';
import { getProposalsByUserId } from '@/lib/repositories/proposals/get';
import { getDatabaseUser, getLoggedInUser } from '@/lib/repositories/users/get';
import { createClient } from '@/utils/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export default async function Proposals() {
  const supabase = await createClient();
  const user = await getLoggedInUser();
  // const dbUser = await getDatabaseUser(user?.id);
  // const isOwner = dbUser?.role === 'ADMIN';
  if (!user) redirect('/sign-in');
  const proposals = await getProposalsByUserId(user?.id);
  if (proposals?.length === 1) redirect(`/proposals/${proposals[0].id}`);
  return (
    <>
      <div className="space-y-4 relative min-h-screen ">
        <div className="fixed bottom-14 left-3 z-10">
          <LogOutButton usage="header" />
        </div>
        <h1>PROPOSALS</h1>
        <Separator />
        {proposals?.map((proposal) => (
          <div className="underline" key={proposal.id}>
            <Link href={`/proposals/${proposal.id}`}>
              {proposal.business_name}
            </Link>
          </div>
        ))}
      </div>
    </>
  );
}
