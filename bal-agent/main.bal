import ballerina/ai;
import ballerina/http;
import ballerina/io;
import ballerina/time;
import ballerina/uuid;
import ballerina/websocket;
import ballerinax/ai.openai;

configurable string openaiToken = ?;
configurable openai:OPEN_AI_MODEL_NAMES openaiModel = openai:GPT_4O_MINI;
configurable string serperApiKey = ?;

// Module-level HTTP client for Serper.dev search.
final http:Client serperClient = check new ("https://google.serper.dev");

type WSO2Product record {|
    string name;
    string category;
    string purpose;
    string latestVersion;
    string[] keyFeatures;
    string deploymentModel;
|};

final map<WSO2Product> & readonly wso2Products = {
    "apim": {
        name: "WSO2 API Manager",
        category: "API Management",
        purpose: "Full lifecycle API management — design, publish, govern, secure, monetize, and analyze APIs",
        latestVersion: "4.3.0",
        keyFeatures: ["API Gateway with rate limiting", "Developer Portal", "API Publisher", "Built-in OAuth2/JWT key manager", "Kubernetes Operator support"],
        deploymentModel: "On-premise, Kubernetes, or Choreo (cloud)"
    },
    "is": {
        name: "WSO2 Identity Server",
        category: "Identity and Access Management",
        purpose: "IAM platform for SSO, MFA, identity federation, user provisioning, and CIAM",
        latestVersion: "7.0.0",
        keyFeatures: ["SSO via SAML 2.0 and OpenID Connect", "Multi-factor authentication", "Identity federation", "Fine-grained authorization", "Adaptive authentication"],
        deploymentModel: "On-premise or Kubernetes; SaaS version is Asgardeo"
    },
    "mi": {
        name: "WSO2 Micro Integrator",
        category: "Integration",
        purpose: "Lightweight integration runtime for connecting services using mediation flows",
        latestVersion: "4.3.0",
        keyFeatures: ["Synapse mediation engine", "200+ pre-built connectors", "REST/SOAP/GraphQL/gRPC support", "VS Code Integration Studio", "Docker and Kubernetes native"],
        deploymentModel: "On-premise, Docker, Kubernetes"
    },
    "si": {
        name: "WSO2 Streaming Integrator",
        category: "Streaming and Analytics",
        purpose: "Real-time streaming data integration and analytics using Siddhi query language",
        latestVersion: "4.3.0",
        keyFeatures: ["Siddhi streaming SQL", "Kafka and NATS integration", "Temporal windowing", "CDC sources", "Error handling and replay"],
        deploymentModel: "On-premise or Kubernetes"
    },
    "choreo": {
        name: "Choreo",
        category: "Internal Developer Platform (Cloud)",
        purpose: "WSO2's cloud-native platform for building and deploying integrations and APIs",
        latestVersion: "SaaS (continuously updated)",
        keyFeatures: ["Managed Ballerina and container hosting", "Built-in CI/CD", "API management included", "Observability with tracing and logs", "Private data plane option"],
        deploymentModel: "SaaS hosted by WSO2 on Azure"
    },
    "asgardeo": {
        name: "Asgardeo",
        category: "Identity as a Service",
        purpose: "Cloud-native IDaaS for customer and workforce identity management",
        latestVersion: "SaaS (continuously updated)",
        keyFeatures: ["Drag-and-drop login flow builder", "Social login and enterprise SSO", "White-labeling", "MFA with TOTP and magic link", "SDKs for React, Angular, Node, Spring Boot"],
        deploymentModel: "SaaS hosted by WSO2"
    },
    "ballerina": {
        name: "Ballerina",
        category: "Integration Language",
        purpose: "Cloud-native programming language for integration and network-aware programming",
        latestVersion: "2201.13.x (Swan Lake)",
        keyFeatures: ["Native HTTP/gRPC/GraphQL/WebSocket types", "Strand-based concurrency", "Structural type system with JSON/XML support", "Visual diagram view", "AI agent framework"],
        deploymentModel: "Any environment (JVM-based runtime)"
    }
};

@ai:AgentTool {
    description: "Returns a list of all WSO2 products with their names and categories. Use when the user asks what products WSO2 offers."
}
isolated function getWSO2ProductList() returns string {
    string result = "";
    foreach var [_, product] in wso2Products.entries() {
        if result.length() > 0 {
            result = result + ", ";
        }
        result = result + product.name + " (" + product.category + ")";
    }
    return result;
}

@ai:AgentTool {
    description: "Returns detailed info about a specific WSO2 product. productKey must be one of: apim, is, mi, si, choreo, asgardeo, ballerina."
}
isolated function getWSO2ProductDetails(string productKey) returns string|error {
    WSO2Product? product = wso2Products[productKey.toLowerAscii()];
    if product is () {
        return error(string `Unknown product key '${productKey}'. Valid keys: apim, is, mi, si, choreo, asgardeo, ballerina.`);
    }
    string features = "";
    foreach string f in product.keyFeatures {
        if features.length() > 0 {
            features = features + "; ";
        }
        features = features + f;
    }
    return string `${product.name} — ${product.purpose}. Latest version: ${product.latestVersion}. Deployment: ${product.deploymentModel}. Key features: ${features}.`;
}

