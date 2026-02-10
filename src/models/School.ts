import mongoose, { Schema, Document } from 'mongoose';

export interface ISchool extends Document {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  contactEmail: string;
  contactPhone?: string;
  principalName?: string;
  isActive: boolean;
  logo?: string;
  website?: string;
  coins: number;
  instagramAccessToken?: string;
  instagramAccountId?: string;
  instagramPageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const SchoolSchema: Schema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      type: String,
      required: false,
    },
    city: {
      type: String,
      required: false,
    },
    state: {
      type: String,
      required: false,
    },
    pincode: {
      type: String,
      required: false,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
    },
    contactPhone: {
      type: String,
      required: false,
    },
    principalName: {
      type: String,
      required: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    logo: {
      type: String,
    },
    website: {
      type: String,
    },
    coins: {
      type: Number,
      default: 0,
    },
    instagramAccessToken: {
      type: String,
    },
    instagramAccountId: {
      type: String,
    },
    instagramPageId: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ISchool>('School', SchoolSchema);
