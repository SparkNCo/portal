import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  JiraIssueStatusType,
  JiraIssueType,
  JiraPriorityType,
} from '@/lib/types/services/jira';
import { getInitials, getTimeAgo } from '@/lib/utils';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Bug,
  CheckCircle2,
  Clock,
  Link2,
  MessageSquare,
  Tag,
  User,
  BookOpen,
  Layers,
  Star,
  ArrowUpCircle,
  Eye,
} from 'lucide-react';
import { ReactNode } from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../tooltip';

export interface JiraTicketProps {
  ticketId: string;
  title: string;
  description: string;
  priority: JiraPriorityType;
  issueType: JiraIssueType;
  assignee?: string;
  tags?: string[];
  progress?: number;
  createdAt: string;
  commentCount?: number;
  status: JiraIssueStatusType;
  projectName: string;
  projectColor?: string;
}

export default function JiraTicket({
  ticketId,
  title,
  description,
  priority = 'Medium',
  issueType = 'Task',
  assignee,
  tags = [],
  progress = 0,
  createdAt,
  commentCount = 0,
  status = 'To Do',
  projectName,
  projectColor = '#0052CC', // blue default color from Jira
}: JiraTicketProps) {
  // Get priority icon and color for the badge
  const getPriorityDetails = (
    priority: JiraPriorityType
  ): { icon: ReactNode; color: string } => {
    switch (priority) {
      case 'Highest':
        return {
          icon: <ArrowUp className="h-3 w-3" />,
          color: 'border-red-500 text-red-500',
        };
      case 'High':
        return {
          icon: <ArrowUp className="h-3 w-3" />,
          color: 'border-amber-500 text-amber-500',
        };
      case 'Medium':
        return {
          icon: <ArrowRight className="h-3 w-3" />,
          color: 'border-yellow-500 text-yellow-500',
        };
      case 'Low':
        return {
          icon: <ArrowDown className="h-3 w-3" />,
          color: 'border-blue-400 text-blue-400',
        };
      case 'Lowest':
        return {
          icon: <ArrowDown className="h-3 w-3" />,
          color: 'border-gray-400 text-gray-400',
        };
    }
  };

  // Get issue type icon
  const getIssueTypeIcon = (type: JiraIssueType) => {
    switch (type) {
      case 'Bug':
        return <Bug className="h-4 w-4 text-red-500" />;
      case 'Task':
        return <CheckCircle2 className="h-4 w-4 text-blue-500" />;
      case 'Story':
        return <BookOpen className="h-4 w-4 text-green-500" />;
      case 'Epic':
        return <Layers className="h-4 w-4 text-purple-500" />;
      case 'Feature':
        return <Star className="h-4 w-4 text-yellow-500" />;
      case 'Improvement':
        return <ArrowUpCircle className="h-4 w-4 text-cyan-500" />;
    }
  };

  // Get status badge
  const getStatusBadge = (status: JiraIssueStatusType) => {
    switch (status) {
      case 'To Do':
        return (
          <Badge className="bg-gray-100 hover:bg-gray-100 text-gray-700 rounded-sm">
            To Do
          </Badge>
        );
      case 'In Progress':
        return (
          <Badge className="bg-blue-100 hover:bg-blue-100 text-blue-700 rounded-sm">
            <Clock className="h-3 w-3 mr-1" />
            In Progress
          </Badge>
        );
      case 'In Review':
        return (
          <Badge className="bg-purple-100 hover:bg-purple-100 text-purple-700 rounded-sm">
            <Eye className="h-3 w-3 mr-1" />
            In Review
          </Badge>
        );
      case 'Done':
        return (
          <Badge className="bg-green-100 hover:bg-green-100 text-green-700 rounded-sm">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Done
          </Badge>
        );
      case 'Blocked':
        return (
          <Badge className="bg-red-100 hover:bg-red-100 text-red-700 rounded-sm">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Blocked
          </Badge>
        );
    }
  };

  const priorityDetails = getPriorityDetails(priority);

  return (
    <Card
      className={`w-full max-w-md border-l-4 shadow-md hover:shadow-lg dark:shadow-zinc-900 transition-shadow duration-300 ease-in-out h-full justify-between flex flex-col`}
      style={{ borderLeftColor: projectColor }}
    >
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-xs text-muted-foreground mb-1">{ticketId}</div>
            <h3 className="font-medium text-base">{title}</h3>
          </div>
          <Badge
            variant="outline"
            className={`flex items-center gap-1 px-2 ${priorityDetails.color}`}
          >
            {priorityDetails.icon}
            {priority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-3">
        <div className="text-sm text-muted-foreground mb-4">{description}</div>

        <div className="grid grid-cols-2 gap-y-3 text-xs mb-4">
          <div className="flex items-center gap-2">
            {getIssueTypeIcon(issueType)}
            <span className="text-muted-foreground">{issueType}</span>
          </div>
          {assignee && (
            <div className="flex items-center gap-2">
              <User className="size-4 text-muted-foreground" />
              <span>Assignee:</span>
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger>
                    <Avatar className="size-5">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(assignee)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{assignee}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
          {tags.length > 0 && (
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-muted-foreground" />
              {tags.map((tag, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-[10px] h-4 px-1"
                >
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        {progress > 0 && (
          <div className="space-y-2 mb-3">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}

        <Separator className="my-3" />

        <div className="flex justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            <span>Created {getTimeAgo(createdAt)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            <span>
              {commentCount} comment{commentCount !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className=" flex justify-between bg-muted/30  py-4 text-xs">
        <div className="flex items-center">
          {getStatusBadge(status)}
          <span className="text-muted-foreground ml-2">
            Project: {projectName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {status === 'Blocked' && (
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          )}
        </div>
      </CardFooter>
    </Card>
  );
}
