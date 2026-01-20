'use client';

import { useState, useEffect } from 'react';
import dayjs from 'dayjs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Bot, User } from 'lucide-react';

export interface ChatMessage {
  id: string;
  date: Date;
  message: string;
}

interface ChatInterfaceProps {
  systemMessages: ChatMessage[];
  userMessages: ChatMessage[];
  height?: string;
  className?: string;
  avatarSrc?: {
    system?: string;
    user?: string;
  };
}

export function ChatInterface({
  systemMessages,
  userMessages,
  height = 'h-[600px]',
  className,
  avatarSrc = {},
}: ChatInterfaceProps) {
  const [allMessages, setAllMessages] = useState<
    (ChatMessage & { type: 'system' | 'user' })[]
  >([]);

  // Combine and sort messages by date
  useEffect(() => {
    const combined = [
      ...systemMessages.map((msg) => ({ ...msg, type: 'system' as const })),
      ...userMessages.map((msg) => ({ ...msg, type: 'user' as const })),
    ].sort((a, b) => a.date.getTime() - b.date.getTime());

    setAllMessages(combined);
  }, [systemMessages, userMessages]);

  return (
    <div className={cn('rounded-lg border bg-background', height, className)}>
      <ScrollArea className="h-full p-4">
        <div className="flex flex-col gap-4">
          {allMessages.map((message) => (
            <div
              key={message.id}
              className={cn(
                'flex gap-3 max-w-[80%]',
                message.type === 'user' ? 'ml-auto' : ''
              )}
            >
              {message.type === 'system' && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarSrc.system} alt="AI" />
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs ">
                    <Bot className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}

              <div className="flex flex-col gap-1">
                <div
                  className={cn(
                    'rounded-lg p-3 text-sm',
                    message.type === 'system'
                      ? 'bg-muted text-foreground'
                      : 'bg-primary text-primary-foreground'
                  )}
                >
                  {message.message}
                </div>
                <span className="text-xs text-muted-foreground">
                  {dayjs(message.date).format('MMM D, h:mm A')}
                </span>
              </div>

              {message.type === 'user' && (
                <Avatar className="h-8 w-8">
                  <AvatarImage src={avatarSrc.user} alt="User" />
                  <AvatarFallback className="bg-secondary text-secondary-foreground text-xs">
                    <User className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
