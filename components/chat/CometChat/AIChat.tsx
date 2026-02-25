import React from "react";
import { CometChat } from "@cometchat/chat-sdk-javascript";
import { CometChatAIAssistantChat } from "@cometchat/chat-uikit-react";

export const AIAssistantChatDemo = () => {
    const [agent, setAgent] = React.useState<CometChat.User>();

    React.useEffect(() => {
        CometChat.getUser("e17fda15-1881-4375-a818-21fb97a507ce").then((u) => setAgent(u));
    }, []);

    if (!agent) return null;

    // Example: Set streaming speed to 30 characters per second
    // and show close button
    // You can also customize suggestions, empty state, etc.
    return (
        <CometChatAIAssistantChat
            user={agent}
            showCloseButton={true}
           // setStreamingSpeed={30}
        />
    )
}