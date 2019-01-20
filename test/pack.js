import fs from 'fs';
import path from 'path';
import {promisify} from 'util';
import {spawn} from 'child_process';
import BufferList from 'bl';
import Duplexify from 'duplexify';
import File from 'vinyl';
import {Readable, pipeline} from 'readable-stream';
import {pack} from '..';
import test from 'ava';

fs.readFile = promisify(fs.readFile);
fs.stat = promisify(fs.stat);

function tarCommand() {
	// Cannot use tar verbose because it uses stderr
	const tar = spawn('tar', ['-x', '--to-stdout'], {
		cwd: __dirname
	});
	const stream = new Duplexify(tar.stdin, tar.stdout);

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
	stream.on('removeListener', (event, listener) => tar.on(event, listener));

	return stream;
}

test('pack', async t => {
	const aFilename = path.join(__dirname, 'fixtures', 'a.txt');
	const bFilename = path.join(__dirname, 'fixtures', 'b.txt');
	const src = new Readable({objectMode: true, read() {}});
	const finish = new Promise((resolve, reject) => {
		const dest = new BufferList((err, buffer) => {
			if (err) {
				reject(err);
			} else {
				resolve(buffer);
			}
		});

		pipeline(src, pack({cwd: __dirname, base: __dirname}), tarCommand(), dest, err => {
			if (err) {
				reject(err);
			}
		});
	});

	const load = [];

	for (const filename of [aFilename, bFilename]) {
		load.push(filename, fs.readFile(filename), fs.stat(filename));
	}

	const loaded = await Promise.all(load);

	for (let i = 0; i < loaded.length; i += 3) {
		const [filename, contents, stat] = loaded.slice(i, i + 3);

		src.push(new File({
			cwd: __dirname,
			base: __dirname,
			contents,
			path: filename,
			stat
		}));
	}

	src.push(null);

	const buffer = await finish;
	const expected = Buffer.from('a content\nb content\n');

	t.deepEqual(buffer, expected);
});
