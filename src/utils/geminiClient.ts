import { GoogleGenAI } from '@google/genai';

interface BlogDraftResponse {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  seoKeywords: string[];
  content: string;
  readingTime: number;
}

interface SocialPostResponse {
  caption: string;
  hashtags: string[];
}

class GeminiClient {
  private ai: GoogleGenAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment variables');
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async generateBlogDraft(
    title: string,
    description: string,
    category: string
  ): Promise<BlogDraftResponse> {
    const prompt = `You are an expert content writer for educational blogs.
Create an engaging, SEO-optimized article from this school submission:

Title: ${title}
Description: ${description}
Category: ${category}
Tone: Positive, informative, storytelling.

Output ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "title": "...",
  "slug": "...",
  "metaTitle": "...",
  "metaDescription": "...",
  "seoKeywords": ["keyword1", "keyword2", "keyword3"],
  "content": "<p>Full HTML article content here...</p>",
  "readingTime": 5
}`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      const text = response.text || '';
      
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanText);
      return parsed;
    } catch (error: any) {
      console.error('Gemini API Error:', error.message);
      throw new Error('Failed to generate blog draft from AI');
    }
  }

  async generateSocialPost(
    blogTitle: string,
    blogSummary: string,
    platform: 'instagram' | 'linkedin' | 'twitter' | 'facebook'
  ): Promise<SocialPostResponse> {
    const platformGuidelines: Record<string, string> = {
      instagram: 'Tone: friendly, short, emoji-friendly. Max 2200 chars. Include 10-15 hashtags.',
      linkedin: 'Tone: professional, informative. Max 3000 chars. Include 3-5 hashtags.',
      twitter: 'Tone: concise, engaging. Max 280 chars. Include 2-3 hashtags.',
      facebook: 'Tone: conversational, engaging. Max 500 chars. Include 3-5 hashtags.',
    };

    const prompt = `Write an engaging ${platform} post for this blog article:

Title: ${blogTitle}
Summary: ${blogSummary}

${platformGuidelines[platform]}

Output ONLY valid JSON with this exact structure (no markdown, no code blocks):
{
  "caption": "...",
  "hashtags": ["hashtag1", "hashtag2", "hashtag3"]
}`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      const text = response.text || '';
      
      // Remove markdown code blocks if present
      const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      const parsed = JSON.parse(cleanText);
      return parsed;
    } catch (error: any) {
      console.error('Gemini API Error:', error.message);
      throw new Error('Failed to generate social post from AI');
    }
  }

  async improveContent(content: string, instruction: string): Promise<string> {
    const prompt = `Improve this content based on the instruction:

Content: ${content}

Instruction: ${instruction}

Provide the improved content:`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      
      return response.text || '';
    } catch (error: any) {
      console.error('Gemini API Error:', error.message);
      throw new Error('Failed to improve content');
    }
  }
}

export default new GeminiClient();
