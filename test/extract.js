import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
import {spawn} from 'child_process';
import BufferList from 'bl';
import {extract} from '..';
import getStream from 'get-stream';
import {pipeline} from 'readable-stream';
import test from 'ava';

const bufferFile = promisify(fs.readFile);
const pump = promisify(pipeline);

function tarCommand(...filenames) {
	const tar = spawn('tar', ['-c', '--', ...filenames], {
		cwd: __dirname
	});
	const stream = tar.stdout;

	tar.stderr.pipe(new BufferList((err, stderr) => {
		const data = stderr ? stderr.toString().trim() : null;

		err = err || (data && new Error(data));

		if (err) {
			stream.destroy(err);
		}
	}));

	tar.once('exit', (exitCode, signal) => {
		stream.exitCode = exitCode;

		if (exitCode > 0) {
			const err = new Error(`tar exitCode=${exitCode} signal=${signal}`);

			stream.destroy(err);
		}
	});

	stream.on('addListener', (event, listener) => tar.on(event, listener));
	stream.on('removeListener', (event, listener) => tar.removeListener(event, listener));

	return stream;
}

test('extract', async t => {
	const a = 'fixtures/a.txt';
	const b = 'fixtures/b.txt';
	const aContents = bufferFile(path.join(__dirname, a));
	const bContents = bufferFile(path.join(__dirname, b));
	const e = extract({
		cwd: __dirname,
		base: __dirname
	});

	await pump(tarCommand(a, b), e);

	const [files, aBuffer, bBuffer] = await Promise.all([getStream.array(e), aContents, bContents]);

	t.deepEqual(files[0].contents, aBuffer);
	t.deepEqual(files[1].contents, bBuffer);
});
