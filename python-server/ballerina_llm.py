from __future__ import annotations

import asyncio
import re
import uuid
from typing import Any, Callable

import websockets
from websockets.protocol import State

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


class BallerinaLLM(llm.LLM):
    def __init__(
        self,
        *,
        url: str,
        max_message_size: int = 10 * 1024 * 1024,
        on_response: Callable[[str], None] | None = None,
    ) -> None:
        super().__init__()
        self._url = url
        self._session_id = str(uuid.uuid4())
        self._max_message_size = max_message_size
        self._ws: websockets.WebSocketClientProtocol | None = None
        self._ws_lock = asyncio.Lock()
        self._on_response = on_response

    @property
    def model(self) -> str:
        return "ballerina-wso2-agent"

    @property
    def provider(self) -> str:
        return "Ballerina"

    async def _acquire_ws(self) -> websockets.WebSocketClientProtocol:
        async with self._ws_lock:
            if self._ws is None or self._ws.state != State.OPEN:
                url = f"{self._url}?sessionId={self._session_id}"
                self._ws = await websockets.connect(
                    url,
                    max_size=self._max_message_size,
                    ping_interval=20,
                    ping_timeout=10,
                )
                await self._ws.recv()  # consume READY handshake
            return self._ws

    async def _reset_ws(self) -> None:
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
    ) -> BallerinaLLMStream:
        return BallerinaLLMStream(
            self,
            chat_ctx=chat_ctx,
            tools=tools or [],
            conn_options=conn_options,
        )

    async def aclose(self) -> None:
        await self._reset_ws()


class BallerinaLLMStream(llm.LLMStream):
    def __init__(
        self,
        llm: BallerinaLLM,
        *,
        chat_ctx: ChatContext,
        tools: list[llm.Tool],
        conn_options: APIConnectOptions,
    ) -> None:
        super().__init__(llm, chat_ctx=chat_ctx, tools=tools, conn_options=conn_options)
        self._ballerina = llm

    def _latest_user_text(self) -> str | None:
        for msg in reversed(self._chat_ctx.messages()):
            if msg.role == "user":
                return (msg.text_content or "").strip() or None
        return None

    async def _run(self) -> None:
        user_text = self._latest_user_text()
        if not user_text:
            return

        ws = await self._ballerina._acquire_ws()
        response_complete = False

        try:
            await ws.send(user_text)
            message_id = utils.shortuuid("bal_")

            # Phase 1: receive full response from Ballerina
            full_content = ""
            while True:
                raw = await ws.recv()
                if not isinstance(raw, str):
                    continue
                if raw == "END":
                    break
                if raw.startswith("ERROR:"):
                    await self._ballerina._reset_ws()
                    raise APIConnectionError(raw[len("ERROR:"):])
                full_content += raw

            response_complete = True

            # Publish full text to UI immediately — before TTS starts
            if self._ballerina._on_response and full_content:
                self._ballerina._on_response(full_content)

            # Phase 2: split into sentences, load queue, emit one chunk per sentence
            queue: asyncio.Queue[str] = asyncio.Queue()
            for sentence in _split_sentences(full_content):
                queue.put_nowait(sentence)
            # fallback: if regex found no boundaries, emit the whole response
            if queue.empty() and full_content.strip():
                queue.put_nowait(full_content.strip())

            while not queue.empty():
                sentence = queue.get_nowait()
                self._event_ch.send_nowait(
                    llm.ChatChunk(
                        id=message_id,
                        delta=llm.ChoiceDelta(role="assistant", content=sentence + " "),
                    )
                )
                await asyncio.sleep(0)  # yield so AgentSession can start TTS on this sentence

        except asyncio.CancelledError:
            if not response_complete:
                await self._ballerina._reset_ws()
            raise
        except (websockets.ConnectionClosed, OSError) as e:
            await self._ballerina._reset_ws()
            raise APIConnectionError(f"Ballerina WebSocket error: {e}") from e
