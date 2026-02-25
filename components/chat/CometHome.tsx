/* "use client"
import React, { useState } from "react";
import Chat from "./CometChat/Chat";

export default function CometHome() {
  let [libraryImported, setLibraryImported] = useState(false);

  React.useEffect(() => {
    window.CometChat = require("@cometchat/chat-sdk-javascript").CometChat;
    setLibraryImported(true);
  });

  return libraryImported ? <Chat /> : <p>Loading....</p>;
}
 */