export interface ApiResponse<T = any> {
  message: string;
  data?: T;
  error?: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}

export interface BlogDraft {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  seoKeywords: string[];
  content: string;
  readingTime: number;
}

export interface SocialPostData {
  caption: string;
  hashtags: string[];
}

export interface WordPressPost {
  id: number;
  title: { rendered: string };
  content: { rendered: string };
  link: string;
  slug: string;
  status: string;
  featured_media?: number;
}

export interface WordPressMedia {
  id: number;
  source_url: string;
  title: { rendered: string };
  media_type: string;
}
