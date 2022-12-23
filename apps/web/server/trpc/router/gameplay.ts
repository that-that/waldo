import {TRPCError} from '@trpc/server';
import * as ytdl from 'ytdl-core';
import * as cuid from "cuid";
import * as fs from "fs";
import {
  GameplayPlusUserSchema,
  GameplaySchema,
  GameplaysDashSchema,
  GameplayTypes,
} from '@utils/zod/gameplay';
import {z} from 'zod';
import {protectedProcedure, router} from '../trpc';
import {SegmentSchema} from '@utils/zod/segment';
import {hasPerms, Perms, Roles} from '@server/utils/hasPerms';
import {parseClips} from "@server/utils/clips";

export const gameplayRouter = router({
  get: protectedProcedure
    .meta({ openapi: { method: 'GET', path: '/gameplay' } })
    .input(
      z.object({
        gameplayId: z.string().cuid(),
      }),
    )
    .output(GameplaySchema)
    .query(async ({ input, ctx }) => {
      const gameplay = await ctx.prisma.footage.findUnique({
        where: {
          id: input.gameplayId,
        },
      });

      // if gameplay not found, or not the user who made it
      if (
        gameplay === null ||
        !hasPerms({
          userId: ctx.session.user.id,
          userRole: Roles.User,
          itemOwnerId: gameplay.userId,
          requiredPerms: Perms.isOwner,
          blacklisted: ctx.session.user.blacklisted,
        })
      )
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Could not find that requested gameplay',
        });

      return gameplay;
    }),
  getMany: protectedProcedure
    .meta({ openapi: { method: 'GET', path: '/gameplay/dash' } })
    .input(
      z.object({
        page: z.number(),
        filterGames: GameplayTypes,
      }),
    )
    .output(z.array(GameplaysDashSchema))
    .query(async ({ input, ctx }) => {
      const takeValue = 10;
      const skipValue = input.page * 10 - 10;
      if (input.filterGames == null) {
        const gameplayCount: number = await ctx.prisma.footage.count();
        try {
          const gameplays = await ctx.prisma.footage.findMany({
            take: takeValue,
            skip: skipValue,
          });
          gameplays.forEach((gameplay, index) => {
            Object.assign(gameplays[index], { gameplayCount: gameplayCount });
          });
          return gameplays;
        } catch (error) {
          throw new TRPCError({
            message: 'No footage with the inputs provided could be found.',
            code: 'NOT_FOUND',
          });
        }
      } else {
        try {
          const gameplayCount = await ctx.prisma.footage.count({
            where: {
              footageType: input.filterGames,
            },
          });
          const gameplays = await ctx.prisma.footage.findMany({
            where: {
              footageType: input.filterGames,
            },
            take: takeValue,
            skip: skipValue,
          });
          gameplays.forEach((gameplay, index) => {
            Object.assign(gameplays[index], { gameplayCount: gameplayCount });
          });
          return gameplays;
        } catch (error) {
          throw new TRPCError({
            message: 'No footage with the inputs provided could be found.',
            code: 'NOT_FOUND',
          });
        }
      }
    }),
  create: protectedProcedure
    .meta({ openapi: { method: 'POST', path: '/gameplay' } })
    .input(
      z.object({
        youtubeUrl: z.string().url(),
        gameplayType: GameplayTypes,
      }),
    )
    .output(GameplaySchema)
    .mutation(async ({ input, ctx }) => {
      if (
        !hasPerms({
          userId: ctx.session.user.id,
          userRole: Roles.User,
          requiredPerms: Perms.isOwner,
          blacklisted: ctx.session.user.blacklisted,
        })
      )
        throw new TRPCError({
          code: 'UNAUTHORIZED',
        });

      const existingGameplay = await ctx.prisma.footage.findUnique({
        where: {
          youtubeUrl: input.youtubeUrl
        },
      });

      // this needs to be handled client side
      if (existingGameplay !== null)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This youtube url has already been submitted.',
        });

      const details = await ytdl.getInfo(input.youtubeUrl);
      const { formats } = details;
      const defaultFormat = formats.find(format => format.itag === 299) ?? formats.find(format => format.itag === 298);
      const lowFormat = formats.find(format => format.itag === 136) ? 136 : undefined;

      // TODO: Update to download specific format from footage details.
      // Download video and save as a local MP4 to be used for processing.
      // const footageId = cuid();
      // await ytdl(input.youtubeUrl).pipe(fs.createWriteStream(`${footageId}.mp4`));

      // TODO: Create functionality to queue parsing and return clips to DB,
      // or implement endpoint to parse clips and return archive(?)
      // parseClips(footageId, `${footageId}.mp4`);

      if (!defaultFormat && !lowFormat)
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'URL does not provide an acceptable video format.',
        });

      return await ctx.prisma.footage.create({
        data: {
          userId: ctx.session.user.id,
          youtubeUrl: input.youtubeUrl,
          videoFormat: defaultFormat ? defaultFormat.itag : lowFormat,
          footageType: input.gameplayType,
        },
      });
    }),
  getUsers: protectedProcedure
    .meta({ openapi: { method: 'GET', path: '/gameplay/user' } })
    .input(
      z.object({
        userId: z.string().cuid().nullish().optional(),
      }),
    )
    .output(GameplaySchema.array())
    .query(async ({ input, ctx }) => {
      // if no user id provided, use user id from session
      // userId should only be passed by system admins, not avg users
      const userId = input.userId === null ? ctx.session.user.id : input.userId;

      if (
        !hasPerms({
          userId: ctx.session.user.id,
          userRole: Roles.User,
          itemOwnerId: userId,
          requiredPerms: Perms.isOwner,
          blacklisted: ctx.session.user.blacklisted,
        })
      )
        throw new TRPCError({
          code: 'UNAUTHORIZED',
        });

      const user = await ctx.prisma.user.findUnique({
        where: {
          id: userId,
        },
        include: {
          footage: true,
        },
      });

      // if no user
      if (user === null)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No user found with the provided ID.',
        });

      return user.footage;
    }),
  getClips: protectedProcedure
    .meta({ openapi: { method: 'GET', path: '/gameplay/clips' } })
    .input(
      z.object({
        gameplayId: z.string().cuid(),
      }),
    )
    .output(SegmentSchema.array())
    .query(async ({ input, ctx }) => {
      const gameplay = await ctx.prisma.footage.findUnique({
        where: {
          id: input.gameplayId,
        },
        include: {
          clips: true,
        },
      });

      // if gameplay not found, or not the user who made it
      if (gameplay === null)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Could not find that requested gameplay',
        });

      if (
        !hasPerms({
          userId: ctx.session.user.id,
          userRole: Roles.User,
          itemOwnerId: gameplay.userId,
          requiredPerms: Perms.roleMod,
          blacklisted: ctx.session.user.blacklisted,
        })
      )
        throw new TRPCError({
          code: 'UNAUTHORIZED',
        });

      return gameplay.clips;
    }),
  update: protectedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/gameplay' } })
    .input(
      z.object({
        gameplayId: z.string().cuid(),
        footageType: GameplayTypes,
        isAnalyzed: z.boolean(),
      }),
    )
    .output(GameplaySchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const gameplay = await ctx.prisma.footage.findUniqueOrThrow({
          where: {
            id: input.gameplayId,
          },
        });

        // if modifying isAnalyzed, require mod role
        const requiredPerms =
          gameplay.isAnalyzed === input.isAnalyzed
            ? Perms.isOwner
            : Perms.roleMod;

        if (
          !hasPerms({
            userId: ctx.session.user.id,
            userRole: Roles.User,
            itemOwnerId: gameplay.userId,
            requiredPerms,
            blacklisted: ctx.session.user.blacklisted,
          })
        )
          throw new TRPCError({
            code: 'UNAUTHORIZED',
          });

        return await ctx.prisma.footage.update({
          where: {
            id: input.gameplayId,
          },
          data: {
            isAnalyzed: input.isAnalyzed,
            footageType: input.footageType,
          },
        });
      } catch (error) {
        // throws RecordNotFound if record not found to update
        // but can't import for some reason

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred in the server',
          // not sure if this is secure
          cause: error,
        });
      }
    }),
  delete: protectedProcedure
    .meta({ openapi: { method: 'DELETE', path: '/gameplay' } })
    .input(
      z.object({
        gameplayId: z.string().cuid(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const gameplay = await ctx.prisma.footage.findUniqueOrThrow({
          where: {
            id: input.gameplayId,
          },
        });

        if (
          !hasPerms({
            userId: ctx.session.user.id,
            userRole: Roles.User,
            itemOwnerId: gameplay.userId,
            requiredPerms: Perms.isOwner,
            blacklisted: ctx.session.user.blacklisted,
          })
        )
          throw new TRPCError({
            code: 'UNAUTHORIZED',
          });

        await ctx.prisma.footage.delete({
          where: {
            id: input.gameplayId,
          },
        });
      } catch (error) {
        // throws RecordNotFound if record not found to update
        // but can't import for some reason

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An error occurred in the server',
          // not sure if this is secure
          cause: error,
        });
      }
    }),
  getReviewItems: protectedProcedure
    .meta({ openapi: { method: 'GET', path: '/gameplay/review' } })
    .output(GameplayPlusUserSchema)
    .query(async ({ input, ctx }) => {
      const randomPick = (values: string[]) => {
        const index = Math.floor(Math.random() * values.length);
        return values[index];
      };
      const itemCount = await ctx.prisma.footage.count();
      const tenDocs = () => {
        return Math.floor(Math.random() * (itemCount - 1 + 1));
      };

      const orderBy = randomPick(['userId', 'id', 'youtubeUrl']);
      const orderDir = randomPick([`desc`, 'asc']);
      const reviewItems = await ctx.prisma.footage.findMany({
        take: 1,
        skip: tenDocs(),
        orderBy: { [orderBy]: orderDir },
        include: {
          user: true,
        },
      });
      if (reviewItems === null)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Could not query gameplay documents`,
        });
      return reviewItems[0];
    }),
  review: protectedProcedure
    .meta({ openapi: { method: 'PATCH', path: '/gameplay/review' } })
    .input(
      z.object({
        gameplayId: z.string().cuid(),
        isGame: z.boolean(),
        actualGame: GameplayTypes,
      }),
    )
    .output(z.object({ message: z.string() }))
    .mutation(async ({ input, ctx }) => {
      console.log(input.gameplayId);
      if (!ctx.session.user?.id) {
        return { message: 'No user' };
      }
      const footageVote = await ctx.prisma.footageVotes.create({
        data: {
          footageId: input.gameplayId,
          isGame: input.isGame,
          actualGame: input.actualGame,
          userId: ctx.session.user?.id,
        },
      });
      if (!footageVote)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `Could not find a gameplay document with id:${input.gameplayId}.`,
        });

      return { message: 'Updated the gameplay document successfully.' };
    }),
});
