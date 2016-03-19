import duplexer from 'duplexer2';
import {extract as TarExtract, pack as TarPack} from 'tar-stream';
import {Readable, Writable} from 'readable-stream';
import Vinyl from 'vinyl';

export class Extract extends Readable {
	constructor(tarExt) {
		super({objectMode: true});

		tarExt.on('entry', (header, contents, next) => {
			const v = new Vinyl({
				path: header.name,
				contents,
			});

			v.tarHeader = header;

			if (this.push(v)) next();
			else this.once('drain', next);
		});

		tarExt.once('finish', () => this.push(null));
	}

	_read() {
		// noop
	}
}

export function extract() {
	const tarExt = new TarExtract();
	return duplexer({readableObjectMode: true}, tarExt, new Extract(tarExt));
}

export class Pack extends Writable {
	constructor(tarPak) {
		super({objectMode: true});

		this._tarPak = tarPak;

		this.once('finish', () => this._tarPak.finalize());
	}

	_write(v, _, cb) {
		const bufs = [];
		v.contents.on('data', b => bufs.push(b));
		v.contents.once('end', () => {
			const header = Object.assign({}, v.tarHeader || {}, {name: v.path});
			this._tarPak.entry(header, Buffer.concat(bufs), cb);
		});
	}
}

export function pack() {
	const tarPak = new TarPack();
	return duplexer({writableObjectMode: true}, new Pack(tarPak), tarPak);
}
