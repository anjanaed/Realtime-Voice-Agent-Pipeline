"""
 Copyright (c) 2026, WSO2 LLC. (http://www.wso2.com).

 This software is the property of WSO2 LLC. and its suppliers, if any.
 Dissemination of any information or reproduction of any material contained
 herein is strictly forbidden, unless permitted by WSO2 in accordance with
 the WSO2 Commercial License available at http://wso2.com/licenses.
 For specific language governing the permissions and limitations under
 this license, please see the license as well as any agreement you’ve
 entered into with WSO2 governing the purchase of this software and any
 associated services.
"""

from __future__ import annotations

import asyncio
import re
import uuid
from typing import Any, Callable

import websockets
from websockets.asyncio.client import ClientConnection
from websockets.connection import State as WSState

from livekit.agents import llm, utils
from livekit.agents._exceptions import APIConnectionError
from livekit.agents.llm import ChatContext, ToolChoice
from livekit.agents.types import (
    DEFAULT_API_CONNECT_OPTIONS,
    NOT_GIVEN,
    APIConnectOptions,
    NotGivenOr,
)


_SENTENCE_RE = re.compile(r'(?<=[.!?])\s+(?=[A-Z"\'])')


def _split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    return [p.strip() for p in _SENTENCE_RE.split(text) if p.strip()]


class IntegratorAgent(llm.LLM):
    def __init__(
        self,
        *,
        url: str,
        session_id: str | None = None,
        max_message_size: int = 10 * 1024 * 1024,
        on_response: Callable[[str], None] | None = None,
    ) -> None:
        super().__init__()
        self._url = url
        self._session_id = session_id or str(uuid.uuid4())
        self._max_message_size = max_message_size
        self._ws: ClientConnection | None = None
        self._ws_lock = asyncio.Lock()
        self._on_response = on_response

    @property
    def model(self) -> str:
        return "wso2-integrator-agent"

    @property
    def provider(self) -> str:
        return "wso2-integrator"

    async def _acquire_ws(self) -> websockets.WebSocketClientProtocol:
        async with self._ws_lock:
            if self._ws is None or self._ws.state is not WSState.OPEN:
                url = f"{self._url}?sessionId={self._session_id}"
                self._ws = await websockets.connect(
                    url,
                    max_size=self._max_message_size,
                    ping_interval=20,
                    ping_timeout=10,
                )
                await self._ws.recv()  # consume READY handshake
            return self._ws

    async def _close_ws(self) -> None:
        async with self._ws_lock:
            if self._ws is not None:
                ws = self._ws
                self._ws = None
                try:
                    await asyncio.shield(ws.close())
                except Exception:
                    pass
                except asyncio.CancelledError:
                    pass

    def chat(
        self,
        *,
        chat_ctx: ChatContext,
        tools: list[llm.Tool] | None = None,
        conn_options: APIConnectOptions = DEFAULT_API_CONNECT_OPTIONS,
        parallel_tool_calls: NotGivenOr[bool] = NOT_GIVEN,
        tool_choice: NotGivenOr[ToolChoice] = NOT_GIVEN,
        extra_kwargs: NotGivenOr[dict[str, Any]] = NOT_GIVEN,
    ) -> IntegratorAgentStream:
        return IntegratorAgentStream(
            self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=conn_options,
        )

    async def aclose(self) -> None:
        await self._close_ws()


class IntegratorAgentStream(llm.LLMStream):
    def __init__(
        self,
        llm: IntegratorAgent,
        *,
        chat_ctx: ChatContext,
        tools: list[llm.Tool],
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(llm, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)
        self._ballerina = llm

    def _latest_user_message(self) -> str | None:
        for msg in reversed(self._chat_ctx.messages()):
            if msg.role == "user":
                return (msg.text_content or "").strip() or None
        return None

    async def _run(self) -> None:
        user_text = self._latest_user_message()
        if not user_text:
            return

        ws = await self._ballerina._acquire_ws()
        response_complete = False

        try:
            await ws.send(user_text)
            message_id = utils.shortuuid("bal_")
            full_content = ""

            while True:
                raw = await ws.recv()
                if not isinstance(raw, str):
                    continue
                if raw == "END":
                    break
                if raw.startswith("ERROR:"):
                    await self._ballerina._close_ws()
                    raise APIConnectionError(raw[len("ERROR:"):])
                full_content += raw

            response_complete = True

            if self._ballerina._on_response and full_content:
                self._ballerina._on_response(full_content)

            for sentence in _split_sentences(full_content) or [full_content.strip()]:
                self._event_ch.send_nowait(
                    llm.ChatChunk(
                        id=message_id,
                        delta=llm.ChoiceDelta(role="assistant", content=sentence + " "),
                    )
                )
                await asyncio.sleep(0)

        except asyncio.CancelledError:
            if not response_complete:
                await self._ballerina._close_ws()
            raise
        except (websockets.ConnectionClosed, OSError) as e:
            await self._ballerina._close_ws()
            raise APIConnectionError(f"WebSocket error: {e}") from e
