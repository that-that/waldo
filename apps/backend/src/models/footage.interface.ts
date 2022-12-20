import { z } from 'express-zod-api';
import mongoose, { Document, Model, Schema } from 'mongoose';

const FootageTypeEnum = z.enum(['VAL', 'CSG', 'TF2', 'APE', 'COD']);
type FootageTypeEnumZod = z.infer<typeof FootageTypeEnum>;

type FootageDocument = Document & {
  uuid: string;
  discordId: number;
  youtubeUrl: string;
  videoFormat: number;
  footageType: string;
  upVotes: number;
  downVotes: number;
  isAnalyzed: boolean;
  isParsed: boolean;
};

const FootageZodSchema = z.object({
  id: z.string().cuid(),
  userId: z.string(),
  youtubeUrl: z.string().url(),
  videoFormat: z.number(),
  footageType: z.string(),
  upVotes: z.number().optional(),
  downVotes: z.number().optional(),
  isAnalyzed: z.boolean(),
  isParsed: z.boolean(),
});

const FootageUpdateInputSchema = z.object({
  id: z.string().cuid(),
  footageType: FootageTypeEnum,
  isAnalyzed: z.boolean(),
  isParsed: z.boolean(),
});

type FootageUpdateInput = z.infer<typeof FootageUpdateInputSchema>;

const footageSchema = new Schema(
  {
    uuid: {
      type: Schema.Types.String,
      required: true,
      unique: true,
    },
    discordId: {
      type: Schema.Types.Number,
      required: true,
    },
    youtubeUrl: {
      type: Schema.Types.String,
      required: true,
      unique: true,
    },
    videoFormat: {
      type: Schema.Types.Number,
      required: true,
    },
    footageType: {
      type: Schema.Types.String,
      required: true,
      default: 'csgo',
    },
    isAnalyzed: {
      type: Schema.Types.Boolean,
      required: true,
      default: false,
    },
    isParsed: {
      type: Schema.Types.Boolean,
      required: true,
      default: false,
    },
    upVotes: {
      type: Schema.Types.Number,
      required: false,
      default: 0,
    },
    downVotes: {
      type: Schema.Types.Number,
      required: false,
      default: 0,
    },
  },
  {
    collection: 'footage',
    timestamps: true,
  },
);

if (mongoose.models.Footage) {
  delete mongoose.models.Footage;
}

const Footage: Model<FootageDocument> = mongoose.model<FootageDocument>(
  'Footage',
  footageSchema,
);

export { Footage, FootageZodSchema, FootageUpdateInputSchema, FootageTypeEnum };
export type { FootageDocument, FootageUpdateInput, FootageTypeEnumZod };
