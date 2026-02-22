"use client";

import { ReactNode, useEffect, useState } from "react";
import {
  CometChatUIKit,
  UIKitSettingsBuilder,
} from "@cometchat/chat-uikit-react";

type Props = {
  children: ReactNode;
};

export default function CometChatProvider({ children }: Props) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initUIKit = async () => {
      try {
        const APP_ID = process.env.NEXT_PUBLIC_COMETCHAT_APP_ID!;
        const REGION = process.env.NEXT_PUBLIC_COMETCHAT_REGION!;
        const AUTH_KEY = process.env.NEXT_PUBLIC_COMETCHAT_AUTH_KEY!;

        const settings = new UIKitSettingsBuilder()
          .setAppId(APP_ID)
          .setRegion(REGION)
          .setAuthKey(AUTH_KEY)
          .subscribePresenceForAllUsers()
          .build();

        await CometChatUIKit.init(settings);
        setReady(true);
      } catch (err) {
        console.error("UI Kit init failed", err);
      }
    };

    initUIKit();
  }, []);

  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center">
        Initializing chat…
      </div>
    );
  }

  return <>{children}</>;
}
