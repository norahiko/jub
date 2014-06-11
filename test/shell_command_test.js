var fs = require('fs');
var jub = require('../lib/jub.js');
var taskModule = require('../lib/task.js');

var assert = require('chai').assert;
var equal = assert.strictEqual;
var deepEqual = assert.deepEqual;
var env = jub.env;
var root = process.cwd();


suite('Change directory command:', function() {
    setup(function () {
        process.chdir(root);
    });

    test('chdir', function () {
        jub.chdir('~');
        equal(process.cwd(), env.HOME);
    });

    test('pushd', function() {
        jub.pushd('test');
        assert.notEqual(process.cwd(), root);
        jub.popd();
        equal(process.cwd(), root);
    });
});


suite('Shell command:', function() {
    env.main = 'lib/main.txt';
    env.util = 'lib/util.txt';
    var testdir = 'test/data';

    setup(function() {
        /*
        create test files

        test
        └── data (current directory)
            ├── TESTDATA.txt
            ├── bin
            │   └── app
            └── lib
                ├── linkmain  -> main.txt
                ├── main.txt
                └── util.txt
        */
        process.chdir(root);
        jub.removeRecursive('test/data');
        fs.mkdirSync(testdir);
        process.chdir(testdir);
        fs.writeFileSync('TESTDATA.txt', 'testdata');
        // bin
        fs.mkdirSync('bin');
        fs.writeFileSync('bin/app', 'app');
        // lib
        fs.mkdirSync('lib');
        fs.writeFileSync('lib/main.txt', 'main');
        fs.writeFileSync('lib/util.txt', 'util');
        fs.symlinkSync('main.txt', 'lib/linkmain');
        taskModule.reset();
    });


    teardown(function () {
        process.chdir(root);
        taskModule.reset();
    });


    test('listdir', function() {
        deepEqual(jub.listdir(), ['TESTDATA.txt', 'bin', 'lib']);
        assert.notDeepEqual(jub.ls('~'), []);
        deepEqual(jub.ls('~'), jub.ls('$HOME'));
        deepEqual(
            jub.ls('*'),
            ['TESTDATA.txt', 'bin/app', 'lib/linkmain', 'lib/main.txt', 'lib/util.txt']
        );

        assert.throws(function() {
            jub.ls(['*.foo', '*.bar']);
        }, 'jub.listdir');
    });


    test('glob', function () {
        deepEqual(
            jub.glob('**/*.txt'),
            ['TESTDATA.txt', 'lib/main.txt', 'lib/util.txt']
        );
        deepEqual(
            jub.glob('**/cat.jpg'),
            []
        );
        deepEqual(
            jub.glob(['bin/*', 'TESTDATA.*']),
            ['bin/app', 'TESTDATA.txt']
        );
        jub.glob(1);
    });


    test('mkdir', function() {
        jub.mkdir('newdir');
        jub.mkdir('newdir'); // not throws Error
        assert(fs.statSync('newdir').isDirectory());

        assert.throws(function() {
            // not enough arguments
            jub.mkdir();
        }, 'jub.expand');

        assert.throws(function() {
            // already a file exists (not directory)
            jub.mkdir('TESTDATA.txt');
        }, 'EEXIST');
    });


    test('move', function() {
        // move file
        jub.move('$main', 'moved.txt');
        equal(fs.readFileSync('moved.txt', 'utf8'), 'main');
        assert(jub.notExists('$main'));
        // move file into directory
        jub.move('moved.txt', 'bin');
        equal(fs.readFileSync('bin/moved.txt', 'utf8'), 'main');
        assert(jub.notExists('moved.txt'));
        // move directory
        jub.move('bin', 'lib');
        equal(fs.readFileSync('lib/bin/moved.txt', 'utf8'), 'main');
        assert(jub.notExists('bin'));

        assert.throws(function() {
            // not enough arguments
            jub.move('TESTDATA.txt');
        }, 'jub.expand');

        assert.throws(function () {
            // source is not exists
            jub.move('not_exists_file', 'foo');
        }, 'jub.move');

        assert.throws(function () {
            // move current directory
            jub.move('./', 'lib');
        }, 'EBUSY');
        assert.throws(function () {
            // move directory into self
            jub.move('lib', 'lib');
        }, 'EINVAL');
    });


    test('move files', function() {
        jub.move('lib/*.txt', 'bin');
        deepEqual(fs.readdirSync('bin'), ['app', 'main.txt', 'util.txt']);
    });


    test('copy', function() {
        jub.copy('$main', 'lib/copy.txt');
        equal(jub.readFile('lib/copy.txt'), 'main');
        jub.copy('lib', 'copylib');
        equal(jub.readFile('copylib/main.txt'), 'main');
        assert(jub.exists('$main'));
        assert(jub.exists('$util'));

        jub.copy('lib', 'copylib');
        equal(jub.readFile('copylib/lib/main.txt'), 'main');

        assert.throws(function() {
            // not enough arguments
            jub.copy('TESTDATA.txt');
        }, 'jub.expand');

        assert.throws(function() {
            // copy directory to file
            jub.copy('lib', 'TESTDATA.txt');
        }, 'ENOTDIR');
    });


    test('copy link', function() {
        fs.mkdirSync('pack');
        fs.symlinkSync('lib', 'linkdir');

        jub.copy(['bin', 'lib', 'linkdir'], 'pack');
        assert(fs.lstatSync('pack/lib/linkmain').isSymbolicLink());
        equal(fs.readFileSync('pack/lib/linkmain', 'utf8'), 'main');

        assert(fs.lstatSync('pack/linkdir').isSymbolicLink());
        equal(fs.readFileSync('pack/linkdir/main.txt', 'utf8'), 'main');

        // replace link
        jub.copy('linkdir', 'lib/linkmain');
        equal(fs.readlinkSync('lib/linkmain'), 'lib');
    });


    test('copy files', function() {
        jub.copy(['$main', '$util'], 'bin');
        equal(jub.readFile('bin/main.txt'), 'main');
        equal(jub.readFile('bin/util.txt'), 'util');
    });


    test('remove', function() {
        jub.remove('lib/main.txt');
        assert(fs.existsSync('lib/main.txt') === false);

        assert.doesNotThrow(function() {
            jub.remove('not_exists_file');
        });

        assert.throws(function() {
            // cannot remove directory
            jub.remove('lib');
        }, 'EISDIR');
    });


    test('removeRecursive', function() {
        jub.removeRecursive('lib');
        assert(fs.existsSync('lib') === false);

        assert.doesNotThrow(function() {
            jub.removeRecursive('not_exists_dir');
        });
    });


    test('concat', function() {
        equal(jub.concat(['$main', '$util']), 'main\nutil');
        equal(jub.concat(['$main', '$util'], '\n-----\n'), 'main\n-----\nutil');

        assert.throws(function() {
            jub.concat(['not_exists_file.*']);
        }, 'jub.concat');
    });


    test('concatBuffer', function() {
        var result = jub.concatBuffer(['$main', '$util']);
        assert.instanceOf(result, Buffer);
        equal(result.toString(), 'mainutil');

        assert.throws(function() {
            jub.concatBuffer(['not_exists_file.*']);
        }, 'jub.concat');
    });


    test('append', function() {
        jub.append('$main', '1');
        jub.append('$main', '2');
        equal(jub.readFile('$main'), 'main12');
    });


    test('prepend', function() {
        jub.prepend('$main', '2');
        jub.prepend('$main', '1');
        equal(jub.readFile('$main'), '12main');
    });


    test('replace', function() {
        var contents = [];
        jub.replace('TESTDATA.txt', /.+/g, function(match) {
            contents.push(match);
            return 'replaced';
        });

        jub.replace('TESTDATA.txt', /replaced/g, function (match) {
            contents.push(match);
            return 'testdata';
        });
        deepEqual(contents, ['testdata', 'replaced']);
    });


    test('tempfile', function() {
        var tempfile = jub.tempfile('temp');
        equal(jub.readFile(tempfile), 'temp');
    });


    test('modified', function(/* done */) {
        equal(jub.modified('$main'), true);
        equal(jub.modified('$main'), false);

        // this test is too slow
        //setTimeout(function() {
            //jub.writeFile('$main', 'changed');
            //equal(jub.modified('$main'), true);
            //done();
        //}, 1000);
    });


    test('watch', function(done) {
        var watcher = jub.watch('lib/*.txt', ['A', 'B'], function() {
            watcher.close();
            deepEqual(called, ['A', 'B']);
            var modified = watcher.getModifiedFiles();
            equal(modified.length, 2);
            equal(modified[0].slice(-12), 'lib/main.txt');
            equal(modified[1].slice(-12), 'lib/util.txt');

            equal(watcher.getModifiedFiles().length, 0);
            done();
        });

        var called = [];

        jub.task('A', function() {
            called.push('A');
        });

        jub.task('B', function() {
            called.push('B');
        });

        equal(watcher.files.length, 2);
        jub.append('lib/main.txt', 'add');
        jub.append('lib/util.txt', 'add');
    });
});
