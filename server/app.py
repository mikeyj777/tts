from flask import Flask, jsonify, request
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


@app.route("/")
def home():
    return jsonify({"message": "This is the Text to Speech API."})

if __name__ == '__main__':
    app.run("0.0.0.0", debug=True)
