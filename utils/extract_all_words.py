import json
import sys
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

def extract_words(json_filepath):
    try:
        with open(json_filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        # Handle cases where the JSON is a list of objects or a single object
        if isinstance(data, list):
            words = [item["word"] for item in data if "word" in item]
        elif isinstance(data, dict):
            # If the top level is an object containing a list, or just a single word object
            if "word" in data:
                words = [data["word"]]
            else:
                # Attempt to find any lists of objects inside
                words = []
                for value in data.values():
                    if isinstance(value, list):
                        words.extend([item["word"] for item in value if isinstance(item, dict) and "word" in item])
        else:
            words = []
            
        return ", ".join(words)
    except Exception as e:
        print(f"Error reading or parsing JSON file: {e}")
        sys.exit(1)

def start_http_server(text, port=4010):
    class TextHandler(BaseHTTPRequestHandler):
        def do_GET(self):
            self.send_response(200)
            self.send_header("Content-type", "text/plain; charset=utf-8")
            # Allow browser access
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(text.encode('utf-8'))

        def log_message(self, format, *args):
            # Suppress default logging to keep console clean
            return

    server_address = ('', port)
    httpd = HTTPServer(server_address, TextHandler)
    print(f"Temporary server running at: http://localhost:{port}")
    print("Open this link in your browser to copy the words. Press Ctrl+C to stop the server.")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")

def main():
    if len(sys.argv) < 2:
        print("Usage: py script.py <path_to_json_file>")
        sys.exit(1)

    json_path = sys.argv[1]
    if not os.path.exists(json_path):
        print(f"Error: File '{json_path}' not found.")
        sys.exit(1)

    result_text = extract_words(json_path)
    
    if not result_text:
        print("No words found in the provided JSON file.")
        sys.exit(0)

    print("Extracted words:")
    print(result_text)
    print("-" * 40)

    start_http_server(result_text)

if __name__ == "__main__":
    main()