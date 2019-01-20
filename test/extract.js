import * as fs from 'fs';
import * as path from 'path';
import {promisify} from 'util';
import {spawn} from 'child_process';
import BufferList from 'bl';
import {extract} from '..';
import getStream from 'get-stream';
import {pipeline} from 'readable-stream';
import test from 'ava';

const bufferFile = promisify(fs.readFile);

function tarCommand(...filenames) {
	const child = spawn('tar', ['-c', '--', ...filenames], {
		cwd: __dirname
	});
	const stream = child.stdout;

	child.stderr.pipe(new BufferList((err, stderr) => {
		const data = stderr ? stderr.toString().trim() : null;

		err = err || (data && new Error(data));

		if (err) {
			stream.destroy(err);
		}
	}));

	child.once('exit', (exitCode, signal) => {
		stream.exitCode = exitCode;

		if (exitCode > 0) {
			const err = new Error(`tar exitCode=${exitCode} signal=${signal}`);

			stream.destroy(err);
		}
	});

	stream.on('addListener', (event, listener) => child.on(event, listener));
	stream.on('removeListener', (event, listener) => child.removeListener(event, listener));

	return stream;
}

test('extract', async t => {
	const a = 'fixtures/a.txt';
	const b = 'fixtures/b.txt';
	const aContents = bufferFile(path.join(__dirname, a));
	const bContents = bufferFile(path.join(__dirname, b));
	const f = getStream.array(pipeline(
		tarCommand(a, b),
		extract({cwd: __dirname, base: __dirname}),
		err => err && console.error(err)
	));
	const [files, aBuffer, bBuffer] = await Promise.all([f, aContents, bContents]);

	t.deepEqual(files[0].contents, aBuffer);
	t.deepEqual(files[1].contents, bBuffer);
});
