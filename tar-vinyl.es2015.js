import duplexer from 'duplexer2';
import {extract as TarExtract, pack as TarPack} from 'tar-stream';
import {Readable, Writable} from 'readable-stream';
import Vinyl from 'vinyl';

export class Extract extends Readable {
	constructor(tarExt, options = {}) {
		super({objectMode: true});

		tarExt.on('entry', (header, contents, next) => {
			if (options.buffer) {
				const bufs = [];
				contents
					.on('data', b => bufs.push(b))
					.once('end', () => {
						this._processItem(header, Buffer.concat(bufs), next);
					});
			} else {
				this._processItem(header, contents, next);
			}
		});

		tarExt.once('finish', () => this.push(null));
	}

	_read() {
		// noop
	}

	_processItem(header, contents, next) {
		const v = new Vinyl({
			path: header.name,
			contents,
		});

		v.tarHeader = header;

		if (this.push(v)) next();
		else this.once('drain', next);
	}
}

export function extract(options) {
	const tarExt = new TarExtract(options);
	return duplexer({readableObjectMode: true}, tarExt, new Extract(tarExt, options));
}

export class Pack extends Writable {
	constructor(tarPak) {
		super({objectMode: true});

		this._tarPak = tarPak;

		this.once('finish', () => this._tarPak.finalize());
	}

	_write(v, _, cb) {
		const header = Object.assign({}, v.tarHeader || {}, {name: v.path});

		if (v.isBuffer()) this._tarPak.entry(header, v.contents, cb);
		else if (v.isStream()) v.contents.pipe(this._tarPak.entry(header)).once('end', cb);
		else cb(new TypeError(`${v} is not a buffer or stream`));
	}
}

export function pack(options) {
	const tarPak = new TarPack(options);
	return duplexer({writableObjectMode: true}, new Pack(tarPak, options), tarPak);
}
