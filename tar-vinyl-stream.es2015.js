import duplexer from 'duplexer2';
import {extract as TarExtract, pack as TarPack} from 'tar-stream';
import {Readable, Writable} from 'readable-stream';
import Vinyl from 'vinyl';

export class Extract extends Readable {
	constructor(tarExt) {
		super({objectMode: true});

		// streaming is not supported by tar-stream
		// https://github.com/mafintosh/tar-stream/issues/50
		tarExt.on('entry', (header, contents, next) => {
			const bufs = [];
			contents
				.on('data', b => bufs.push(b))
				.once('end', () => {
					const v = new Vinyl({
						path: header.name,
						contents: Buffer.concat(bufs),
					});

					v.tarHeader = header;

					if (this.push(v)) next();
					else this.once('drain', next);
				});
		});

		tarExt.once('finish', () => this.push(null));
	}

	_read() {
		// noop
	}
}

export function extract(options) {
	const tarExt = new TarExtract(options);
	return duplexer({readableObjectMode: true}, tarExt, new Extract(tarExt));
}

export class Pack extends Writable {
	constructor(tarPak) {
		super({objectMode: true});

		this._tarPak = tarPak;

		this.once('finish', () => this._tarPak.finalize());
	}

	_write(v, _, cb) {
		const header = Object.assign({}, v.tarHeader || {}, {name: v.relative});

		if (v.isBuffer()) this._tarPak.entry(header, v.contents, cb);
		else if (v.isStream()) v.contents.pipe(this._tarPak.entry(header)).once('end', cb);
		else cb(new TypeError(`${v} is not a buffer or stream`));
	}
}

export function pack(options) {
	const tarPak = new TarPack(options);
	return duplexer({writableObjectMode: true}, new Pack(tarPak), tarPak);
}
