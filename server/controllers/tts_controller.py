import asyncio
import io
import edge_tts
from flask import Response, request, jsonify

async def generate_speech(text, voice="en-US-AriaNeural"):
    """Generate speech using Edge TTS and yield data for streaming."""
    communicate = edge_tts.Communicate(text, voice)
    
    # Create a BytesIO buffer to collect audio data
    audio_buffer = io.BytesIO()
    
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            # Write audio chunk to buffer
            audio_buffer.write(chunk["data"])
    
    # Reset buffer position to beginning
    audio_buffer.seek(0)
    return audio_buffer

async def stream_speech(text, voice="en-US-AriaNeural"):
    """Stream speech directly chunk by chunk."""
    communicate = edge_tts.Communicate(text, voice)
    
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            yield chunk["data"]

def get_available_voices():
    """Get list of available voices from Edge TTS."""
    try:
        voices = asyncio.run(edge_tts.list_voices())
        return jsonify({"voices": voices})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def text_to_speech():
    """Convert text to speech and return audio file."""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        voice = data.get('voice', 'en-US-AriaNeural')
        
        # Check if text is empty
        if not text.strip():
            return jsonify({"error": "Empty text provided"}), 400
        
        # Get the audio buffer
        audio_buffer = asyncio.run(generate_speech(text, voice))
        
        # Return the audio as a response
        return Response(
            audio_buffer.read(),
            mimetype="audio/mp3",
            headers={
                "Content-Disposition": "attachment;filename=speech.mp3"
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def stream_text_to_speech():
    """Stream text to speech directly to client."""
    try:
        data = request.get_json()
        
        if not data or 'text' not in data:
            return jsonify({"error": "No text provided"}), 400
        
        text = data['text']
        voice = data.get('voice', 'en-US-AriaNeural')
        
        # Check if text is empty
        if not text.strip():
            return jsonify({"error": "Empty text provided"}), 400
        
        def generate():
            # Run the async stream function in a way that Flask can handle
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            async_gen = stream_speech(text, voice)
            
            try:
                while True:
                    chunk = loop.run_until_complete(async_gen.__anext__())
                    yield chunk
            except StopAsyncIteration:
                pass
            finally:
                loop.close()
        
        return Response(
            generate(),
            mimetype="audio/mp3",
            headers={
                "Content-Disposition": "attachment;filename=speech.mp3"
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500
