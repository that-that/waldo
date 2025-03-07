import { z } from 'zod';
import { PublicUserSchema } from './dash';
export const GameplayTypes = z.enum(['VAL', 'CSG', 'TF2', 'APE', 'COD', 'R6S']);
export const CheatTypes = z.enum([
  'NOCHEAT',
  'AIMBOT',
  'TRIGGERBOT',
  'ESP',
  'SPINBOT',
]);
const GameplayVotes = z.array(
  z.object({
    id: z.string().optional(),
    gameplayId: z.string().optional(),
    userId: z.string().optional(),
    isGame: z.boolean().optional(),
    actualGame: GameplayTypes.optional(),
  }),
);
export const GameplaySchema = z.object({
  id: z.string().cuid(),
  userId: z.string(),
  youtubeUrl: z.string().url(),
  gameplayType: GameplayTypes,
  isAnalyzed: z.boolean(),
  cheats: z.array(CheatTypes),
});

export const GameplaysDashSchema = z.object({
  id: z.string().cuid(),
  userId: z.string().cuid(),
  youtubeUrl: z.string().url(),
  gameplayType: GameplayTypes,
  cheats: z.array(CheatTypes),
  isAnalyzed: z.boolean(),
  user: z.object({
    name: z.string().nullable(),
  }),
  gameplayCount: z.number().optional(),
});

export const ReviewItemsGameplaySchema = GameplaySchema.merge(
  z.object({
    user: PublicUserSchema,
    gameplayVotes: GameplayVotes,
  }),
);
