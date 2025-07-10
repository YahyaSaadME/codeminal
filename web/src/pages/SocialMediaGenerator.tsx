import { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Download, Copy, CheckCircle, AlertTriangle } from 'lucide-react';
import { Alert } from "flowbite-react";

// Social Media Generator Component
function SocialMediaGenerator() {
  const [prompt, setPrompt] = useState('');
  const [profession, setProfession] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedContent, setGeneratedContent] = useState<{
    titles: string[];
    description: string;
    hashtags: string[];
    imageUrl: string;
  } | null>(null);
  
  const [copied, setCopied] = useState<{
    title: number | null;
    description: boolean;
    hashtags: boolean;
  }>({
    title: null,
    description: false,
    hashtags: false
  });

  const generatedContentRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string, type: 'title' | 'description' | 'hashtags', index?: number) => {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'title') {
        setCopied(prev => ({ ...prev, title: index || null }));
      } else if (type === 'description') {
        setCopied(prev => ({ ...prev, description: true }));
      } else if (type === 'hashtags') {
        setCopied(prev => ({ ...prev, hashtags: true }));
      }
      
      setTimeout(() => {
        if (type === 'title') {
          setCopied(prev => ({ ...prev, title: null }));
        } else if (type === 'description') {
          setCopied(prev => ({ ...prev, description: false }));
        } else if (type === 'hashtags') {
          setCopied(prev => ({ ...prev, hashtags: false }));
        }
      }, 2000);
    });
  };

  const downloadImage = () => {
    if (!generatedContent?.imageUrl) return;
    
    const link = document.createElement('a');
    link.href = generatedContent.imageUrl;
    link.download = `social-media-image-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || !profession.trim()) return;

    setLoading(true);
    setError('');
    setGeneratedContent(null);
    
    try {
      const ai = new GoogleGenAI({apiKey: "AIzaSyBMmQS3EeBkeD6vIs0IksNqBjytHIBs62E"});
      
      const formattedPrompt = `
        You are a professional content creator for ${profession}.
        
        IMPORTANT REQUIREMENTS:
        1. Create social media content ONLY about: ${prompt}
        2. The content MUST be relevant to both the profession "${profession}" and the topic "${prompt}"
        3. You MUST generate a high-quality image that represents this content
        4. Include text overlay on the image that's suitable for social media
        
        If the prompt is not relevant to social media content creation or the profession, respond with: "IRRELEVANT_CONTENT"
        
        Otherwise, format your response EXACTLY as this JSON structure (no additional text before or after):
        {
          "titles": ["Title 1", "Title 2", "Title 3", "Title 4", "Title 5", "Title 6", "Title 7", "Title 8", "Title 9", "Title 10"],
          "description": "A compelling description here that relates to both ${profession} and ${prompt}",
          "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5", "#tag6", "#tag7", "#tag8", "#tag9", "#tag10"]
        }
        
        Rules:
        - Provide exactly 10 titles
        - Provide exactly 1 description (2-3 sentences)
        - Provide exactly 10 hashtags with # symbol
        - All content must be relevant to ${profession} and ${prompt}
        - Generate a professional social media image with text overlay
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: formattedPrompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          responseMimeType: "text/plain",
        }
      });
      
      if (response.text) {
        const text = response.text.trim();
        
        if (text.includes("IRRELEVANT_CONTENT")) {
          setError("The provided content is not relevant for social media creation. Please provide a topic that relates to your profession and social media content.");
          return;
        }
        
        let titles: string[] = [];
        let description = "";
        let hashtags: string[] = [];
        let imageUrl = "";
        
        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType) {
              if(part.inlineData.mimeType.startsWith('image/')) {
                imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
              }
            }
          }
        }
        
        if (!imageUrl) {
          setError("Failed to generate image. Please try again with a more specific prompt.");
          return;
        }
        
        try {
          let jsonText = text;
          jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '');
          const startIndex = jsonText.indexOf('{');
          const lastIndex = jsonText.lastIndexOf('}');
          
          if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
            jsonText = jsonText.substring(startIndex, lastIndex + 1);
          }
          
          const jsonContent = JSON.parse(jsonText);
          
          if (!jsonContent.titles || !Array.isArray(jsonContent.titles) || jsonContent.titles.length === 0) {
            throw new Error("Invalid or missing titles in response");
          }
          
          if (!jsonContent.description || typeof jsonContent.description !== 'string') {
            throw new Error("Invalid or missing description in response");
          }
          
          if (!jsonContent.hashtags || !Array.isArray(jsonContent.hashtags) || jsonContent.hashtags.length === 0) {
            throw new Error("Invalid or missing hashtags in response");
          }
          
          titles = jsonContent.titles.slice(0, 10);
          description = jsonContent.description;
          hashtags = jsonContent.hashtags
            .map((tag: string) => tag.startsWith('#') ? tag : `#${tag}`)
            .slice(0, 10);
            
        } catch (parseError) {
          console.error("Error parsing JSON response:", parseError);
          
          try {
            const titleMatches = text.match(/"titles":\s*\[(.*?)\]/s);
            if (titleMatches) {
              const titleArray = titleMatches[1].match(/"([^"]+)"/g);
              if (titleArray) {
                titles = titleArray.map(t => t.replace(/"/g, '')).slice(0, 10);
              }
            }
            
            const descMatches = text.match(/"description":\s*"([^"]+)"/);
            if (descMatches) {
              description = descMatches[1];
            }
            
            const hashtagMatches = text.match(/"hashtags":\s*\[(.*?)\]/s);
            if (hashtagMatches) {
              const hashtagArray = hashtagMatches[1].match(/"([^"]+)"/g);
              if (hashtagArray) {
                hashtags = hashtagArray
                  .map(h => h.replace(/"/g, ''))
                  .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
                  .slice(0, 10);
              }
            }
            
            if (titles.length === 0 || !description || hashtags.length === 0) {
              throw new Error("Failed to extract content from response");
            }
          } catch (fallbackError) {
            setError("Failed to parse AI response. The content may not be in the expected format. Please try again.");
            return;
          }
        }
        
        setGeneratedContent({
          titles: titles.slice(0, 10),
          description,
          hashtags: hashtags.slice(0, 10),
          imageUrl
        });
        
        setTimeout(() => {
          generatedContentRef.current?.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          });
        }, 100);
      } else {
        setError('No response received from AI. Please try again.');
      }
    } catch (err) {
      console.error('Error calling Gemini API:', err);
      setError('Failed to get response from AI. Please check your internet connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex w-full max-w-6xl flex-col items-center justify-center gap-12">
      <div className="relative flex flex-col items-center gap-6">
        <h1 className="relative text-center text-4xl leading-[125%] font-bold text-gray-900 dark:text-white">
          Social Media Content Generator
        </h1>
        <p className="text-center text-xl text-gray-600 dark:text-gray-300">
          Create engaging social media content with AI assistance
        </p>
      </div>
      
      <div className="relative flex w-full flex-col items-center gap-6">
        <div className="w-full max-w-2xl space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Profession</label>
            <input
              type="text"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              placeholder="Enter profession (e.g., Photographer, Chef, Marketing Expert)"
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Prompt</label>
            <textarea
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
              rows={4}
              placeholder="Describe what you want to create a social media post about..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>
        </div>
        
        <div className="text-center mb-6">
          <button
            className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 transition-colors"
            onClick={handleSubmit}
            disabled={loading || !prompt.trim() || !profession.trim()}
          >
            {loading ? 'Generating Content...' : 'Generate Social Media Content'}
          </button>
        </div>
      </div>
      
      {error && (
        <div className="w-full max-w-2xl">
          <Alert color="failure" icon={AlertTriangle}>
            <span className="font-medium">Error!</span> {error}
          </Alert>
        </div>
      )}
      
      {generatedContent && (
        <div ref={generatedContentRef} className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-8 shadow-sm transition-colors">
          <div className="text-center mb-6">
            <h2 className="text-3xl font-semibold text-gray-800 dark:text-gray-100">Generated Content</h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Your AI-generated social media content is ready!</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {generatedContent.imageUrl && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Generated Image</h3>
                  <button 
                    onClick={downloadImage}
                    className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
                    title="Download image"
                  >
                    <Download size={20} />
                  </button>
                </div>
                <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden">
                  <img 
                    src={generatedContent.imageUrl} 
                    alt="Generated content" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            )}
            {generatedContent.titles.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-medium mb-3 text-gray-800 dark:text-gray-100">Titles</h3>
                <ul className="space-y-2">
                  {generatedContent.titles.map((title, index) => (
                    <li key={index} className="flex items-start justify-between group border-b border-gray-100 dark:border-gray-700 pb-1">
                      <span className="mr-2 text-gray-700 dark:text-gray-300">{index + 1}. {title}</span>
                      <button
                        onClick={() => copyToClipboard(title, 'title', index)}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors opacity-0 group-hover:opacity-100"
                        title="Copy title"
                      >
                        {copied.title === index ? <CheckCircle size={18} className="text-green-500" /> : <Copy size={18} />}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {generatedContent.description && (
              <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Description</h3>
                  <button
                    onClick={() => copyToClipboard(generatedContent.description, 'description')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Copy description"
                  >
                    {copied.description ? 
                      <CheckCircle size={18} className="text-green-500" /> : 
                      <Copy size={18} />
                    }
                  </button>
                </div>
                <p className="text-gray-700 dark:text-gray-300">{generatedContent.description}</p>
              </div>
            )}
            {generatedContent.hashtags.length > 0 && (
              <div className="bg-gray-50 dark:bg-gray-750 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-medium text-gray-800 dark:text-gray-100">Hashtags</h3>
                  <button
                    onClick={() => copyToClipboard(generatedContent.hashtags.join(' '), 'hashtags')}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    title="Copy all hashtags"
                  >
                    {copied.hashtags ? 
                      <CheckCircle size={18} className="text-green-500" /> : 
                      <Copy size={18} />
                    }
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {generatedContent.hashtags.map((tag, index) => (
                    <span key={index} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md text-sm text-gray-800 dark:text-gray-200">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SocialMediaGenerator;