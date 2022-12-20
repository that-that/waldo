import ytdl from 'ytdl-core';
import cuid from 'cuid';
import * as fs from 'fs';

import {
  FootageTypeEnum,
  FootageUpdateInputSchema,
  FootageZodSchema,
} from '../models/footage.interface';
import { createHttpError, defaultEndpointsFactory, z } from 'express-zod-api';
import { prisma } from '../services/database';
import { parseClips } from '../services/clips';

/**
 * POST /footage
 * @summary Endpoint to create new Footage document based on submission from web form.
 * @param {string} id.form.required - The User's Discord ID - application/x-www-form-urlencoded
 * @param {string} username.form.required - The User's Discord name - application/x-www-form-urlencoded
 * @param {string} url.form.required - The YouTube URL with capture footage - application/x-www-form-urlencoded
 * @return {FootageDocument} 200 - Success response returns created Footage document.
 * @return 422 - A required form item is missing (i.e.: id, username, url).
 * @return 406 - The YouTube URL is not to an acceptable.
 * @return 400 - The YouTube URL has already been submitted.
 * @return 500 - Some internal error
 */
export const createFootage = defaultEndpointsFactory.build({
  method: 'post',
  input: z.object({
    id: z.string(),
    url: z.string().url(),
    type: FootageTypeEnum,
  }),
  output: FootageZodSchema,
  handler: async ({ input: { id, url, type }, options, logger }) => {
    const existingFootage = await prisma.footage.findUnique({
      where: {
        youtubeUrl: url,
      },
    });

    if (existingFootage !== null) {
      throw createHttpError(400, `URL ${url} has already been submitted.`);
    }

    const details = await ytdl.getInfo(url);
    const defaultFormat = details.formats.find(format => format.itag === 299) ?? details.formats.find(format => format.itag === 298);
    const lowFormat = details.formats.find(format => format.itag === 136) ? 136 : undefined;

    if (!defaultFormat && !lowFormat) {
      throw createHttpError(400, `URL ${url} does not provide an acceptable video format.`);
    }

    const footageId = cuid();

    // TODO: Update to download specific format from footage details.
    // Download video and save as a local MP4 to be used for processing.
    await ytdl(url).pipe(fs.createWriteStream(`${footageId}.mp4`));

    // TODO: Create functionality to queue parsing and return clips.
    parseClips(footageId, `${footageId}.mp4`);

    return await prisma.footage.create({
      data: {
        userId: id,
        youtubeUrl: url,
        videoFormat: defaultFormat ? defaultFormat.itag : lowFormat,
        footageType: type,
      },
    });
  },
});

/**
 * GET /footage/:id
 * @summary Endpoint to get a specific Footage document.
 * @return {FootageDocument} 200 - Success response returns the Footage document.
 * @return 404 - Footage with ID could not be found.
 */
export const getFootage = defaultEndpointsFactory.build({
  method: 'get',
  input: z.object({
    id: z.string().cuid(),
  }),
  output: FootageZodSchema,
  handler: async ({ input: { id }, options, logger }) => {
    const footage = await prisma.footage.findUnique({
      where: {
        id,
      },
    });

    if (footage === null)
      throw createHttpError(
        404,
        'No footage document with the UUID or type provided could be found.',
      );

    return footage;
  },
});

/**
 * GET /footage/user/:id
 * @summary Endpoint to get all Footage ids associated to a user.
 * @return {array<FootageDocument>} 200 - Success response returns the Footage ids.
 * @return 404 - No Footage found with the provided User ID.
 */
export const getUserFootage = defaultEndpointsFactory.build({
  method: 'get',
  input: z.object({
    // had to change to string because the param is sent as a string not as a number for some reason.
    id: z.string(),
  }),
  output: z.object({
    footage: z.array(
      z.object({
        id: z.string().cuid(),
      }),
    ),
  }),
  handler: async ({ input: { id }, options, logger }) => {
    const data = await prisma.user.findUnique({
      where: {
        id,
      },
      include: {
        footage: {
          select: {
            id: true,
          },
        },
      },
    });

    if (data === null || data.footage.length === 0)
      throw createHttpError(404, 'No footage found with the provided User ID.');

    return { footage: data.footage };
  },
});

/**
 * GET /footage/clips/:id
 * @summary Endpoint to get all Clip id associated to a specific Footage id.
 * @return {array<ClipDocument>} 200 - Success response returns the Footage document.
 * @return 404 - No Clips found for the provided Footage id.
 */
export const getFootageClips = defaultEndpointsFactory.build({
  method: 'get',
  input: z.object({
    id: z.string().cuid(),
  }),
  output: z.object({
    clips: z.array(
      z.object({
        id: z.string().cuid(),
      }),
    ),
  }),
  handler: async ({ input: { id }, options, logger }) => {
    const data = await prisma.footage.findUnique({
      where: {
        id,
      },
      include: {
        clips: {
          select: {
            id: true,
          },
        },
      },
    });

    if (data === null || data.clips.length === 0)
      throw createHttpError(
        404,
        'No clips found with the provided footage ID.',
      );

    return { clips: data.clips };
  },
});

/**
 * PATCH /footage/:id
 * @summary Endpoint to update a specific Footage document.
 * @return {FootageDocument} 200 - Success response returns the Footage document updated and a message.
 * @return {string} 200 - Success response returns the Footage document updated and a message.
 * @return 404 - No document with the provided UUID was found.
 * @return 418 - An error occured while attempting to update the FootageDocument.
 * @return 500 - Some internal error
 */
export const updateFootage = defaultEndpointsFactory.build({
  method: 'patch',
  input: FootageUpdateInputSchema,
  output: FootageZodSchema,
  handler: async ({
    input: { id, isAnalyzed, footageType },
    options,
    logger,
  }) => {
    try {
      const data = await prisma.footage.update({
        where: {
          id,
        },
        data: {
          isAnalyzed,
          footageType,
        },
      });

      return data;
    } catch (error) {
      // throws RecordNotFound if record not found to update
      // but can't import for some reason

      throw createHttpError(500, 'Something went wrong processing the video.');
    }
  },
});

/**
 * DELETE /footage/:id
 * @summary Endpoint to delete a specific Footage document.
 * @return 200 - Successfully deleted Footage document based on UUID.
 * @return 404 - Footage UUID not found.
 */
export const deleteFootage = defaultEndpointsFactory.build({
  method: 'delete',
  input: z.object({
    id: z.string().cuid(),
  }),
  output: z.object({
    message: z.string(),
  }),
  handler: async ({ input: { id }, options, logger }) => {
    try {
      await prisma.footage.delete({
        where: {
          id,
        },
      });
    } catch (error) {
      // throws RecordNotFound if record not found to update
      // but can't import for some reason

      throw createHttpError(500, 'Something went wrong processing the video.');
    }

    return { message: 'Footage deleted successfully.' };
  },
});
