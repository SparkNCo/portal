import { notFound, redirect } from 'next/navigation';
import {
  Clock,
  DollarSign,
  Dot,
  Info,
  Lock,
  LockOpen,
  Mail,
  Phone,
  Plus,
  Shield,
  ShieldEllipsis,
  Trash,
  Trash2,
  User,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getProposalById } from '@/lib/repositories/proposals/get';
import { getProposalFeaturesByProposalId } from '@/lib/repositories/proposal_features/get';
import Link from 'next/link';
import { unstable_cache } from 'next/cache';
import EditAddProposal from '@/components/ui/proposals/edit-proposal';
import { updateProposalFn } from '@/lib/services/proposals/form-functions/update-proposal';

//!LAYOUTS IMPORTS
import edit_client_information_layout from '@/layouts/proposals/edit-client-information.json';
import edit_project_details_layout from '@/layouts/proposals/edit-project-details.json';
import edit_project_description_layout from '@/layouts/proposals/edit-project-description.json';
import edit_project_requirements_layout from '@/layouts/proposals/edit-project-requirements.json';
import edit_feature_layout from '@/layouts/proposals/edit-feature.json';
import add_feature_layout from '@/layouts/proposals/add-feature.json';
//!LAYOUTS IMPORTS

import { snakeCaseToWords } from '@/utils/helpers';
import { updateProposalFeatureFn } from '@/lib/services/proposal_features/update-feature';
import { Proposal } from '@/lib/types/db/proposals';
import { getLoggedInUser } from '@/lib/repositories/users/get';
import LogOutButton from '@/components/ui/buttons/logout-button';
import AlertMessage from '@/components/ui/info-message';
import ChangePrivacyButton from '@/components/ui/proposals/change-privacy-button';
import { Button } from '@/components/ui/button';
import { Suspense } from 'react';
import RevalidateButton from '@/components/ui/buttons/ss-refresh-button';
import { Modal } from '@/components/ui/reusable-modal';
import { deleteFeatureFn } from '@/lib/services/proposal_features/delete-feature';
import { addProposalFeatureFn } from '@/lib/services/proposal_features/add-feature';
interface ProposalPageProps {
  params: Promise<{
    id: string;
  }>;
}
const getProposal = unstable_cache(
  async (proposalId: string) => {
    const proposal = await getProposalById(proposalId);
    if (!proposal) return null;

    return proposal;
  },

  ['proposal'],
  {
    revalidate: 600,
    tags: [`proposal`],
  }
);
const getFeatures = unstable_cache(
  async (proposalId: string) => {
    const proposal_features = await getProposalFeaturesByProposalId(proposalId);
    return proposal_features;
  },
  ['proposal_features'],
  {
    revalidate: 600,
    tags: [`proposal_features`],
  }
);
export default async function ProposalPage({ params }: ProposalPageProps) {
  const { id } = await params;
  const proposal = await getProposal(id);
  const proposal_features = await getFeatures(id);
  if (!proposal) {
    return notFound();
  }
  const user = await getLoggedInUser();
  const isOwner = user?.id === proposal.user_id;
  const noUserAttached = !proposal.user_id;
  const isPublic = proposal.public;
  //If there is no user attached to the proposal, redirect to the sign up page
  if (noUserAttached) {
    return redirect(
      `/sign-in/user-sign-up?proposalId=${id}&status=Please, enter your password to create your account.`
    );
  }
  if (!isOwner && !proposal.public) {
    return notFound();
  }

  const headerClass = 'flex items-center justify-between';

  return (
    <div className="container  py-8  w-full">
      {user && (
        <div className="fixed bottom-14 left-3 z-10">
          <LogOutButton usage="header" />
        </div>
      )}
      <Link
        href={'/proposals'}
        className="text-primary font-medium underline mb-4 flex items-center gap-2"
      >
        Proposals
      </Link>
      <div className="text-2xl font-bold mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Dot />
          <p>{proposal.business_name}</p>
        </h1>
        <RevalidateButton
          revalidate={`/proposals/${id}`}
          revalidateOption="path"
        />
      </div>

      <div className="grid gap-6 w-full">
        <div className="grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader className={''}>
              <CardTitle className={headerClass}>
                Client Information{' '}
                {isOwner && (
                  <EditAddProposal
                    editDescription="You can edit your personal information here."
                    layout={edit_client_information_layout}
                    base={{
                      ...proposal,
                      features: proposal_features,
                    }}
                    editSection="Client Information"
                    completeFn={updateProposalFn}
                  />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <User className="icon" />
                  <span className="font-medium">{proposal.client_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="icon" />
                  <span>{proposal.client_email}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="icon" />
                  <span>{proposal.client_phone}</span>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className={headerClass}>
                Project Details{' '}
                {isOwner && (
                  <EditAddProposal
                    editDescription="You can edit the project details here."
                    layout={edit_project_details_layout}
                    base={{
                      ...proposal,
                      features: proposal_features,
                    }}
                    editSection="Project Details"
                    completeFn={updateProposalFn}
                  />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <DollarSign className="icon" />
                  <span className="font-medium">
                    Budget: ${proposal.project_budget.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="icon" />
                  <span>Timeline: {proposal.project_timeline}</span>
                </div>
                <div className="">
                  <Badge
                    variant={
                      proposal.project_status === 'NEW_IDEA'
                        ? 'default'
                        : 'secondary'
                    }
                  >
                    {snakeCaseToWords(proposal.project_status)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className={headerClass}>
                Project Privacy
                {isOwner && (
                  <ChangePrivacyButton isPublic={isPublic} proposalId={id} />
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className=" flex flex-col gap-y-4">
              <div className="flex items-center gap-2">
                <Shield className="icon" />
                <span className="flex items-center gap-2">
                  Current Status:{' '}
                  <Badge
                    className="flex gap-2"
                    variant={isPublic ? 'default' : 'secondary'}
                  >
                    {isPublic ? (
                      <LockOpen className="icon" />
                    ) : (
                      <Lock className="icon" />
                    )}
                    {isPublic ? 'PUBLIC' : 'PRIVATE'}
                  </Badge>
                </span>
              </div>
              {isOwner && (
                <AlertMessage
                  message={` Changing this settings will make your proposal
                ${isPublic ? 'private' : 'public'}.`}
                  type="info"
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className={headerClass}>
              Project Description
              {isOwner && (
                <EditAddProposal
                  editDescription="You can edit the project description here."
                  layout={edit_project_description_layout}
                  base={{
                    ...proposal,
                    features: proposal_features,
                  }}
                  editSection="Project Description"
                  completeFn={updateProposalFn}
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {proposal.project_description}
            </p>
          </CardContent>
        </Card>

        {/* Requirements */}
        <Card>
          <CardHeader>
            <CardTitle className={headerClass}>
              Project Requirements
              {isOwner && (
                <EditAddProposal
                  editDescription="You can edit the project requirements here."
                  layout={edit_project_requirements_layout}
                  base={{
                    ...proposal,
                    features: proposal_features,
                  }}
                  editSection="Project Requirements"
                  completeFn={updateProposalFn}
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              {proposal?.project_requirements_description}
            </p>
            <div className="flex gap-2 items-center flex-wrap">
              {proposal?.project_requirements?.map(
                (req: string, index: number) => (
                  <Badge
                    key={index}
                    variant="outline"
                    className="justify-center px-6"
                  >
                    {snakeCaseToWords(req)}
                  </Badge>
                )
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle className={headerClass}>
              Required Features
              {isOwner && (
                <EditAddProposal
                  editDescription="If you think we missed a feature, you can add it here."
                  submitButton="Add Feature"
                  layout={add_feature_layout}
                  base={{
                    ...proposal,
                    features: proposal_features,
                  }}
                  icon={'plus'}
                  editSection="Add a new feature"
                  completeFn={addProposalFeatureFn}
                />
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Feature</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[100px]">Priority</TableHead>
                  {isOwner && <TableHead className="">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {proposal_features?.map((feature) => (
                  <TableRow key={feature.id}>
                    <TableCell className="font-medium">
                      {feature.feature_name}
                    </TableCell>
                    <TableCell>{feature.feature_description}</TableCell>
                    <TableCell>
                      <Badge
                        className="capitalize"
                        variant={
                          feature.feature_priority === 'High'
                            ? 'destructive'
                            : feature.feature_priority === 'Medium'
                              ? 'default'
                              : 'secondary'
                        }
                      >
                        {feature.feature_priority}
                      </Badge>
                    </TableCell>
                    {isOwner && (
                      <TableCell className="flex items-center gap-2">
                        <EditAddProposal
                          base={{
                            ...proposal,
                            ...feature,
                            feature_id: feature.id,
                          }}
                          editDescription="You can edit the project features here."
                          layout={edit_feature_layout}
                          editSection="Project Features"
                          completeFn={updateProposalFeatureFn}
                        />
                        <Modal
                          trigger={
                            <Button
                              className="p-2  h-fit "
                              variant="destructive"
                            >
                              <Trash2 className="icon" size={16} />
                            </Button>
                          }
                          variant={'destructive'}
                          params={feature.id}
                          title="Confirm to delete this feature"
                          subtitle="This action cannot be undone"
                          description="Are you sure you want to delete this feature?"
                          onConfirm={deleteFeatureFn}
                          confirmText="Delete"
                          confirmIcon={<Trash2 className="h-4 w-4" />}
                        />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
