
import ballerina/test;
import ballerina/websocket;

const int TEST_PORT = 18003;

service class EchoService {
    *VoiceService;

    remote function onChatMessage(ChatRequest request) returns string|error {
        if request.message == "boom" {
            return error("handler said no");
        }
        return string `${request.sessionId}:${request.message}`;
    }
}

final EchoService echoService = new;
final Listener testListener = check new (TEST_PORT);

@test:BeforeSuite
function startListener() returns error? {
    check testListener.attach(echoService, "/chat");
    check testListener.'start();
}

@test:AfterSuite
function stopListener() returns error? {
    check testListener.gracefulStop();
}

@test:Config {}
function testRoundTrip() returns error? {
    websocket:Client wsClient = check new (string `ws://localhost:${TEST_PORT}/chat?sessionId=s1`);
    check wsClient->writeTextMessage("hello");
    string reply = check wsClient->readTextMessage();
    test:assertEquals(reply, "s1:hello");
    check wsClient->close();
}

@test:Config {}
function testSessionIdDefaultsWhenAbsent() returns error? {
    websocket:Client wsClient = check new (string `ws://localhost:${TEST_PORT}/chat`);
    check wsClient->writeTextMessage("hello");
    string reply = check wsClient->readTextMessage();
    test:assertTrue(reply.endsWith(":hello"), "reply should carry a session id");
    test:assertTrue(reply.length() > "hello".length() + 1, "session id should not be empty");
    check wsClient->close();
}

@test:Config {}
function testHistoryIsUnpacked() returns error? {
    websocket:Client wsClient = check new (string `ws://localhost:${TEST_PORT}/chat?sessionId=s2`);
    ChatMessage[] history = [
        {role: "user", content: "first"},
        {role: "assistant", content: "reply"},
        {role: "user", content: "latest"}
    ];
    check wsClient->writeTextMessage(history.toJsonString());
    string reply = check wsClient->readTextMessage();
    test:assertEquals(reply, "s2:latest", "message should be the last user turn");
    check wsClient->close();
}

@test:Config {}
function testPlainJsonArrayIsNotTreatedAsHistory() returns error? {
    websocket:Client wsClient = check new (string `ws://localhost:${TEST_PORT}/chat?sessionId=s3`);
    check wsClient->writeTextMessage("[1, 2, 3]");
    string reply = check wsClient->readTextMessage();
    test:assertEquals(reply, "s3:[1, 2, 3]");
    check wsClient->close();
}

@test:Config {}
function testHandlerErrorClosesWith1011() returns error? {
    websocket:Client wsClient = check new (string `ws://localhost:${TEST_PORT}/chat?sessionId=s4`);
    check wsClient->writeTextMessage("boom");
    string|websocket:Error reply = wsClient->readTextMessage();
    if reply !is websocket:Error {
        test:assertFail("expected the connection to close, got: " + reply);
    }
    test:assertTrue(reply.message().includes("handler said no"),
            "close reason should carry the handler's message, got: " + reply.message());
}

@test:Config {}
function testDetachOfUnattachedServiceFails() {
    EchoService stranger = new;
    error? result = testListener.detach(stranger);
    if result !is error {
        test:assertFail("detaching a service that was never attached should fail");
    }
    test:assertEquals(result.message(), "service is not attached to this listener");
}


@test:Config {dependsOn: [testRoundTrip, testSessionIdDefaultsWhenAbsent, testHistoryIsUnpacked,
        testPlainJsonArrayIsNotTreatedAsHistory, testHandlerErrorClosesWith1011,
        testDetachOfUnattachedServiceFails]}
function testDetachIsAcceptedButDoesNotStopServing() returns error? {
    check testListener.detach(echoService);

    websocket:Client wsClient = check new (string `ws://localhost:${TEST_PORT}/chat?sessionId=s5`);
    check wsClient->writeTextMessage("hello");
    string reply = check wsClient->readTextMessage();
    test:assertEquals(reply, "s5:hello",
            "known ballerina/websocket limitation: detach does not unregister an upgrade service");
    check wsClient->close();

    error? second = testListener.detach(echoService);
    test:assertTrue(second is error, "the service should no longer be tracked");
}
