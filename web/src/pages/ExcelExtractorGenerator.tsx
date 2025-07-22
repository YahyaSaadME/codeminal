import React, { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { GoogleGenAI } from '@google/genai'
import { jsPDF } from 'jspdf'
import { Download, AlertTriangle, Share2, Twitter, Facebook, Instagram } from 'lucide-react'
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
  logo_of_brand?: string; // New field for logo URL
}

interface GeneratedContent {
  titles: string[];
  description: string;
  hashtags: string[];
  imageUrl: string;
  logoUrl?: string; // Store the processed logo URL
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
  const [shareStatus, setShareStatus] = useState<{[key: string]: boolean}>({})
  
  // Refs for each generated content item for better scrolling
  const contentItemRefs = React.useRef<Array<HTMLDivElement | null>>([])

  // New state for tracking logo loading status
  const [logoLoadingStatus, setLogoLoadingStatus] = useState<{[key: string]: 'loading' | 'success' | 'error'}>({});

  // Handle scroll to view generated content
  useEffect(() => {
    if (generatedContents.length > 0 && !generatingContent && contentRef.current) {
      // Scroll to the generated content area with smooth behavior
      window.scrollTo({
        top: contentRef.current.offsetTop - 100, // Offset by 100px for better visibility
        behavior: 'smooth'
      })
    }
  }, [generatedContents, generatingContent])

  // Function to fetch and convert image to base64
  const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    if (!url) return null;
    
