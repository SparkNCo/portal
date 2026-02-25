// import { notFound } from 'next/navigation';
// import { Clock, DollarSign, Dot, Mail, Phone, User } from 'lucide-react';
// import { Badge } from '@/components/ui/badge';
// import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow,
// } from '@/components/ui/table';
// import { getProposalById } from '@/lib/repositories/proposals/get';
// import { getProposalFeaturesByProposalId } from '@/lib/repositories/proposal_features/get';
// import Link from 'next/link';
// import { unstable_cache } from 'next/cache';
// import EditProposal from '@/components/ui/proposals/edit-proposal';
// import { updateProposalFn } from '@/lib/services/proposals/form-functions/update-proposal';

// //LAYOUTS IMPORTS
// import edit_client_information_layout from '@/layouts/proposals/edit-client-information.json';
// import edit_project_details_layout from '@/layouts/proposals/edit-project-details.json';
// import edit_project_description_layout from '@/layouts/proposals/edit-project-description.json';
// import edit_project_requirements_layout from '@/layouts/proposals/edit-project-requirements.json';
// import edit_feature_layout from '@/layouts/proposals/edit-feature.json';
// import { updateProposalFeatureFn } from '@/lib/services/proposal_features/update-feature';
// import { snakeCaseToWords } from '@/components/components/ui/form/utils/helpers';
// interface ProposalPageProps {
//   params: Promise<{
//     id: string;
//   }>;
// }
// const getProposalAndFeatures = unstable_cache(
//   async (proposalId: string) => {
//     const proposal = await getProposalById(proposalId);
//     if (!proposal) return { proposal: null, proposal_features: [] };

//     const proposal_features = await getProposalFeaturesByProposalId(proposalId);
//     return { proposal, proposal_features };
//   },
//   ['proposal'],
//   {
//     revalidate: 3600,
//     tags: [`proposal`],
//   }
// );
// export default async function ProposalPage({ params }: ProposalPageProps) {
//   const { id } = await params;
//   const { proposal, proposal_features } = await getProposalAndFeatures(id);
//   if (!proposal) {
//     return notFound();
//   }
//   const headerClass = 'flex items-center justify-between';
//   return (
//     <div className="container  py-8  w-full">
//       <Link
//         href={'/'}
//         className="text-primary font-medium underline mb-4 flex items-center gap-2"
//       >
//         Home
//       </Link>
//       <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
//         <Dot />
//         <p>{proposal.business_name}</p>
//       </h1>

//       <div className="grid gap-6 w-full">
//         <div className="grid gap-6 md:grid-cols-2">
//           <Card>
//             <CardHeader className={''}>
//               <CardTitle className={headerClass}>
//                 Client Information{' '}
//                 <EditProposal
//                   editDescription="You can edit your personal information here."
//                   layout={edit_client_information_layout}
//                   proposal={proposal}
//                   editSection="Client Information"
//                   completeFn={updateProposalFn}
//                   proposal_features={proposal_features}
//                 />
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 <div className="flex items-center gap-2">
//                   <User className="icon" />
//                   <span className="font-medium">{proposal.client_name}</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Mail className="icon" />
//                   <span>{proposal.client_email}</span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Phone className="icon" />
//                   <span>{proposal.client_phone}</span>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>

//           <Card>
//             <CardHeader>
//               <CardTitle className={headerClass}>
//                 Project Details{' '}
//                 <EditProposal
//                   editDescription="You can edit the project details here."
//                   layout={edit_project_details_layout}
//                   proposal={proposal}
//                   editSection="Project Details"
//                   completeFn={updateProposalFn}
//                   proposal_features={proposal_features}
//                 />
//               </CardTitle>
//             </CardHeader>
//             <CardContent>
//               <div className="space-y-4">
//                 <div className="flex items-center gap-2">
//                   <DollarSign className="icon" />
//                   <span className="font-medium">
//                     Budget: ${proposal.project_budget.toLocaleString()}
//                   </span>
//                 </div>
//                 <div className="flex items-center gap-2">
//                   <Clock className="icon" />
//                   <span>Timeline: {proposal.project_timeline}</span>
//                 </div>
//                 <div className="">
//                   <Badge
//                     variant={
//                       proposal.project_status === 'NEW_IDEA'
//                         ? 'default'
//                         : 'secondary'
//                     }
//                   >
//                     {snakeCaseToWords(proposal.project_status)}
//                   </Badge>
//                 </div>
//               </div>
//             </CardContent>
//           </Card>
//         </div>

