import fs from 'fs';
import path from 'path';
import util from 'util';
import getStream from 'get-stream';
import {pipeline} from 'readable-stream';
import {pack} from '..';
import test from 'ava';
import vfs from 'vinyl-fs';

const fixtures = path.join(__dirname, 'fixtures');
const pump = util.promisify(pipeline);
const readFile = util.promisify(fs.readFile);

test('pack', async t => {
	const cwd = path.join(fixtures, 'files');
	const src = vfs.src('{a,b}.txt', {cwd});
	const p = pack({cwd});

	await pump(src, p, fs.createWriteStream('/tmp/pack.tar'));

	const contents = await getStream.buffer(p);
	const buffer = await readFile(path.join(fixtures, 'tarballs', 'files-bare.tar'));

	t.deepEqual(contents, buffer);
});
