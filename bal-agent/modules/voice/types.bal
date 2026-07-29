
# + role - Who produced the content, typically `user` or `assistant`
# + content - The text of the turn
public type ChatMessage record {|
    string role;
    string content;
|};


# + sessionId - Identifies the caller's session. Stable across the turns of one
# connection, so it can be used directly as an agent memory key
# + message - The latest user utterance. Always populated, whether the caller
# sent the utterance alone or the whole conversation
# + history - The conversation so far, present only when the caller sends it
public type ChatRequest record {|
    string sessionId;
    string message;
    ChatMessage[] history?;
|};


public type VoiceService distinct service object {
    remote function onChatMessage(ChatRequest request) returns string|error;
};
