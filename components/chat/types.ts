export type User = {
  name: string;
  role: string;
  status: string;
  uid: string;
  blockedByMe: boolean;
};

export type Notification = {
  from: string;
  text: string;
  type: string;
  uid: string;
};

export type ChatProps = {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  mode: string;
  setMode: React.Dispatch<React.SetStateAction<string>>;
  conversationId: string;
  setConversationId: React.Dispatch<React.SetStateAction<string>>;
  activeUID: string;
  setActiveUID: React.Dispatch<React.SetStateAction<string>>;
  notification: Notification | null;
  setNotification: React.Dispatch<React.SetStateAction<Notification | null>>;
};
