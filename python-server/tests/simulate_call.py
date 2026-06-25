import asyncio
import os
import wave
import sys
import json
from livekit import rtc, api
from dotenv import load_dotenv
import aiohttp

_HERE = os.path.dirname(__file__)
# Load the voice-agent's .env (one level up from tests/) regardless of CWD
load_dotenv(os.path.join(_HERE, os.pardir, ".env"))

LIVEKIT_URL = os.getenv("LIVEKIT_URL")
LIVEKIT_API_KEY = os.getenv("LIVEKIT_API_KEY")
LIVEKIT_API_SECRET = os.getenv("LIVEKIT_API_SECRET")
ROOM_NAME = "voice-room"
# 16kHz mono WAV fixture, resolved relative to this file so it works from any CWD
AUDIO_FILE = os.path.join(_HERE, "fixtures", "testvoice.wav")


async def get_token():
    # Use a unique ID for each simulation run to help coordinate dispatch
    simulation_id = f"sim_{os.urandom(4).hex()}"
    token = (
        api.AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
        .with_identity(simulation_id)
        .with_name("simulation-user")
        .with_grants(
            api.VideoGrants(
                room_join=True,
                room=ROOM_NAME,
                can_publish=True,
                can_subscribe=True,
                can_publish_data=True,
            )
        )
    )

    lkapi = api.LiveKitAPI(
        url=LIVEKIT_URL,
        api_key=LIVEKIT_API_KEY,
        api_secret=LIVEKIT_API_SECRET,
    )
    try:
        # Check if an agent is actually in the room as a participant
        try:
            participants = await lkapi.room.list_participants(api.ListParticipantsRequest(room=ROOM_NAME))
            agent_in_room = any("agent" in p.identity.lower() for p in participants.participants)
        except Exception as e:
            if "not_found" in str(e).lower() or "not found" in str(e).lower():
                print(f"Room '{ROOM_NAME}' does not exist yet. Proceeding with dispatch.")
                agent_in_room = False
            else:
                raise e

        if not agent_in_room:
            # We only dispatch if the room is empty of agents
            await lkapi.agent_dispatch.create_dispatch(
                api.CreateAgentDispatchRequest(room=ROOM_NAME, agent_name="voice-agent")
            )
            print(f"Dispatched agent to room: {ROOM_NAME}")
        else:
            print(f"Agent already present in room: {ROOM_NAME}. Skipping dispatch.")
    except Exception as e:
        print(f"Agent dispatch warning: {e}")
    finally:
        await lkapi.aclose()

    return token.to_jwt(), LIVEKIT_URL, simulation_id


async def main():
    if not os.path.exists(AUDIO_FILE):
        print(f"Error: Please place a valid '{AUDIO_FILE}' file in this directory.")
        return

    print(f"Generating token and agent dispatch for room '{ROOM_NAME}'...")
    token, url, my_id = await get_token()
    if not token:
        print("Could not obtain token. Is the Python server running (make p)?")
        return

    room = rtc.Room()
    
    @room.on("connected")
    def on_connected():
        print("[LiveKit Event] Connected to signaling channel.")

    @room.on("disconnected")
    def on_disconnected():
        print("[LiveKit Event] Disconnected from room.")

    @room.on("participant_connected")
    def on_p_connected(participant):
        print(f"Participant connected: {participant.identity}")

    @room.on("data_received")
    def on_data_received(data_packet: rtc.DataPacket):
        if data_packet.topic == "lk.transcription":
            try:
                # Transcriptions are often JSON strings sent as data
                payload = data_packet.data.decode("utf-8")
                # Clean labels if it's a JSON string
                if payload.startswith('{'):
                    data = json.loads(payload)
                    text = data.get('text', payload)
                    print(f"[Transcription] {text}")
                else:
                    print(f"[Transcription] {payload}")
            except Exception:
                pass

    print(f"Connecting to room '{ROOM_NAME}'...")
    
    try:
        await room.connect(url, token)
        print("Core signalling connected.")
    except Exception as e:
        print(f"Connection failed: {e}")
        return

    # 1. Initialize audio source matching your file parameters (16000Hz, Mono)
    source = rtc.AudioSource(sample_rate=16000, num_channels=1)
    track = rtc.LocalAudioTrack.create_audio_track("microphone", source)
  
    # 2. Publish track matching the behavior of a user activating their microphone
    options = rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE)
    publication = await room.local_participant.publish_track(track, options)
    print("Microphone track published dynamically.")

    # WAIT AND CHECK AGENT PRESENCE
    wait_time = 15
    print(f"Joined room. Waiting up to {wait_time} seconds for agent to connect...")
    
    agent_found = False
    for i in range(wait_time):
        # Check remote participants
        for p in room.remote_participants.values():
            if "voice-agent" in p.identity.lower() or "agent" in p.identity.lower():
                print(f"Found agent: {p.identity}")
                agent_found = True
                break
        if agent_found:
            # Wait a small bit for agent to be fully ready to hear
            await asyncio.sleep(1)
            break
        await asyncio.sleep(1)

    if not agent_found:
        print(f"Agent not detected yet. Current Participants: {[p.identity for p in room.remote_participants.values()]}")
        print("Proceeding with audio playback anyway...")

    # 3. Speak: replay the clip several times to simulate a multi-turn
    # conversation and soak-test the pipeline (7 turns, 20s apart).
    num_plays = 7
    play_interval = 20



    for play_idx in range(num_plays):
        print(f"Starting audio stream (Play {play_idx + 1}/{num_plays}): Playing file...")
        
        with wave.open(AUDIO_FILE, "rb") as wf:
            # Check wave file properties
            n_channels = wf.getnchannels()
            samp_width = wf.getsampwidth()
            framerate = wf.getframerate()
            print(f"Audio info: {n_channels} channels, {samp_width} bytes/sample, {framerate}Hz")

            chunk_samples = int(16000 * 0.02)  # 20ms frame blocks = 320 samples
            
            while True:
                data = wf.readframes(chunk_samples)
                if not data:
                    print(f"Audio track (Play {play_idx + 1}/{num_plays}) completed streaming.")
                    break
                
                # For 16-bit mono, 2 bytes per sample
                actual_samples = len(data) // 2
                if actual_samples == 0:
                    continue

                frame = rtc.AudioFrame(data, sample_rate=16000, num_channels=1, samples_per_channel=actual_samples)
                await source.capture_frame(frame)

                # Sleep one frame's worth (20ms) so audio is sent at real-time
                # speed rather than dumped all at once, mimicking a live mic.
                await asyncio.sleep(0.02)
        
        if play_idx < num_plays - 1:
            print(f"Waiting {play_interval}s before next playback...")
            await asyncio.sleep(play_interval)

    # 4. Linger after the last clip so any in-flight TTS response is received
    # before we disconnect, then auto-exit.
    exit_delay = 30
    print(f"\nAudio finished. Staying in room for {exit_delay}s to hear response...")
    
    try:
        await asyncio.sleep(exit_delay)
        print(f"{exit_delay}s elapsed. Exiting automatically...")
    except asyncio.CancelledError:
        print("Leaving session...")
    finally:
        await room.disconnect()
        print("Offline.")

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nSimulation aborted.")
        sys.exit(0)