//         <Card>
//           <CardHeader>
//             <CardTitle className={headerClass}>
//               Project Description
//               <EditProposal
//                 editDescription="You can edit the project description here."
//                 layout={edit_project_description_layout}
//                 proposal={proposal}
//                 editSection="Project Description"
//                 completeFn={updateProposalFn}
//                 proposal_features={proposal_features}
//               />
//             </CardTitle>
//           </CardHeader>
//           <CardContent>
//             <p className="text-muted-foreground">
//               {proposal.project_description}
//             </p>
//           </CardContent>
//         </Card>

//         {/* Requirements */}
//         <Card>
//           <CardHeader>
//             <CardTitle className={headerClass}>
//               Project Requirements
//               <EditProposal
//                 editDescription="You can edit the project requirements here."
//                 layout={edit_project_requirements_layout}
//                 proposal={proposal}
//                 editSection="Project Requirements"
//                 completeFn={updateProposalFn}
//                 proposal_features={proposal_features}
//               />
//             </CardTitle>
//           </CardHeader>
//           <CardContent className="space-y-4">
//             <p className="text-muted-foreground">
//               {proposal?.project_requirements_description}
//             </p>
//             <div className="flex gap-2 items-center flex-wrap">
//               {proposal?.project_requirements?.map(
//                 (req: string, index: number) => (
//                   <Badge
//                     key={index}
//                     variant="outline"
//                     className="justify-center px-6"
//                   >
//                     {snakeCaseToWords(req)}
//                   </Badge>
//                 )
//               )}
//             </div>
//           </CardContent>
//         </Card>

//         {/* Features */}
//         <Card>
//           <CardHeader>
//             <CardTitle className={headerClass}>Required Features</CardTitle>
//           </CardHeader>
//           <CardContent>
//             <Table>
//               <TableHeader>
//                 <TableRow>
//                   <TableHead>Feature</TableHead>
//                   <TableHead>Description</TableHead>
//                   <TableHead className="w-[100px]">Priority</TableHead>
//                   <TableHead className="">Actions</TableHead>
//                 </TableRow>
//               </TableHeader>
//               <TableBody>
//                 {proposal_features?.map((feature) => (
//                   <TableRow key={feature.id}>
//                     <TableCell className="font-medium">
//                       {feature.feature_name}
//                     </TableCell>
//                     <TableCell>{feature.feature_description}</TableCell>
//                     <TableCell>
//                       <Badge
//                         className="capitalize"
//                         variant={
//                           feature.feature_priority === 'High'
//                             ? 'destructive'
//                             : feature.feature_priority === 'Medium'
//                               ? 'default'
//                               : 'secondary'
//                         }
//                       >
//                         {feature.feature_priority}
//                       </Badge>
//                     </TableCell>
//                     <TableCell>
//                       <EditProposal
//                         base={{
//                           ...feature,
//                           feature_id: feature.id,
//                         }}
//                         editDescription="You can edit the project features here."
//                         layout={edit_feature_layout}
//                         proposal={proposal}
//                         editSection="Project Features"
//                         completeFn={updateProposalFeatureFn}
//                         proposal_features={proposal_features}
//                       />
//                     </TableCell>
//                   </TableRow>
//                 ))}
//               </TableBody>
//             </Table>
//           </CardContent>
//         </Card>
//       </div>
//     </div>
//   );
// }
