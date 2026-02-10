import mongoose, { Schema, Document } from 'mongoose';

export interface ISocialPost extends Document {
  blogId: mongoose.Types.ObjectId;
  platform: 'instagram' | 'linkedin' | 'twitter' | 'facebook';
  caption: string;
  hashtags: string[];
  scheduledFor?: Date;
  isPublished: boolean;
  publishedId?: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SocialPostSchema: Schema = new Schema(
  {
    blogId: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
    },
    platform: {
      type: String,
      enum: ['instagram', 'linkedin', 'twitter', 'facebook'],
      required: true,
    },
    caption: {
      type: String,
      required: true,
    },
    hashtags: [{
      type: String,
    }],
    scheduledFor: {
      type: Date,
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    publishedId: {
      type: String,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ISocialPost>('SocialPost', SocialPostSchema);
