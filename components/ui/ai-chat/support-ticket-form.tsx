'use client';

import * as React from 'react';
import {
  Bug,
  FileText,
  LightbulbIcon,
  Mic,
  Search,
  Filter,
  SortDesc,
  X,
  ArrowUp,
  LoaderCircle,
  Paperclip,
  ChevronLeft,
  Lightbulb,
  Ellipsis,
  Dot,
  Plus,
  SearchIcon,
  Repeat,
  CheckCheck,
  TriangleAlert,
} from 'lucide-react';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useFormStatus } from 'react-dom';
import { callAssistantFn } from '@/lib/services/AI-Chat/call-assistant';
import { Card, CardContent, CardHeader, CardTitle } from '../card';
import { toast } from 'sonner';
import { getErrorMessage } from '@/utils/helpers';
import {
  QueryResponse,
  RecordMetadataValue,
} from '@pinecone-database/pinecone';
import JiraTicket from '../cards/jira-ticket-card';
import { AnimatePresence, motion } from 'framer-motion';
import DynamicForm from '../form/custom-form';

//Layouts imports
import feature_layout from '@/layouts/create-jira-ticket.json';
//Others
import { LayoutType } from '@/lib/types/utils/form';
import { createOrUpdateTicket } from '@/lib/services/AI-Chat/create-update-ticket';
import { ExtractedIssueData, JiraIssueType } from '@/lib/types/services/jira';
import { Modal } from '../reusable-modal';
import { deletePineconeRecords } from '@/lib/services/pinecone/delete-pinecone-records';
const options = [
  {
    icon: LightbulbIcon,
    title: 'Create new request',
    example: 'e.g. "Dark Mode Feature"',
    iconColor: 'text-blue-500',
    bgColor: 'bg-blue-100',
  },
  {
    icon: Bug,
    title: 'Report Bug',
    example: 'e.g. Page crash on upload',
    iconColor: 'text-red-500',
    bgColor: 'bg-red-100',
  },
  {
    icon: FileText,
    title: 'Ask for Documentation',
    example: 'e.g. User Manual for Dashboard',
    iconColor: 'text-purple-500',
    bgColor: 'bg-purple-100',
  },
  {
    icon: Search,
    title: 'Search Ticket',
    example: 'e.g. "idk"',
    iconColor: 'text-orange-500',
    bgColor: 'bg-orange-100',
  },
];

const filters = [
  {
    icon: Filter,
    title: 'Filter by Status',
    value: 'filterByStatus',
  },

  {
    icon: Paperclip,
    title: 'Search Attachments',
    value: 'searchAttachments',
  },
  {
    icon: SortDesc,
    title: 'Sort Results',
    value: 'sortResults',
  },
];
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      className={cn(
        'p-2 rounded-full bg-gray-900 dark:bg-gray-50 hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors',
        pending && 'opacity-50 cursor-not-allowed'
      )}
      disabled={pending}
    >
      {pending ? (
        <LoaderCircle className="w-4 h-4 dark:text-gray-900 text-white animate-spin" />
      ) : (
        <ArrowUp className="w-4 h-4 dark:text-gray-900 text-white" />
      )}
    </button>
  );
}
const badgeClass = ' border rounded-full flex items-center gap-1.5 shadow-sm';

