import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  children: React.ReactNode;
  icon: React.ReactNode;
};
export function HelpTooltip({ children, icon }: Props) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger className="hover:scale-105 transition-all ">
          {icon}
        </TooltipTrigger>
        <TooltipContent>{children}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
