import { z } from 'express-zod-api';
import mongoose, { Schema, Model, Document } from 'mongoose';

/**
 * A Clip Document
 * @typedef {object} ClipDocument
 * @property {string} uuid.required - The new unique ID for clip creation
 * @property {string} footageId.required - The associated Footage ID
 */
type ClipDocument = Document & {
  uuid: string;
  footageId: string;
};

const ClipZodSchema = z.object({
  uuid: z.string().cuid(),
  footageId: z.string().cuid(),
});

const ClipRetrieveSchema = z.object({
  clips: z.array(ClipZodSchema),
});

type ClipZod = z.infer<typeof ClipZodSchema>;
type ClipRetrieveZod = z.infer<typeof ClipRetrieveSchema>;

type ClipInput = {
  uuid: ClipDocument['uuid'];
  footageId: ClipDocument['footageId'];
};

const clipSchema = new Schema(
  {
    uuid: {
      type: Schema.Types.String,
      required: true,
      unique: true,
    },
    footageId: {
      type: Schema.Types.String,
      required: true,
    },
  },
  {
    collection: 'clips',
    timestamps: true,
  },
);

if (mongoose.models.Clip) {
  delete mongoose.models.Clip;
}

const Clip: Model<ClipDocument> = mongoose.model<ClipDocument>(
  'Clip',
  clipSchema,
);

export { Clip, ClipRetrieveSchema, ClipZodSchema };
export type { ClipInput, ClipDocument, ClipZod, ClipRetrieveZod };
