

import ballerina/log;
import ballerina/websocket;

service class VoiceConnection {
    *websocket:Service;

    private final VoiceService handler;
    private final string sessionId;

    isolated function init(VoiceService handler, string sessionId) {
        self.handler = handler;
        self.sessionId = sessionId;
    }

    remote function onTextMessage(websocket:Caller caller, string text)
            returns websocket:InternalServerError? {
        ChatRequest request = toChatRequest(self.sessionId, text);
        string|error reply = self.handler->onChatMessage(request);
        if reply is error {
            log:printError("chat handler failed", reply, sessionId = self.sessionId);
            websocket:InternalServerError closeFrame = {reason: reply.message()};
            return closeFrame;
        }

        websocket:Error? writeResult = caller->writeTextMessage(reply);
        if writeResult is websocket:Error {
            log:printError("failed to write reply", writeResult, sessionId = self.sessionId);
            websocket:InternalServerError closeFrame = {reason: writeResult.message()};
            return closeFrame;
        }
        return;
    }

    remote function onError(websocket:Caller caller, error err) {
        log:printError("connection error", err, sessionId = self.sessionId);
    }
}


isolated function toChatRequest(string sessionId, string text) returns ChatRequest {
    json|error parsed = text.fromJsonString();
    if parsed is json[] {
        ChatMessage[]|error history = parsed.cloneWithType();

        if history is ChatMessage[] && history.length() > 0 {
            foreach ChatMessage message in history.reverse() {
                if message.role == "user" {
                    return {sessionId, message: message.content, history};
                }
            }
        }
    }
    return {sessionId, message: text};
}
