import React, { useState } from 'react'
import * as XLSX from 'xlsx'
import { GoogleGenAI } from '@google/genai'
import { jsPDF } from 'jspdf'
// import html2canvas from 'html2canvas' // Removed as it is unused
import { Download, AlertTriangle } from 'lucide-react'
import { Alert } from "flowbite-react"

interface ExcelData {
  [key: string]: any;
  type_of_post?: string;
  brand_name?: string;
  font_style?: string;
  content?: string;
  phone_number?: string;
  email_id?: string;
  prompt?: string;
  platform_type?: string;
}

interface GeneratedContent {
  titles: string[];
  description: string;
  hashtags: string[];
  imageUrl: string;
}

export default function ExcelExtractorGenerator() {
  const [excelData, setExcelData] = useState<ExcelData[]>([])
  const [fileName, setFileName] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [generatingContent, setGeneratingContent] = useState<boolean>(false)
  const [generationProgress, setGenerationProgress] = useState<number>(0)
  const [generatedContents, setGeneratedContents] = useState<(GeneratedContent | null)[]>([])
  const [error, setError] = useState<string>('')
  const contentRef = React.useRef<HTMLDivElement>(null)

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    
    if (!file) return

    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ]
    
    if (!validTypes.includes(file.type)) {
      alert('Please upload a valid Excel file (.xlsx or .xls)')
      return
    }

    setIsLoading(true)
    setFileName(file.name)
    setGeneratedContents([]) // Reset any previously generated content

    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        
        // Get first worksheet
        const worksheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[worksheetName]
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json<ExcelData>(worksheet)
        
        setExcelData(jsonData)
      } catch (error) {
        console.error('Error reading Excel file:', error)
        alert('Error reading Excel file. Please try again.')
      } finally {
        setIsLoading(false)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  const generateContentForRow = async (row: ExcelData, index: number) => {
    try {
      const ai = new GoogleGenAI({apiKey: "AIzaSyBMmQS3EeBkeD6vIs0IksNqBjytHIBs62E"})
      
      const profession = row.brand_name || 'Social Media Manager'
      const promptText = row.prompt || row.content || 'Create engaging social media content'
      const platformType = row.platform_type || 'General social media'
      const postType = row.type_of_post || 'Standard post'
      const fontStyle = row.font_style || 'Professional'
      
      // Define image style based on platform type
      const imageStyleMap: {[key: string]: string} = {
        'instagram': 'square format with vibrant colors and lifestyle focus',
        'facebook': 'engaging with clear focal point and moderate text overlay',
        'twitter': 'clear and sharp with minimal text overlay',
        'linkedin': 'professional looking with business-appropriate imagery and clean text layout',
        'pinterest': 'vertical format with inspirational style and clear typography',
        'tiktok': 'dynamic and trendy with bold text elements',
        'youtube': 'high contrast thumbnail style with prominent text',
      }
      
      // Get image style based on platform or default to generic style
      const platformLower = platformType.toLowerCase()
      const imageStyle = Object.keys(imageStyleMap).find(key => platformLower.includes(key)) 
        ? imageStyleMap[Object.keys(imageStyleMap).find(key => platformLower.includes(key)) as string]
        : 'balanced composition with appropriate text overlay'
      
      // Define font style characteristics
      const fontStyleMap: {[key: string]: string} = {
        'professional': 'clean sans-serif fonts like Arial or Helvetica with professional color scheme',
        'casual': 'friendly rounded fonts with vibrant colors',
        'elegant': 'serif fonts like Georgia or Garamond with sophisticated color palette',
        'bold': 'heavy weight fonts with high contrast colors',
        'minimalist': 'thin, simple fonts with plenty of white space',
        'creative': 'unique stylized fonts with artistic color combinations',
        'vintage': 'retro-style typography with muted or aged color palette',
        'modern': 'contemporary geometric fonts with trendy color schemes',
      }
      
      // Get font characteristics based on specified style or default
      const fontLower = fontStyle.toLowerCase()
      const fontCharacteristics = Object.keys(fontStyleMap).find(key => fontLower.includes(key))
        ? fontStyleMap[Object.keys(fontStyleMap).find(key => fontLower.includes(key)) as string]
        : fontStyleMap['professional']
      
      const formattedPrompt = `
        You are a professional content creator for ${profession}.
        
        IMPORTANT REQUIREMENTS:
        1. Create ${platformType} content about: ${promptText}
        2. The content MUST be relevant to the brand "${profession}" 
        3. Use font style that matches: ${fontStyle}
        
        IMAGE GENERATION REQUIREMENTS (EXTREMELY IMPORTANT):
        1. Generate a HIGH-QUALITY ${imageStyle} image that PERFECTLY represents the content
        2. The image MUST include these elements:
           - Visual representation of the main subject: "${promptText}"
           - Brand name "${profession}" should be visible if appropriate
           - Color scheme and mood should match the ${postType} content type
           - Use ${fontCharacteristics} for any text elements
        3. Text overlay requirements:
           - Include a SHORT, IMPACTFUL headline (5 words max)
           - Text must be HIGHLY READABLE against the background (good contrast)
           - Position text in the most visually effective area (rule of thirds)
           - Text size should be appropriate for ${platformType} viewing
        4. The image should convey the main message even without reading the description
        5. Visual style should be cohesive with both the brand identity and content topic
        
        Format your response EXACTLY as this JSON structure (no additional text before or after):
        {
          "titles": ["Title 1", "Title 2", "Title 3"],
          "description": "A compelling description that relates to ${profession} and ${promptText}",
          "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
        }
        
        Rules:
        - Provide exactly 3 titles
        - Provide exactly 1 description (2-3 sentences)
        - Provide exactly 5 hashtags with # symbol
        - All content must be relevant to ${profession} and ${promptText}
        - Generate a professional ${platformType} image that FULLY incorporates all the image requirements above
      `
      
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: formattedPrompt,
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          responseMimeType: "text/plain",
        }
      })
      
      if (response.text) {
        const text = response.text.trim()
        
        let titles: string[] = []
        let description = ""
        let hashtags: string[] = []
        let imageUrl = ""
        
        if (response.candidates && response.candidates[0]?.content?.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.mimeType) {
              if(part.inlineData.mimeType.startsWith('image/')) {
                imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
              }
            }
          }
        }
        
        try {
          let jsonText = text
          jsonText = jsonText.replace(/```json\s*/g, '').replace(/```\s*/g, '')
          const startIndex = jsonText.indexOf('{')
          const lastIndex = jsonText.lastIndexOf('}')
          
          if (startIndex !== -1 && lastIndex !== -1 && lastIndex > startIndex) {
            jsonText = jsonText.substring(startIndex, lastIndex + 1)
          }
          
          const jsonContent = JSON.parse(jsonText)
          
          titles = jsonContent.titles || []
          description = jsonContent.description || ""
          hashtags = jsonContent.hashtags || []
            
        } catch (parseError) {
          console.error("Error parsing JSON response:", parseError)
          
          try {
            const titleMatches = text.match(/"titles":\s*\[(.*?)\]/s)
            if (titleMatches) {
              const titleArray = titleMatches[1].match(/"([^"]+)"/g)
              if (titleArray) {
                titles = titleArray.map(t => t.replace(/"/g, '')).slice(0, 3)
              }
            }
            
            const descMatches = text.match(/"description":\s*"([^"]+)"/);
            if (descMatches) {
              description = descMatches[1]
            }
            
            const hashtagMatches = text.match(/"hashtags":\s*\[(.*?)\]/s)
            if (hashtagMatches) {
              const hashtagArray = hashtagMatches[1].match(/"([^"]+)"/g)
              if (hashtagArray) {
                hashtags = hashtagArray
                  .map(h => h.replace(/"/g, ''))
                  .map(tag => tag.startsWith('#') ? tag : `#${tag}`)
                  .slice(0, 5)
              }
            }
          } catch (fallbackError) {
            console.error("Failed to extract content from response:", fallbackError)
          }
        }
        
        const generatedContent: GeneratedContent = {
          titles: titles.length > 0 ? titles : ["No title generated"],
          description: description || "No description generated",
          hashtags: hashtags.length > 0 ? hashtags : ["#nohashtags"],
          imageUrl: imageUrl
        }
        
        return generatedContent
      }
    } catch (err) {
      console.error(`Error generating content for row ${index}:`, err)
      return null
    }
    
    return null
  }
  
  const handleGenerateAll = async () => {
    if (excelData.length === 0) {
      setError("Please upload an Excel file first")
      return
    }
    
    setGeneratingContent(true)
    setGenerationProgress(0)
    setError('')
    
    const results: (GeneratedContent | null)[] = []
    
    for (let i = 0; i < excelData.length; i++) {
      const row = excelData[i]
      const content = await generateContentForRow(row, i)
      results.push(content)
      setGenerationProgress(Math.round(((i + 1) / excelData.length) * 100))
    }
    
    setGeneratedContents(results)
    setGeneratingContent(false)
  }
  
  const handleDownloadPDF = async () => {
    if (!contentRef.current || generatedContents.length === 0) return
    
    const pdf = new jsPDF('p', 'mm', 'a4')
    let currentPage = 1
    
    for (let i = 0; i < generatedContents.length; i++) {
      const content = generatedContents[i]
      if (!content) continue
      
      const rowData = excelData[i]
      
      // Add a new page for each content except the first one
      if (i > 0) {
        pdf.addPage()
        currentPage++
      }
      
      // Add brand name and platform type as title
      pdf.setFontSize(18)
      pdf.text(`${rowData.brand_name || 'Brand'} - ${rowData.platform_type || 'Social Media'}`, 14, 20)
      
      // Add content details
      pdf.setFontSize(12)
      pdf.text(`Type: ${rowData.type_of_post || 'N/A'}`, 14, 30)
      pdf.text(`Font Style: ${rowData.font_style || 'N/A'}`, 14, 36)
      
      // Add titles
      pdf.setFontSize(14)
      pdf.text('Titles:', 14, 46)
      content.titles.forEach((title, idx) => {
        pdf.setFontSize(12)
        pdf.text(`${idx + 1}. ${title}`, 20, 52 + idx * 6)
      })
      
      // Add description
      const yPos = 52 + content.titles.length * 6 + 4
      pdf.setFontSize(14)
      pdf.text('Description:', 14, yPos)
      pdf.setFontSize(12)
      
      // Handle multiline description
      const splitDescription = pdf.splitTextToSize(content.description, 180)
      pdf.text(splitDescription, 20, yPos + 6)
      
      // Add hashtags
      const hashtagYPos = yPos + 6 + splitDescription.length * 6 + 4
      pdf.setFontSize(14)
      pdf.text('Hashtags:', 14, hashtagYPos)
      pdf.setFontSize(12)
      pdf.text(content.hashtags.join(' '), 20, hashtagYPos + 6)
      
      // Add contact info
      const contactYPos = hashtagYPos + 16
      if (rowData.phone_number || rowData.email_id) {
        pdf.setFontSize(14)
        pdf.text('Contact Information:', 14, contactYPos)
        pdf.setFontSize(12)
        if (rowData.phone_number) {
          pdf.text(`Phone: ${rowData.phone_number}`, 20, contactYPos + 6)
        }
        if (rowData.email_id) {
          pdf.text(`Email: ${rowData.email_id}`, 20, contactYPos + (rowData.phone_number ? 12 : 6))
        }
      }
      
      // Add image if available
      if (content.imageUrl) {
        try {
          const imgData = content.imageUrl
          const imgWidth = 80
          const imgHeight = 60
          const imgX = 14
          const imgY = contactYPos + 20
          
          pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth, imgHeight)
        } catch (err) {
          console.error("Error adding image to PDF:", err)
        }
      }
      
      // Add page number
      pdf.setFontSize(10)
      pdf.text(`Page ${currentPage}`, pdf.internal.pageSize.getWidth() - 28, pdf.internal.pageSize.getHeight() - 10)
    }
    
    pdf.save(`social-media-content-${fileName || 'generated'}.pdf`)
  }

  const renderTable = () => {
    if (excelData.length === 0) return null

    const headers = Object.keys(excelData[0])

    return (
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-white">Excel Data Preview</h3>
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {headers.map((header, index) => (
                  <th key={index} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-left font-medium text-gray-700 dark:text-gray-300">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
              {excelData.map((row, rowIndex) => (
                <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  {headers.map((header, colIndex) => (
                    <td key={colIndex} className="px-4 py-2 text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {row[header]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Total rows: {excelData.length}
        </p>
      </div>
    )
  }

  const renderGeneratedContent = () => {
    if (generatedContents.length === 0) return null
    
    return (
      <div ref={contentRef} className="relative mt-12 mb-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Generated Social Media Content</h2>
          <button 
            onClick={handleDownloadPDF}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
          >
            <Download size={18} />
            Download All as PDF
          </button>
        </div>
        
        <div className="space-y-12">
          {generatedContents.map((content, index) => {
            if (!content) return null
            const rowData = excelData[index]
            
            return (
              <div key={index} className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm transition-colors">
                <div className="flex justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{rowData.brand_name || `Item ${index + 1}`}</h3>
                    <p className="text-gray-500 dark:text-gray-400">
                      {rowData.platform_type || 'Social Media'} • {rowData.type_of_post || 'Post'}
                    </p>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {content.imageUrl && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900 p-2">
                      <h4 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-100">Generated Image</h4>
                      <img 
                        src={content.imageUrl} 
                        alt={`Generated for ${rowData.brand_name || `Item ${index + 1}`}`}
                        className="w-full h-auto rounded-md"
                      />
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                      <h4 className="text-lg font-medium mb-3 text-gray-800 dark:text-gray-100">Titles</h4>
                      <ul className="list-disc pl-5 space-y-1">
                        {content.titles.map((title, idx) => (
                          <li key={idx} className="text-gray-800 dark:text-gray-200">{title}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                      <h4 className="text-lg font-medium mb-3 text-gray-800 dark:text-gray-100">Description</h4>
                      <p className="text-gray-800 dark:text-gray-200">{content.description}</p>
                    </div>
                    
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                      <h4 className="text-lg font-medium mb-3 text-gray-800 dark:text-gray-100">Hashtags</h4>
                      <div className="flex flex-wrap gap-2">
                        {content.hashtags.map((tag, idx) => (
                          <span key={idx} className="bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-sm text-gray-800 dark:text-gray-200">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                    
                    {(rowData.phone_number || rowData.email_id) && (
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md border border-gray-200 dark:border-gray-700">
                        <h4 className="text-lg font-medium mb-3 text-gray-800 dark:text-gray-100">Contact Information</h4>
                        {rowData.phone_number && <p className="text-gray-800 dark:text-gray-200">Phone: {rowData.phone_number}</p>}
                        {rowData.email_id && <p className="text-gray-800 dark:text-gray-200">Email: {rowData.email_id}</p>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="absolute z-[10] p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Excel Social Media Generator</h1>
      
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center bg-white/50 dark:bg-gray-800/50">
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileUpload}
          className="hidden"
          id="excel-upload"
        />
        <label
          htmlFor="excel-upload"
          className="cursor-pointer inline-flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
        >
          {isLoading ? 'Processing...' : 'Upload Excel File'}
        </label>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Supported formats: .xlsx, .xls
        </p>
        {fileName && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            Selected file: {fileName}
          </p>
        )}
      </div>

      {isLoading && (
        <div className="mt-4 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400"></div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Reading Excel file...</p>
        </div>
      )}
      
      {error && (
        <div className="mt-4">
          <Alert color="failure" icon={AlertTriangle}>
            <span className="font-medium">Error!</span> {error}
          </Alert>
        </div>
      )}

      {renderTable()}
      
      {excelData.length > 0 && !generatingContent && generatedContents.length === 0 && (
        <div className="mt-8 text-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            onClick={handleGenerateAll}
            className="px-6 py-3 bg-blue-600 dark:bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 transition-colors"
          >
            Generate Content for All Rows
          </button>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            This will generate social media content for all {excelData.length} rows
          </p>
        </div>
      )}
      
      {generatingContent && (
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col items-center">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-4">
              <div className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-300" style={{ width: `${generationProgress}%` }}></div>
            </div>
            <p className="text-center text-gray-600 dark:text-gray-400">
              Generating content: {generationProgress}% complete
            </p>
          </div>
        </div>
      )}
      
      {renderGeneratedContent()}
    </div>
  )
}
