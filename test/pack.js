import path from 'path';
import getStream from 'get-stream';
import {pack} from '..';
import {pipeline} from 'readable-stream';
import tarFs from 'tar-fs';
import test from 'ava';
import vfs from 'vinyl-fs';

const fixtures = path.join(__dirname, 'fixtures');

test('pack', async t => {
	const cwd = path.join(fixtures, 'files');
	const src = vfs.src('{a,b}.txt', {cwd});
	const dest = pack({cwd});

	pipeline(src, dest, err => err && t.fail(err));

	const contents = await getStream.buffer(dest);
	const correct = await getStream.buffer(tarFs.pack(cwd));

	for (const chunk of compareTarballChunks(correct, contents)) {
		t.true(chunk);
	}
});

function * compareTarballChunks(correct, testing) {
	// The correct archive may be longer because it has directories that are not part of the assertion
	yield testing.length <= correct.length;

	for (let i = 0; i < testing.length; i += 512) {
		const chunk = testing.slice(i, i + 512);

		// Position of this result does not matter, just that the chunk exists in the correct archive
		yield correct.includes(chunk);
	}
}
