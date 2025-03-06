import asyncio
import io
import re
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

def chunk_text_by_sentences(text, max_length=3000):
    """Split text into chunks by sentences, respecting the max length."""
    # First try to split by paragraph breaks
    paragraphs = re.split(r'\n\s*\n', text)
    
    chunks = []
    current_chunk = ""
    
    for paragraph in paragraphs:
        # If this paragraph alone exceeds max length, split by sentences
        if len(paragraph) > max_length:
            sentences = re.split(r'(?<=[.!?])\s+', paragraph)
            
            for sentence in sentences:
                # If this sentence alone exceeds max length, split by comma
                if len(sentence) > max_length:
                    comma_parts = re.split(r'(?<=,)\s+', sentence)
                    
                    for part in comma_parts:
                        # If still too long, just chunk by character count
                        if len(part) > max_length:
                            for i in range(0, len(part), max_length):
                                chunks.append(part[i:i+max_length])
                        else:
                            # Check if adding to current chunk exceeds max length
                            if len(current_chunk) + len(part) > max_length and current_chunk:
                                chunks.append(current_chunk)
                                current_chunk = part
                            else:
                                if current_chunk:
                                    current_chunk += ", " + part
                                else:
                                    current_chunk = part
                else:
                    # Check if adding to current chunk exceeds max length
                    if len(current_chunk) + len(sentence) > max_length and current_chunk:
                        chunks.append(current_chunk)
                        current_chunk = sentence
                    else:
                        if current_chunk:
                            current_chunk += ". " + sentence
                        else:
                            current_chunk = sentence
        else:
            # Check if adding to current chunk exceeds max length
            if len(current_chunk) + len(paragraph) > max_length and current_chunk:
                chunks.append(current_chunk)
                current_chunk = paragraph
            else:
                if current_chunk:
                    current_chunk += "\n\n" + paragraph
                else:
                    current_chunk = paragraph
    
    # Add the last chunk if not empty
    if current_chunk:
        chunks.append(current_chunk)
    
    return chunks

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
        
        # Check text length and chunk if necessary
        MAX_CHUNK_LENGTH = 3000  # Characters - Edge TTS works well with chunks this size
        
        if len(text) > MAX_CHUNK_LENGTH:
            # Split by sentences to avoid cutting words
            chunks = chunk_text_by_sentences(text, MAX_CHUNK_LENGTH)
            
            # Create a combined audio buffer
            combined_buffer = io.BytesIO()
            
            for chunk in chunks:
                # Generate speech for each chunk
                chunk_buffer = asyncio.run(generate_speech(chunk, voice))
                combined_buffer.write(chunk_buffer.read())
            
            # Reset buffer position
            combined_buffer.seek(0)
            audio_buffer = combined_buffer
        else:
            # Process as before for small texts
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
        
        # Check text length and chunk if necessary
        MAX_CHUNK_LENGTH = 3000  # Characters
        
        def generate():
            if len(text) > MAX_CHUNK_LENGTH:
                # Split by sentences to avoid cutting words
                chunks = chunk_text_by_sentences(text, MAX_CHUNK_LENGTH)
                
                for chunk in chunks:
                    # Run the async stream function in a way that Flask can handle
                    loop = asyncio.new_event_loop()
                    asyncio.set_event_loop(loop)
                    async_gen = stream_speech(chunk, voice)
                    
                    try:
                        while True:
                            chunk_data = loop.run_until_complete(async_gen.__anext__())
                            yield chunk_data
                    except StopAsyncIteration:
                        pass
                    finally:
                        loop.close()
            else:
                # For smaller text, process as before
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
