# Nia backend — aligned speech

The Android app can now play audio **synchronized to actual playback position** if the gateway implements `/v1/speech`. This server is a complete optional implementation with Groq chat and Azure Speech synthesis and viseme events.

## Configuration

In a Node.js 20+ host, from `server/`, run `npm install` then `npm start`. Set secret environment variables **on the server**, not in Android:
- `NIA_GATEWAY_TOKEN` — unique private access token shared with the user’s Nia gateway settings
- `GROQ_API_KEY` — private GroqCloud key
- `AZURE_SPEECH_KEY` and `AZURE_SPEECH_REGION` — Azure speech credentials
- `AZURE_SPEECH_VOICE` — optional voice identifier, default `en-US-JennyNeural`
- `PORT` — server listening port, default 8080

Deploy behind HTTPS (TLS terminator) before connecting Nia’s phone.
Never commit live credentials to GitHub. Audio is kept in server memory for 120 seconds then expires and must be fetched with the same access token. No audio is stored to disk by the gateway.

Endpoints: `POST /v1/transcribe`, `GET /health`, `POST /v1/chat`, `POST /v1/speech` and `GET /v1/speech/audio/{id}` (authenticated).

Azure's `visemeReceived` provides offsets measured from the **same synthesized speech recording**. The server maps Azure's 22 viseme IDs into the Nia rig's limited blendshape set. Android uses audio playback `currentTime`, not a guessed wall-clock start, so pauses and buffering do not run the face ahead of the audio.

This is an *implementation*, not evidence of deployed or live-connected service. Set up provider keys and a host and complete Android audiovisual QA to approve. The character still needs a realistic approved face mesh and body textures.

## Recorded voice input

Enable the gateway connection in Android settings, then record a voice message.
`POST /v1/transcribe` accepts one `file` part in a multipart request with the gateway client bearer token. The gateway forwards only that file to Groq using its server-side key and fixed Whisper model. Accepted formats: M4A/MP4, MP3, WAV and WebM. The entire upload is limited to 10 MB and 30 seconds; the provider request is limited to 55 seconds.

The transcript becomes a draft for review, appending to any existing text. It is never automatically sent to chat. Changing settings during recording does not redirect the upload; backgrounding cancels transcription and discards late results. `/health` reports `transcription_ready` separately from Azure synthesis readiness.

This implementation requires gateway deployment and a real Android microphone/upload test before live voice input is verified. Automated provider tests use controlled responses and do not prove recognition accuracy or live credentials.
