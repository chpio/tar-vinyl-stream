# tar-vinyl-stream

*tar-vinyl-stream* exposes two streams, *pack* and *extract*.


## Pack
The *pack* stream consumes a stream of *vinyl* objects and generates a tar file stream.

```javascript
import {pack} from 'tar-vinyl-stream';
import * as fs from 'fs';
import gulp from 'gulp';
import debug from 'gulp-debug';

gulp.src('./src/*.js')
	.pipe(debug())
	.pipe(pack())
	.pipe(fs.createWriteStream('./my-files.tar'));
```

## Extract
The *extract* stream consumes a tar stream and emits *vinyl* objects for each containing file.

```javascript
import {extract} from 'tar-vinyl-stream';
import * as fs from 'fs';
import gulp from 'gulp';
import debug from 'gulp-debug';

fs.createReadStream('./my-files.tar')
	.pipe(extract())
	.pipe(debug())
	.pipe(...) // use gulp plugins
	.pipe(gulp.dest('./my-tar'));
```

*extract* also exposes the [tar header](https://www.npmjs.com/package/tar-stream#headers). You can use it for any purpose, eg filtering the files:
```javascript
import {extract} from 'tar-vinyl-stream';
import * as fs from 'fs';
import gulp from 'gulp';
import debug from 'gulp-debug';
import filter from 'through2-filter';

fs.createReadStream('./my-files.tar')
	.pipe(extract())
	.pipe(debug())
	// allow only files
	.pipe(filter.obj(f => f.tarHeader.type === 'file'))
	.pipe(debug())
	.pipe(gulp.dest('./dest'));

```