@ai:AgentTool {
    description: "Search WSO2 website and documentation for any query about products, configuration, troubleshooting, releases, or company news. Use this for detailed or specific questions."
}
isolated function searchWSO2(string query) returns string|error {
    json requestBody = {"q": string `site:wso2.com ${query}`, "num": 5};
    http:Request req = new;
    req.setJsonPayload(requestBody);
    req.addHeader("X-API-KEY", serperApiKey);
    req.addHeader("Content-Type", "application/json");
    http:Response resp = check serperClient->post("/search", req);
    json body = check resp.getJsonPayload();

    if body !is map<json> {
        return "Unexpected response format from search API";
    }
    json organicJson = body["organic"];
    if organicJson !is json[] || organicJson.length() == 0 {
        return "No results found for: " + query;
    }

    string result = "";
    foreach json item in organicJson {
        if item !is map<json> {
            continue;
        }
        json titleJson = item["title"];
        json snippetJson = item["snippet"];
        if titleJson is string && snippetJson is string {
            if result.length() > 0 {
                result = result + " | ";
            }
            result = result + titleJson + ": " + snippetJson;
        }
    }
    return result.length() > 0 ? result : "No readable results found for: " + query;
}

@ai:AgentTool
isolated function getCurrentDate() returns time:Date {
    time:Civil {year, month, day} = time:utcToCivil(time:utcNow());
    return {year, month, day};
}

final ai:ModelProvider modelProvider = check new openai:ModelProvider(openaiToken, modelType = openaiModel);

final ai:Agent agent = check new ({
    systemPrompt: {
        role: "WSO2 Expert Assistant",
        instructions: string `You are Jarvis, a knowledgeable and friendly voice assistant. Your purpose is to help users with any information related to WSO2 — its products, documentation, configuration, and company background. When greeting or introducing yourself, say something like: "Hi, I'm Jarvis. How can I assist you with information related to WSO2?"

RESPONSE STYLE:
Keep every response concise and conversational — you are speaking aloud, not writing.
Never use markdown, bullet points, numbered lists, asterisks, or headers.
When listing items read them naturally: "WSO2 has products like API Manager, Identity Server, and Choreo."
Aim for two to four sentences per answer unless the user asks for more detail.
Use only English language.

TOOL USAGE STRATEGY:
Use getWSO2ProductList when the user asks what products WSO2 offers or to list all products — it is fast and accurate.
Use getWSO2ProductDetails for product-specific overviews using the correct key: apim, is, mi, si, choreo, asgardeo, or ballerina.
Use searchWSO2 for any detailed configuration question, troubleshooting, release notes, migration guides, pricing, or anything not covered by the other tools. Prefer searchWSO2 when in doubt.
Use getCurrentDate to contextualize version timelines or answer questions about today's date.
Combine tools when needed: call getWSO2ProductDetails first for context, then searchWSO2 for specifics.

WSO2 COMPANY KNOWLEDGE:
WSO2 was founded in 2005 in Colombo, Sri Lanka by Sanjiva Weerawarana, Paul Fremantle, and Davanum Srinivas.
WSO2 is headquartered in Santa Clara, California, with a large engineering team in Colombo, Sri Lanka.
WSO2 is a leading open-source middleware and integration vendor. Core products are Apache 2.0 licensed.
WSO2 was taken private in 2022 through a management-led buyout.
Flagship cloud products are Choreo (iPaaS and developer platform) and Asgardeo (customer identity as a service).
The agent you are running is itself built in Ballerina, WSO2's open-source integration language.

BOUNDARIES:
If asked something unrelated to WSO2 or technology, politely redirect: I am specialized in WSO2 topics — let me know if you have a question there.
If a search returns no results, say so and suggest checking docs.wso2.com directly.`
    },
    tools: [getCurrentDate, getWSO2ProductList, getWSO2ProductDetails, searchWSO2],
    model: modelProvider
});

@websocket:ServiceConfig {
    maxFrameSize: 104857600
}
service /llm on new websocket:Listener(8003) {

    resource function get .(http:Request req) returns websocket:Service|websocket:UpgradeError {
        string sessionId = req.getQueryParamValue("sessionId") ?: uuid:createRandomUuid();
        LLMService|error svc = new (sessionId);
        if svc is error {
            return error websocket:UpgradeError("Failed to create agent: " + svc.message());
        }
        return svc;
    }
}

service class LLMService {
    *websocket:Service;

    private final string sessionId;

    function init(string sessionId) returns error? {
        self.sessionId = sessionId;
    }

    remote function onOpen(websocket:Caller caller) returns error? {
        io:println(string `[LLM Service] Session connected: ${self.sessionId}`);
        check caller->writeMessage("READY");
    }

    remote function onTextMessage(websocket:Caller caller, string userText) returns error? {
        io:println(string `[LLM Service] Session ${self.sessionId}: Received text (${userText.length()} chars): ${userText}`);

        string|error agentResponse = agent.run(userText, self.sessionId);
        if agentResponse is error {
            io:println(string `[LLM Service] Agent error: ${agentResponse.message()}`);
            check caller->writeMessage("ERROR:Agent failed to process request");
            check caller->writeMessage("END");
            return;
        }

        check caller->writeMessage(string `CHUNK:${agentResponse}`);
        check caller->writeMessage("END");
    }

    remote function onClose(websocket:Caller caller, int statusCode, string reason) {
        _ = caller;
        _ = statusCode;
        _ = reason;
        io:println(string `[LLM Service] Session disconnected: ${self.sessionId}`);
    }

    remote function onError(websocket:Caller caller, error err) {
        _ = caller;
        io:println(string `[LLM Service] Error: ${err.message()}`);
    }
}

public function main() returns error? {
    io:println("===============================================");
    io:println("WSO2 Expert Assistant - Ballerina LLM Service");
    io:println("WebSocket server listening on ws://localhost:8003/llm");
    io:println("===============================================");
}
