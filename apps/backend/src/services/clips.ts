import path from 'path';
import cuid from 'cuid';
import * as fs from 'fs';
import * as fse from 'fs-extra';
import { spawn } from 'child_process';

import { prisma } from "./database";

function getDirectories(source: string) {
  return fs
    .readdirSync(source)
    .map(file => path.join(source, file))
    .filter(path => fs.statSync(path).isDirectory());
}

async function storeClips(id: string) {
  if (process.env.FS_LOCATION && !fs.existsSync(process.env.FS_LOCATION)) {
    await fs.mkdirSync(process.env.FS_LOCATION);
  }

  const clipDirs = await getDirectories('clips');
  for (const clipDir of clipDirs) {
    const uuid = cuid();
    const footageDir = `${process.env.FS_LOCATION}/${id}`;
    const clipLocation = `${footageDir}/${uuid}`;

    if (!fs.existsSync(footageDir)) {
      fs.mkdirSync(footageDir);
    }

    await fs.mkdirSync(clipLocation);
    await fse.copy(clipDir, clipLocation);

    // TODO: Submit new clip documents
    // await prisma.clip.create({
    //   data: {
    //     footageId: id,
    //     uuid,
    //   },
    // });
  }
}

export function parseClips(uuid: string, video: string): void {
  if (!fs.existsSync('clips')) {
    fs.mkdirSync('clips');
  }

  const pyPro = spawn('python3', ['autoClip.py', video, 'clips', '1']);

  pyPro.on('exit', async () => {
    const clipDirs = await getDirectories('clips');

    if (clipDirs.length > 0) {
      await storeClips(uuid);

      fs.rmSync('clips', { recursive: true, force: true });
      fs.rmSync(video, { force: true });

      // TODO: Submit update to cockroach DB
      // await prisma.footage.update({
      //   where: {
      //     id: uuid,
      //   },
      //   data: {
      //     isParsed: true,
      //   },
      // });
    }
  });
}
