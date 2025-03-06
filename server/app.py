from flask import Flask, jsonify, request, Response
from flask_cors import CORS

from controllers.tts_controller import text_to_speech, stream_text_to_speech, get_available_voices

import logging

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')


app = Flask(__name__)
CORS(app, resources={
    r"/*": {  # This specifically matches your API routes
        "origins": ["http://localhost:3000", "http://tts.riskspace.net"],
        "methods": ["GET", "POST", "OPTIONS"],  # Explicitly allow methods
        "allow_headers": ["Content-Type"]  # Allow common headers
    }
})

@app.route('/api/tts', methods=['POST'])
def tts_route():
    return text_to_speech()

@app.route('/api/tts/stream', methods=['POST'])
def tts_stream_route():
    return stream_text_to_speech()

@app.route('/api/tts/voices', methods=['GET'])
def voices_route():
    return get_available_voices()

@app.route('/api/test-audio', methods=['GET'])
def test_audio_route():
    """Test endpoint that returns a static audio file"""
    import io
    
    try:
        # Create a simple WAV file with a beep sound
        buffer = io.BytesIO()
        
        # Simple WAV header + sine wave data (pre-generated)
        wav_data = bytes.fromhex(
            '52494646'  # 'RIFF'
            '24050000'  # File size - 8
            '57415645'  # 'WAVE'
            '666D7420'  # 'fmt '
            '10000000'  # Chunk size (16)
            '0100'      # Format code (PCM)
            '0100'      # Channels (1)
            '44AC0000'  # Sample rate (44100)
            '88580100'  # Byte rate (176400)
            '0200'      # Block align (2)
            '1000'      # Bits per sample (16)
            '64617461'  # 'data'
            '00050000'  # Data size
        )
        
        # Add some simple sine wave data (pre-calculated)
        # This creates a short beep
        for i in range(1000):  # 1000 samples of a simple sine wave
            val = int(32767 * 0.5 * (i % 20 < 10)) # Simple square wave
            wav_data += val.to_bytes(2, byteorder='little', signed=True)
        
        buffer.write(wav_data)
        buffer.seek(0)
        
        print("Serving test audio - buffer size:", len(buffer.getvalue()))
        return Response(
            buffer.getvalue(),
            mimetype="audio/wav",
            headers={
                "Content-Disposition": "attachment;filename=test.wav",
                "Cache-Control": "no-cache"
            }
        )
    except Exception as e:
        print(f"Test audio error: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route("/")
def home():
    return jsonify({"message": "This is the Text to Speech API."})

if __name__ == '__main__':
    app.run("0.0.0.0", port=5000, debug=True)
