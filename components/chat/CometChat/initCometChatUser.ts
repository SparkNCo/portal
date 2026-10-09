import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { supabase } from "@/lib/supabase-client";

// One login at a time: callers that arrive while it's running share its
// result. A second concurrent CometChat.login() fails with LOGIN_IN_PROGRESS
// (React's dev double-mount, or two chat views mounting together), which
// showed "Failed to initialize chat" even though the first login worked.
let inFlight: Promise<CometChat.User> | null = null;

export function initCometChatUser(): Promise<CometChat.User> {
  if (!inFlight) {
    inFlight = loginCometChatUser().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

async function loginCometChatUser(): Promise<CometChat.User> {
  await CometChat.init(
    COMETCHAT_CONSTANTS.APP_ID,
    new CometChat.AppSettingsBuilder()
      .setRegion(COMETCHAT_CONSTANTS.REGION)
      .subscribePresenceForAllUsers()
      .build(),
  );

  const { data } = await supabase.auth.getUser();
  const supaUser = data.user;
  if (!supaUser) throw new Error("Not logged in");

  let cometUser = await CometChat.getLoggedinUser();
  if (cometUser && cometUser.getUid() !== supaUser.id) {
    await CometChat.logout();
    cometUser = null;
  }

  if (!cometUser) {
    try {
      cometUser = await CometChat.login(supaUser.id, COMETCHAT_CONSTANTS.AUTH_KEY);
    } catch (loginErr: any) {
      if (loginErr?.code !== "ERR_UID_NOT_FOUND") throw loginErr;
      const newUser = new CometChat.User(supaUser.id);
      newUser.setName(supaUser.email ?? supaUser.id);
      await CometChat.createUser(newUser, COMETCHAT_CONSTANTS.AUTH_KEY);
      cometUser = await CometChat.login(supaUser.id, COMETCHAT_CONSTANTS.AUTH_KEY);
    }
  }

  return cometUser!;
}
