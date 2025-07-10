from flask import Flask, render_template, request
import base64
import mimetypes
from google import genai
from google.genai import types

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def index():
    """Home page with input form and results"""
    results = None
    
    if request.method == 'POST':
        profession = request.form.get('profession', '')
        user_prompt = request.form.get('prompt', '')
        
        if profession and user_prompt:
            client = genai.Client(
                api_key="AIzaSyC7v8z0ccrX6wBTwG3H1LhZTxui9q8P4Wg",
            )
            
            model = "gemini-2.0-flash-preview-image-generation"
            contents = [
                types.Content(
                    role="user",
                    parts=[
                        types.Part.from_text(text=f"""
                        Profession: {profession}
                        Prompt: {user_prompt}
                        Generate:
                        - 10 Titles
                        - A good description
                        - 10 Hashtags
                        - An image
                        """),
                    ],
                ),
            ]
            generate_content_config = types.GenerateContentConfig(
                response_modalities=["IMAGE", "TEXT"],
                response_mime_type="text/plain",
            )

            # Variables to store generated content
            titles = []
            description = ""
            hashtags = []
            image_data_url = ""
            current_section = None
            
            # Process the stream response
            for chunk in client.models.generate_content_stream(
                model=model,
                contents=contents,
                config=generate_content_config,
            ):
                if (
                    chunk.candidates is None
                    or chunk.candidates[0].content is None
                    or chunk.candidates[0].content.parts is None
                ):
                    continue
                
                # Handle image data
                if chunk.candidates[0].content.parts[0].inline_data and chunk.candidates[0].content.parts[0].inline_data.data:
                    inline_data = chunk.candidates[0].content.parts[0].inline_data
                    data_buffer = inline_data.data
                    mime_type = inline_data.mime_type
                    
                    # Convert binary data to base64 data URL
                    base64_data = base64.b64encode(data_buffer).decode('utf-8')
                    image_data_url = f"data:{mime_type};base64,{base64_data}"
                
                # Handle text data
                elif chunk.text:
                    text = chunk.text.strip()
                    
                    # Identify sections and process content
                    if "Titles:" in text or "Title:" in text:
                        current_section = "titles"
                        title_content = text.split("Titles:" if "Titles:" in text else "Title:")[-1].strip()
                        for line in title_content.split("\n"):
                            line = line.strip()
                            if line and (line[0].isdigit() or line[0] == '-' or line[0] == '*'):
                                titles.append(line.lstrip('0123456789-*. ').strip())
                    
                    elif "Description:" in text:
                        current_section = "description"
                        description = text.split("Description:")[-1].strip()
                    
                    elif "Hashtags:" in text:
                        current_section = "hashtags"
                        tags_section = text.split("Hashtags:")[-1].strip()
                        for tag in tags_section.split():
                            tag = tag.strip()
                            if tag.startswith('#'):
                                hashtags.append(tag)
                            elif tag:
                                hashtags.append(f"#{tag}")
                    
                    # Continue adding content based on the current section
                    elif current_section == "titles" and text:
                        for line in text.split("\n"):
                            line = line.strip()
                            if line and (line[0].isdigit() or line[0] == '-' or line[0] == '*'):
                                titles.append(line.lstrip('0123456789-*. ').strip())
                    
                    elif current_section == "description" and text:
                        description += " " + text
                    
                    elif current_section == "hashtags" and text:
                        for tag in text.split():
                            tag = tag.strip()
                            if tag.startswith('#'):
                                hashtags.append(tag)
                            elif tag:
                                hashtags.append(f"#{tag}")
            
            # Ensure we have at most 10 titles and hashtags
            titles = titles[:10]
            hashtags = hashtags[:10]
            
            results = {
                'profession': profession,
                'prompt': user_prompt,
                'titles': titles,
                'description': description,
                'hashtags': hashtags,
                'image_data_url': image_data_url
            }
    
    return render_template('index.html', results=results)

if __name__ == "__main__":
    app.run(debug=True)
