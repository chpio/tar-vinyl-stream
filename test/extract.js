import fs from 'fs';
import path from 'path';
import util from 'util';
import {extract} from '..';
import getStream from 'get-stream';
import {pipeline} from 'readable-stream';
import test from 'ava';

const fixtures = path.join(__dirname, 'fixtures');
const pump = util.promisify(pipeline);
const readFile = util.promisify(fs.readFile);

test('extract', async t => {
	const src = fs.createReadStream(path.join(fixtures, 'tarballs', 'files-bare.tar'));
	const e = extract();

	await pump(src, e);

	const files = await getStream.array(e);
	const contents = await Promise.all(files.map(file => readFile(path.join(fixtures, 'files', file.basename))));

	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		const buffer = contents[i];

		t.deepEqual(file.contents, buffer);
	}
});
