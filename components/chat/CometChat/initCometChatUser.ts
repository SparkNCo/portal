import { CometChat } from "@cometchat/chat-sdk-javascript";
import { COMETCHAT_CONSTANTS } from "./constants";
import { supabase } from "@/lib/supabase-client";

export async function initCometChatUser(): Promise<CometChat.User> {
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
