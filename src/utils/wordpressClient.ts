import axios, { AxiosInstance } from 'axios';

class WordPressClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.WP_BASE_URL || 'https://wp.schoolchamps.in/wp-json/wp/v2',
      auth: {
        username: process.env.WP_USER || '',
        password: process.env.WP_APP_PASS || '',
      },
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async uploadMedia(file: Express.Multer.File): Promise<any> {
    const FormData = require('form-data');
    const fs = require('fs');
    const axios = require('axios');

    const formData = new FormData();

    if (file.path.startsWith('http')) {
      // Handle remote URL (Cloudinary)
      const response = await axios.get(file.path, { responseType: 'stream' });
      formData.append('file', response.data, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else {
      // Handle local file path
      formData.append('file', fs.createReadStream(file.path), {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    }

    const response = await axios.post(
      `${process.env.WP_BASE_URL}/media`,
      formData,
      {
        auth: {
          username: process.env.WP_USER || '',
          password: process.env.WP_APP_PASS || '',
        },
        headers: {
          ...formData.getHeaders(),
        },
      }
    );

    return response.data;
  }

  async createPost(postData: {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
    featured_media?: number;
    meta?: any;
    tags?: number[];
    categories?: number[];
  }): Promise<any> {
    const response = await this.client.post('/posts', postData);
    return response.data;
  }

  async updatePost(postId: number, postData: any): Promise<any> {
    const response = await this.client.put(`/posts/${postId}`, postData);
    return response.data;
  }

  async deletePost(postId: number): Promise<any> {
    const response = await this.client.delete(`/posts/${postId}`);
    return response.data;
  }

  async getPost(postId: number): Promise<any> {
    const response = await this.client.get(`/posts/${postId}`);
    return response.data;
  }

  async getPosts(perPage: number = 100): Promise<any> {
    const response = await this.client.get('/posts', {
      params: { per_page: perPage, _embed: true }
    });
    return response.data;
  }

  async createTag(tagName: string): Promise<any> {
    const response = await this.client.post('/tags', {
      name: tagName,
      slug: tagName.toLowerCase().replace(/\s+/g, '-'),
    });
    return response.data;
  }

  async getTags(): Promise<any> {
    const response = await this.client.get('/tags');
    return response.data;
  }
}

export default new WordPressClient();
