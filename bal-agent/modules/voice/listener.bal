// Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).
//
// This software is the property of WSO2 LLC. and its suppliers, if any.
// Dissemination of any information or reproduction of any material contained
// herein is strictly forbidden, unless permitted by WSO2 in accordance with
// the WSO2 Commercial License available at http://wso2.com/licenses.
// For specific language governing the permissions and limitations under
// this license, please see the license as well as any agreement you've
// entered into with WSO2 governing the purchase of this software and any
// associated services.

import ballerina/http;
import ballerina/uuid;
import ballerina/websocket;


const int MAX_FRAME_SIZE = 104857600; // 100 MB

type Attachment record {|
    VoiceService svc;
    websocket:UpgradeService upgradeService;
|};


public class Listener {
    private final websocket:Listener wsListener;
    private Attachment[] attachments = [];

    # Initializes the listener.
    #
    # + listenOn - Port to listen on, or an existing `http:Listener` to share a
    # port with, for example with a health-check service
    # + config - Listener configuration, such as `secureSocket` for `wss://`
    # + return - An `error` if the underlying listener could not be created
    public function init(int|http:Listener listenOn = 8003,
            *websocket:ListenerConfiguration config) returns error? {
        self.wsListener = check new (listenOn, config);
    }

    # Attaches a service to the listener.
    #
    # + svc - The service that answers chat requests
    # + name - Base path of the service
    # + return - An `error` if the service could not be attached
    public function attach(VoiceService svc, string[]|string? name = ()) returns error? {
        websocket:UpgradeService upgradeService = createUpgradeService(svc);
        check self.wsListener.attach(upgradeService, name);
        self.attachments.push({svc, upgradeService});
    }

    # Detaches a service from the listener.
    # + svc - The service to detach
    # + return - An `error` if the service was never attached, or if the
    # underlying listener rejected the detach
    public function detach(VoiceService svc) returns error? {
        foreach int i in 0 ..< self.attachments.length() {
            if self.attachments[i].svc === svc {
                Attachment attachment = self.attachments.remove(i);
                return self.wsListener.detach(attachment.upgradeService);
            }
        }
        return error("service is not attached to this listener");
    }

    # Starts the listener.
    #
    # + return - An `error` if the listener could not be started
    public function 'start() returns error? => self.wsListener.'start();

    # Stops the listener, serving already-accepted requests first.
    #
    # + return - An `error` if the listener could not be stopped
    public function gracefulStop() returns error? => self.wsListener.gracefulStop();

    # Stops the listener immediately.
    #
    # + return - An `error` if the listener could not be stopped
    public function immediateStop() returns error? => self.wsListener.immediateStop();
}


function createUpgradeService(VoiceService svc) returns websocket:UpgradeService {
    websocket:UpgradeService upgradeService = @websocket:ServiceConfig {
        maxFrameSize: MAX_FRAME_SIZE
    } service object {
        resource function get .(http:Request req) returns websocket:Service|websocket:UpgradeError {
            string sessionId = req.getQueryParamValue("sessionId") ?: uuid:createRandomUuid();
            return new VoiceConnection(svc, sessionId);
        }
    };
    return upgradeService;
}
