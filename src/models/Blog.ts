import mongoose, { Schema, Document } from 'mongoose';

export interface IBlog extends Document {
  submissionId: mongoose.Types.ObjectId;
  title: string;
  content: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  featuredImage?: string;
  tags: string[];
  category: string;
  seoKeywords: string[];
  readingTime: number;
  status: 'draft_writer' | 'draft_created' | 'review' | 'approved_school' | 'rejected' | 'published_wp';
  assignedSchool?: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  wordpressPostId?: number;
  wordpressUrl?: string;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema: Schema = new Schema(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      ref: 'Submission',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    content: {
      type: String,
      required: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    metaTitle: {
      type: String,
      required: true,
    },
    metaDescription: {
      type: String,
      required: true,
    },
    featuredImage: {
      type: String,
    },
    tags: [{
      type: String,
    }],
    category: {
      type: String,
      required: true,
    },
    seoKeywords: [{
      type: String,
    }],
    readingTime: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['draft_writer', 'draft_created', 'review', 'approved_school', 'rejected', 'published_wp'],
      default: 'draft_writer',
    },
    assignedSchool: {
      type: Schema.Types.ObjectId,
      ref: 'School',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    wordpressPostId: {
      type: Number,
    },
    wordpressUrl: {
      type: String,
    },
    publishedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IBlog>('Blog', BlogSchema);