export default function SupportTicketUI() {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [selectedOption, setSelectedOption] = React.useState<string>('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  const commandRef = React.useRef<HTMLDivElement>(null);
  const formRef = React.useRef<HTMLFormElement>(null);

  const [toggles, setToggles] = React.useState<Record<string, boolean>>({
    filterByStatus: false,
    searchAttachments: false,
    sortResults: false,
  });
  //Main states
  const [step, setStep] = React.useState(1);
  const [matches, setMatches] = React.useState<QueryResponse['matches']>([]);
  const [selectedMatch, setSelectedMatch] = React.useState<
    QueryResponse['matches'][0] | null
  >(null);
  const [layout, setLayout] = React.useState<LayoutType>(feature_layout);
  const [issueType, setIssueType] = React.useState<JiraIssueType>('Task');
  const [title, setTitle] = React.useState('');
  // Handle click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        commandRef.current &&
        !commandRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  // Handle input focus
  const handleFocus = () => setOpen(true);
  // Handle option selection
  const handleSelect = (value: string) => {
    setSelectedOption(value);
    setOpen(false);
  };

  // Handle removing a selected option
  const handleRemoveOption = (optionToRemove: string) => {
    setSelectedOption('');
  };

  const handleChangeFilters = (value: string) => {
    setToggles((prev) => ({
      ...prev,
      [value]: !prev[value as keyof typeof prev],
    }));
  };
  const handleReTry = () => {
    setStep(1);
    setSelectedMatch(null);
    setTitle('');
    setMatches([]);
  };
  const handleStepOne = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    try {
      const response = await callAssistantFn(formData);
      if (response?.error) {
        toast.error(response?.error);
        return;
      }
      if (
        response?.matches &&
        response?.matches?.length > 0 &&
        response?.success &&
        response?.type
      ) {
        setTitle(response?.success);
        setMatches(response?.matches);
        setIssueType(response?.type);
        response.type == 'Task'
          ? setLayout(feature_layout)
          : setLayout(feature_layout);
        setStep(2);
      } else {
        setStep(2);
        setTitle('No matches found. You can create a new issue.');
        if (response?.type) {
          setIssueType(response?.type);
          response.type == 'Task'
            ? setLayout(feature_layout)
            : setLayout(feature_layout);
        }
      }
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    }
  };
  const handleStepTwo = async (match?: any) => {
    try {
      if (!match) {
        setSelectedMatch(null);
      } else {
        setSelectedMatch(match);
      }

      setStep(3);
    } catch (error: any) {
      console.log('error catch --->', error);
    }
  };

  const handleReCreateTicket = async (ticket: QueryResponse['matches'][0]) => {
    try {
      const formData = new FormData();
      formData.append('values', JSON.stringify(ticket.metadata));
      const { error, success } = await createOrUpdateTicket(formData);
      if (error) {
        toast.error(error);
        return;
      }
      const { error: pineconeError } = await deletePineconeRecords([ticket.id]);
      if (pineconeError) {
        toast.error(pineconeError);
        return;
      }
      toast.success(success);
      handleReTry();
    } catch (error) {
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    }
  };
  return (
    <div className="grid gap-8 w-full md:py-0 py-8">
      {step === 1 && (
        <>
          <h1 className="text-2xl text-center font-[500] text-[#334155] dark:text-white">
            How can I help you with your tickets today?
          </h1>
          <Card className="w-full max-w-2xl mx-auto pt-6">
            <CardContent>
              <form
                ref={formRef}
                onSubmit={handleStepOne}
                className="w-full max-w-2xl mx-auto"
              >
                <div className="relative">
                  {selectedOption && (
                    <div className="flex flex-wrap gap-2 mb-4 border-b  py-2 w-fit">
                      <p className="text-sm text-zinc-600 dark:text-zinc-500">
                        You have selected:
                      </p>
                      <div key={selectedOption}>
                        <input
                          type="hidden"
                          name="selectedOption"
                          value={selectedOption}
                        />
                        <Badge
                          variant="secondary"
                          className="flex items-center gap-1"
                        >
                          {selectedOption}
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(selectedOption)}
                            className="ml-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Command menu */}
                  <div
                    ref={commandRef}
                    className={cn(
                      'absolute bottom-full left-0 right-0 mb-2 transition-all duration-200 ease-in-out',
                      open
                        ? 'opacity-100 translate-y-0'
                        : 'opacity-0 translate-y-2 pointer-events-none'
                    )}
                  >
                    <input
                      type="hidden"
                      name="selectedOption"
                      value={selectedOption}
                    />
                    <Command className="rounded-xl border shadow-lg">
                      <CommandList>
                        <CommandGroup>
                          {options.map((option) => (
                            <CommandItem
                              key={option.title}
                              onSelect={() => handleSelect(option.title)}
                              className="flex items-start gap-3 p-2 cursor-pointer"
                            >
                              <div
                                className={cn(
                                  'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                                  option.bgColor
                                )}
                              >
                                <option.icon
                                  className={cn('w-4 h-4', option.iconColor)}
                                />
                              </div>
                              <div>
                                <div className="font-medium text-gray-800 dark:text-zinc-200">
                                  {option.title}
                                </div>
                                <div className="text-sm text-gray-500 dark:text-zinc-400">
                                  {option.example}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </div>

                  {/* Main input field */}
                  <div className="flex items-center gap-2 border-b ">
                    <input
                      ref={inputRef}
                      type="text"
                      name="query"
                      className="w-full border-0 bg-transparent focus:outline-none focus:ring-0 py-2"
                      placeholder="How can we help?"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onFocus={handleFocus}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="p-2 rounded-full hover:bg-gray-100"
                      >
                        <Mic className="w-4 h-4 text-gray-500" />
                      </button>
                      <SubmitButton />
                    </div>
                  </div>

                  {/* Filter pills/badges */}
                  <div className="flex items-center gap-4 mt-4  flex-wrap">
                    {/* <input type="hidden" name="priority" value={priority} /> */}
                    {filters.map(({ icon: Icon, title, value }) => (
                      <React.Fragment key={value}>
                        <input
                          type="hidden"
                          name={value}
                          value={toggles[value] ? 'true' : 'false'}
                        />

                        <Button
                          type="button"
                          variant={toggles[value] ? 'default' : 'outline'}
                          size="sm"
                          className={`${badgeClass} `}
                          onClick={() => {
                            handleChangeFilters(value);
                          }}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{title}</span>
                        </Button>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </>
      )}
      <AnimatePresence>
        {step == 2 && (
          <>
            {matches && (
              <>
                <motion.h1
                  key="title"
                  initial={{ opacity: 0, x: 15 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -15 }}
                  transition={{ duration: 0.4, type: 'spring' }}
                  className="flex w-full  md:items-center justify-between text-2xl  font-[500] text-[#334155] dark:text-white md:flex-row items-start flex-col gap-y-2 "
                >
                  <div className="flex items-center gap-2">
                    {matches.length > 0 ? <Lightbulb /> : <SearchIcon />}

                    {title}
                  </div>
                  <div className="flex gap-2 sm:items-center items-center">
                    <Button
                      type="button"
                      variant={'outline'}
                      onClick={() => {
                        handleStepTwo();
                      }}
                    >
                      {matches.length > 0 ? (
                        <>
                          <Ellipsis /> No one of these matches
                        </>
                      ) : (
                        <>
                          <Plus /> Create a new Issue
                        </>
                      )}
                    </Button>
                    <span className="text-muted-foreground text-sm text-center">
                      or
                    </span>
                    <Button
                      type="button"
                      className="w-fit"
                      variant={'outline'}
                      onClick={() => {
                        handleReTry();
                      }}
                    >
                      <Repeat /> Try a different question
                    </Button>
                  </div>
                </motion.h1>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  {matches?.map((match, index) => {
                    // @ts-ignore
                    const {
                      summary,
                      description,
                      issuetype,
                      priority,
                      createdAt,
                      status,
                      commentCount,
                      createdBy,
                      issueKey,
                      deleted,
                      deletedAt,
                      project,
                      assignee,
                    }: ExtractedIssueData = match?.metadata || {};
                    const children = (
                      <JiraTicket
                        title={summary}
                        ticketId={match.id}
                        createdAt={createdAt}
                        description={description}
                        issueType={issuetype}
                        priority={priority}
                        projectName={project}
                        commentCount={commentCount}
                        deleted={deleted}
                        deletedAt={deletedAt}
                        assignee={assignee}
                        status={status}
                      />
                    );
                    const button = (
                      <motion.button
                        key={index}
                        initial={{ opacity: 0, x: 15 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="w-full h-full text-start"
                        exit={{ opacity: 0, x: -15 }}
                        transition={{
                          duration: 0.4,
                          type: 'spring',
                          delay: index * 0.1,
                        }}
                        onClick={
                          deleted ? undefined : () => handleStepTwo(match)
                        }
                      >
                        {children}
                      </motion.button>
                    );
                    if (deleted && deletedAt) {
                      return (
                        <Modal
                          key={index}
                          trigger={button}
                          headerIcon={<TriangleAlert />}
                          variant={'default'}
                          args={match}
                          title="This ticket is currently deleted"
                          subtitle=""
                          description="Would you like to create a new ticket with the same details than the deleted one?
                        "
                          onConfirm={handleReCreateTicket}
                          confirmText="Confirm"
                          confirmIcon={<CheckCheck />}
                        />
                      );
                    }
                    return button;
                  })}
                </div>
              </>
            )}
          </>
        )}
        {step == 3 && (
          <div className="w-full grid place-items-center">
            <Card className="w-full max-w-xl">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Dot />{' '}
                  {stepThreeTitle(selectedMatch?.metadata?.summary, issueType)}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DynamicForm
                  layout={layout}
                  base={{
                    id: selectedMatch?.id,
                    ...selectedMatch?.metadata,
                    issueType,
                  }}
                  completeFn={createOrUpdateTicket}
                  lang="en"
                />
              </CardContent>
            </Card>
          </div>
        )}
      </AnimatePresence>
      {step > 1 && (
        <div className="w-full flex justify-between items-center ">
          {step > 2 && (
            <Button
              variant={'outline'}
              onClick={() => {
                setStep((step) => step - 1);
              }}
            >
              <ChevronLeft className=" h-4 w-4" />
              Previous Step
            </Button>
          )}
          {/* {step == 2 && matches && (
            <Button className="self-end ">
            Next Step <ChevronRight className=" h-4 w-4" />
            </Button>
            )} */}
        </div>
      )}
    </div>
  );
}

const stepThreeTitle = (
  title: RecordMetadataValue | undefined,
  type: JiraIssueType | ''
) => {
  if (type == 'Task' && !title) return 'Create Request';
  if (type == 'Task' && title) return 'Update Request';
  if (type == 'Bug' && !title) return 'Create Bug';
  return 'Update Bug';
};