    try {
      // Check if the URL is already a data URL
      if (url.startsWith('data:')) {
        return url;
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to convert image to base64"));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error fetching image:", error);
      return null;
    }
  };

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
      const phoneNumber = row.phone_number || ''
      const emailId = row.email_id || ''
      const hasContactInfo = phoneNumber || emailId
    
      // Process logo if available
      let logoBase64 = null;
      let logoInstructions = '';
      
      if (row.logo_of_brand) {
        setLogoLoadingStatus(prev => ({ ...prev, [index]: 'loading' }));
        logoBase64 = await fetchImageAsBase64(row.logo_of_brand);
        setLogoLoadingStatus(prev => ({ ...prev, [index]: logoBase64 ? 'success' : 'error' }));
        
        if (logoBase64) {
          logoInstructions = `
          BRAND LOGO REQUIREMENTS (EXTREMELY IMPORTANT):
          1. I have provided the brand's logo that MUST be incorporated in the generated image.
          2. Place the logo strategically where it enhances brand recognition without dominating the image.
          3. The logo should appear EXACTLY ONCE in the image - DO NOT repeat it multiple times.
          4. For ${platformType}, position the logo in ${platformType.toLowerCase().includes('instagram') ? 'one of the corners' : platformType.toLowerCase().includes('facebook') ? 'the bottom right corner' : 'an appropriate corner'}.
          5. Size the logo appropriately (10-15% of the image size) - it should be clearly visible but not overwhelm the design.
          6. Ensure the logo has good contrast against its background for optimal visibility.
          7. Maintain the logo's original proportions and colors - do not distort or recolor it.
          `;
        }
      }
      
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
      
      // Define post type specific requirements
      const postTypeStyleMap: {[key: string]: string} = {
        'product': 'clear product showcase with prominent product placement, professional lighting, and features/benefits highlighted',
        'promotional': 'eye-catching offer visualization with clear call-to-action and benefit statement',
        'educational': 'informative visual with clear data presentation or step-by-step visualization',
        'testimonial': 'trust-building elements like testimonial text highlights, customer imagery or rating symbols',
        'announcement': 'attention-grabbing design with bold headline and clear announcement details',
        'engagement': 'conversation-starting visual with question elements or interactive-looking components',
        'behind-the-scenes': 'authentic, slightly less polished aesthetic with candid elements and personal touches',
        'event': 'date/time/location information prominently displayed with event highlights visualization',
      }
      
      // Get post type specific requirements
      const postTypeLower = postType.toLowerCase()
      const postTypeRequirements = Object.keys(postTypeStyleMap).find(key => postTypeLower.includes(key))
        ? postTypeStyleMap[Object.keys(postTypeStyleMap).find(key => postTypeLower.includes(key)) as string]
        : 'balanced visual composition with clear subject focus and brand-aligned aesthetics'
    
      // Define contact info display instructions
      let contactInstructions = ''
      if (hasContactInfo) {
        contactInstructions = `
        CONTACT INFORMATION DISPLAY (ESSENTIAL):
        1. The following contact information MUST be included in the image in a professional, easily readable format:
           ${phoneNumber ? `- Phone: ${phoneNumber}` : ''}
           ${emailId ? `- Email: ${emailId}` : ''}
        2. Position the contact information in a strategic location where it's clearly visible but doesn't distract from the main content.
        3. For ${platformType}, place contact info ${platformType.toLowerCase().includes('instagram') ? 'at the bottom of the image' : platformType.toLowerCase().includes('linkedin') ? 'in a professional footer area' : 'in an appropriate location based on design best practices'}.
        4. Style the contact information in a way that matches the overall design aesthetic and ${fontStyle.toLowerCase()} font style.
        5. Ensure contact text has excellent contrast against its background for maximum readability.
        6. Add subtle visual elements (icons) next to the contact information to improve visual appeal.
        `
      }
      
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
        You are a professional content creator specializing in creating high-quality ${platformType} content for ${profession}.
        
        CONTENT BRIEF:
        - Brand name: "${profession}"
        - Post type: ${postType}
        - Platform: ${platformType}
        - Content focus: ${promptText}
        - Font style: ${fontStyle}
        ${hasContactInfo ? `- Contact details: ${phoneNumber ? 'Phone ' + phoneNumber : ''} ${emailId ? 'Email ' + emailId : ''}` : ''}
        
        IMAGE CREATION REQUIREMENTS (EXTREMELY IMPORTANT):
        1. Generate a HIGH-QUALITY ${postType.toUpperCase()} IMAGE for ${platformType.toUpperCase()} that perfectly represents ${profession} and ${promptText}.
        2. Image style must be: ${imageStyle}
        3. Post type specific requirements: ${postTypeRequirements}
        4. Design elements must include:
           - Professional-quality composition with proper balance and visual hierarchy
           - Visual representation of the main subject: "${promptText}"
           - Brand name "${profession}" should be visible in a way that aligns with brand identity
           - Color scheme that matches ${profession}'s industry standards and ${postType} mood
           - Use ${fontCharacteristics} for any text elements
           - If this is a product post, ensure the product is the hero element with proper lighting and context
        5. Text overlay requirements:
           - Include a SHORT, IMPACTFUL headline (5 words max) with strong call-to-action
           - All text must be HIGHLY READABLE with excellent contrast against backgrounds
           - Position text following the rule of thirds for maximum visual impact
           - Text size should be optimized for ${platformType} viewing on mobile devices
           - Limit text to essential information only - let the visuals communicate
        6. The image should be instantly understandable without reading the description
        7. Visual style should maintain perfect cohesion with brand identity, platform requirements, and content topic
        
        ${logoInstructions}
        
        ${contactInstructions}
        
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
      
      // Create model request
      const modelConfig: {
        model: string;
        contents: { parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }[];
        config: {
          responseModalities: string[];
          responseMimeType: string;
        };
      } = {
        model: 'gemini-2.0-flash-preview-image-generation',
        contents: [],
        config: {
          responseModalities: ["IMAGE", "TEXT"],
          responseMimeType: "text/plain",
        }
      };
      
      // Add text content
      const content: any = { text: formattedPrompt };
      
      // If we have a logo, add it as inline data
      if (logoBase64) {
        modelConfig.contents = [
          { 
            parts: [
              { text: formattedPrompt },
              {
                inlineData: {
                  mimeType: logoBase64.split(';')[0].split(':')[1],
                  data: logoBase64.split(',')[1]
                }
              }
            ]
          } as { parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] }
        ];
      } else {
        modelConfig.contents = [{ parts: [content] }];
      }
      
      // Call the API with the proper configuration
      const response = await ai.models.generateContent(modelConfig);
      
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
          imageUrl: imageUrl,
          logoUrl: row.logo_of_brand // Store the original logo URL
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
      
      // Add brand name, platform type and logo as title
      pdf.setFontSize(18)
      pdf.text(`${rowData.brand_name || 'Brand'} - ${rowData.platform_type || 'Social Media'}`, 14, 20)
      
      // Add logo if available
      if (rowData.logo_of_brand && logoLoadingStatus[i] === 'success') {
        try {
          // The logo is already part of the generated image, no need to add it separately
          // Just showing brand info with the logo next to it
          const logoImg = rowData.logo_of_brand;
          // Add a small logo in the corner of the PDF (if needed)
          pdf.addImage(logoImg, 'PNG', 180, 10, 15, 15);
        } catch (err) {
          console.error("Error adding logo to PDF:", err)
        }
      }
      
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

  // New: Share functionality
  const shareContent = (content: GeneratedContent | null, platform: string, index?: number) => {
    if (!content) return

    // Create share text
    const shareText = `
${content.titles[0] || ''}

${content.description || ''}

${content.hashtags.join(' ') || ''}
    `.trim()

    // Set temporary sharing status
    const statusKey = index !== undefined ? `${platform}-${index}` : `${platform}-all`
    setShareStatus(prev => ({ ...prev, [statusKey]: true }))
    setTimeout(() => {
      setShareStatus(prev => ({ ...prev, [statusKey]: false }))
    }, 2000)

    try {
      // Platform-specific sharing
      if (navigator.share && platform === 'native') {
        // Use native share if available
        navigator.share({
          title: content.titles[0] || 'Social Media Content',
          text: shareText,
          // Could include the image URL but it would need to be a public URL, not base64
        })
        .catch(err => console.error('Error sharing:', err))
        return
      }

      // Platform-specific share URLs
      let shareUrl = ''
      switch (platform) {
        case 'twitter':
          shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`
          break
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(shareText)}`
          break
        case 'instagram':
          // Instagram doesn't support direct web sharing links for content
          // Usually requires mobile app, so just copy to clipboard
          navigator.clipboard.writeText(shareText)
          return
        default:
          navigator.clipboard.writeText(shareText)
          return
      }

      // Open share URL in new window
      if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400')
      }
    } catch (error) {
      console.error('Error sharing content:', error)
      // Fallback to clipboard copy
      navigator.clipboard.writeText(shareText)
        .then(() => alert('Content copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err))
    }
  }

  // Share all generated content
  const shareAllContent = (platform: string) => {
    if (generatedContents.length === 0) return

    // Get the first valid content to share
    const validContent = generatedContents.find(content => content !== null)
    if (!validContent) return

    // Share the combined text of all content
    const combinedText = generatedContents
      .filter(content => content !== null)
      .map(content => `
${content?.titles[0] || ''}

${content?.description || ''}

${content?.hashtags.join(' ') || ''}
      `.trim())
      .join('\n\n---\n\n')

    // Set temporary sharing status
    const statusKey = `${platform}-all`
    setShareStatus(prev => ({ ...prev, [statusKey]: true }))
    setTimeout(() => {
      setShareStatus(prev => ({ ...prev, [statusKey]: false }))
    }, 2000)

    try {
      // Handle sharing based on platform
      if (navigator.share && platform === 'native') {
        navigator.share({
          title: 'Social Media Content',
          text: combinedText,
        }).catch(err => console.error('Error sharing:', err))
        return
      }

      let shareUrl = ''
      switch (platform) {
        case 'twitter':
          // Twitter has character limits, so just share the first content
          shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
            `${validContent.titles[0] || ''}\n\n${validContent.description || ''}\n\n${validContent.hashtags.join(' ') || ''}`
          )}`
          break
        case 'facebook':
          shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}&quote=${encodeURIComponent(combinedText.substring(0, 1000))}`
          break
        case 'instagram':
          navigator.clipboard.writeText(combinedText)
          return
        default:
          navigator.clipboard.writeText(combinedText)
          return
      }

      if (shareUrl) {
        window.open(shareUrl, '_blank', 'width=600,height=400')
      }
    } catch (error) {
      console.error('Error sharing all content:', error)
      navigator.clipboard.writeText(combinedText)
        .then(() => alert('All content copied to clipboard!'))
        .catch(err => console.error('Failed to copy:', err))
    }
  }

  // Scroll to specific content item
  const scrollToContentItem = (index: number) => {
    if (contentItemRefs.current[index]) {
      const el = contentItemRefs.current[index]
      if (el) {
        window.scrollTo({
          top: el.offsetTop - 100, // Offset by 100px for better visibility
          behavior: 'smooth'
        })
      }
    }
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
    
    // Update refs array length to match content length
    if (contentItemRefs.current.length !== generatedContents.length) {
      contentItemRefs.current = Array(generatedContents.length).fill(null)
    }
    
    return (
      <div ref={contentRef} className="relative mt-12 mb-8 w-full overflow-visible">
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white">Generated Social Media Content</h2>
          
          <div className="flex gap-2 flex-wrap justify-end">
            {/* Global share buttons */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded-md">
              <span className="text-sm text-gray-600 dark:text-gray-300">Share All:</span>
              <button 
                onClick={() => shareAllContent('twitter')}
                className="p-2 text-blue-400 hover:text-blue-600 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Share on Twitter"
              >
                <Twitter size={18} />
              </button>
              <button 
                onClick={() => shareAllContent('facebook')}
                className="p-2 text-blue-600 hover:text-blue-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Share on Facebook"
              >
                <Facebook size={18} />
              </button>
              <button 
                onClick={() => shareAllContent('instagram')}
                className="p-2 text-pink-500 hover:text-pink-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Copy for Instagram"
              >
                <Instagram size={18} />
              </button>
              <button 
                onClick={() => shareAllContent('native')}
                className="p-2 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                title="Share"
              >
                <Share2 size={18} />
              </button>
            </div>
            
            <button 
              onClick={handleDownloadPDF}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              <Download size={18} />
              Download All as PDF
            </button>
          </div>
        </div>
        
        {/* Generated content navigation */}
        {generatedContents.length > 1 && (
          <div className="mb-6 overflow-x-auto">
            <div className="flex gap-2 pb-2">
              {generatedContents.map((content, index) => 
                content ? (
                  <button
                    key={index}
                    onClick={() => scrollToContentItem(index)}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm transition-colors whitespace-nowrap"
                  >
                    {excelData[index]?.brand_name || `Item ${index + 1}`}
                  </button>
                ) : null
              )}
            </div>
          </div>
        )}
        
        <div className="space-y-12">
          {generatedContents.map((content, index) => {
            if (!content) return null
            const rowData = excelData[index]
            const hasLogo = !!rowData.logo_of_brand
            
            return (
              <div 
                key={index} 
                ref={(el) => {
                  if (contentItemRefs.current) {
                    contentItemRefs.current[index] = el;
                  }
                }}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-6 bg-white dark:bg-gray-800 shadow-sm transition-colors"
                id={`content-item-${index}`}
              >
                <div className="flex justify-between mb-4 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    {hasLogo && (
                      <div className="w-10 h-10 flex-shrink-0 overflow-hidden rounded border border-gray-200 dark:border-gray-700 bg-white">
                        {logoLoadingStatus[index] === 'loading' ? (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                            <div className="w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
                          </div>
                        ) : logoLoadingStatus[index] === 'error' ? (
                          <div className="w-full h-full flex items-center justify-center bg-gray-50 dark:bg-gray-700">
                            <span className="text-red-500 text-xs">Error</span>
                          </div>
                        ) : (
                          <img 
                            src={rowData.logo_of_brand} 
                            alt={`${rowData.brand_name || 'Brand'} logo`}
                            className="w-full h-full object-contain"
                            onError={() => setLogoLoadingStatus(prev => ({ ...prev, [index]: 'error' }))}
                          />
                        )}
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-white">{rowData.brand_name || `Item ${index + 1}`}</h3>
                      <p className="text-gray-500 dark:text-gray-400">
                        {rowData.platform_type || 'Social Media'} • {rowData.type_of_post || 'Post'}
                      </p>
                    </div>
                  </div>
                  
                  {/* Individual share buttons */}
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => shareContent(content, 'twitter', index)}
                      className={`p-1.5 text-blue-400 hover:text-blue-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${shareStatus[`twitter-${index}`] ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                      title="Share on Twitter"
                    >
                      <Twitter size={16} />
                    </button>
                    <button 
                      onClick={() => shareContent(content, 'facebook', index)}
                      className={`p-1.5 text-blue-600 hover:text-blue-800 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${shareStatus[`facebook-${index}`] ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                      title="Share on Facebook"
                    >
                      <Facebook size={16} />
                    </button>
                    <button 
                      onClick={() => shareContent(content, 'instagram', index)}
                      className={`p-1.5 text-pink-500 hover:text-pink-700 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${shareStatus[`instagram-${index}`] ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                      title="Copy for Instagram"
                    >
                      <Instagram size={16} />
                    </button>
                    <button 
                      onClick={() => shareContent(content, 'native', index)}
                      className={`p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${shareStatus[`native-${index}`] ? 'bg-gray-100 dark:bg-gray-700' : ''}`}
                      title="Share"
                    >
                      <Share2 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {content.imageUrl && (
                    <div className="border border-gray-200 dark:border-gray-700 rounded-md overflow-hidden bg-white dark:bg-gray-900 p-2">
                      <h4 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-100">Generated Image</h4>
                      <div className="relative">
                        <img 
                          src={content.imageUrl} 
                          alt={`Generated for ${rowData.brand_name || `Item ${index + 1}`}`}
                          className="w-full h-auto rounded-md"
                        />
                        {/* We don't need to manually overlay the logo since it's already included in the generated image */}
                      </div>
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
    <div className="relative p-6 max-w-6xl mx-auto w-full">
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
