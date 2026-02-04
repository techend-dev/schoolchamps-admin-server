import mongoose, { Schema, Document } from 'mongoose';

export interface ISubmission extends Document {
  schoolId: mongoose.Types.ObjectId;
  title: string;
  description: string;
  category: string;
  attachments: string[];
  status: 'submitted_school' | 'draft_created' | 'review' | 'published_wp';
  assignedTo?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubmissionSchema: Schema = new Schema(
  {
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
      enum: ['news', 'achievement', 'event', 'announcement', 'other'],
    },
    attachments: [{
      type: String,
    }],
    status: {
      type: String,
      enum: ['submitted_school', 'draft_created', 'review', 'published_wp'],
      default: 'submitted_school',
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ISubmission>('Submission', SubmissionSchema);
