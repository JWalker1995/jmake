var fs = require('fs');
var child_process = require('child_process');
var glob = require('glob');
var Stream = require('./stream');

var JMake = {};

JMake.THREADS_LIMIT = 5;

JMake.Stream = Stream;

JMake.glob = function(path)
{
	var res = new Stream();

	res.open();
	glob(path, {}, function (err, files)
	{
		if (err) {throw err;}
		res.push(files);
		res.close();
	});

	return res;
};


var spawn_queue = [];
var spawn_pending = 0;
JMake.spawn = function(command, args)
{
	var res = new Stream();
	res.open();

	var run = function()
	{
		console.log(command + ' ' + args.join(' '));

		var proc = child_process.spawn(command, args);

		var out = '';
		proc.stdout.on('data', function(data) {out += data;});

		var err = '';
		proc.stderr.on('data', function(data) {err += data;});

		proc.on('close', function(code)
		{
			if (code)
			{
				console.error(err);
				throw new Error(JSON.stringify(command) + ' with arguments ' + JSON.stringify(args) + ' returned ' + code);
			}

			if (spawn_queue.length)
			{
				spawn_queue.pop()();
			}
			else
			{
				spawn_pending--;
			}

			res.push(out);
			res.close();
		});
	};

	Stream.flatten(args, function(new_args)
	{
		args = new_args;

		if (spawn_pending < JMake.THREADS_LIMIT)
		{
			spawn_pending++;
			run();
		}
		else
		{
			spawn_queue.push(run);
		}
	});

	return res;
};

JMake.needs_rebuild = function(target, sources, rebuild_callback, skip_callback)
{
	var mod_time = new Date(0);
	var source_block = sources.map(function(source)
	{
		source_block.open();
		fs.stat(source, function(err, stats)
		{
			if (err) {throw err;}
			if (stats.mtime > mod_time)
			{
				mod_time = stats.mtime;
			}
			source_block.close();
		});
	});

	fs.stat(target, function(err, stats)
	{
		if (err)
		{
			if (err.code === 'ENOENT')
			{
				stats = {'mtime': new Date(0)};
			}
			else
			{
				throw err;
			}
		}

		source_block.on_close(function()
		{
			if (mod_time >= stats.mtime)
			{
				rebuild_callback();
			}
			else if (typeof skip_callback === 'function')
			{
				skip_callback();
			}
		});
	});
};

JMake.extract_params = function(str, regex, params)
{
	if (typeof params !== 'object') {params = {};}

	var match;
	while (match = regex.exec(str))
	{
		var key = match[1].toLowerCase();
		if (typeof params[key] === 'undefined')
		{
			params[key] = [];
		}
		params[key].push(match[2]);
	}

	return params;
};

module.exports = JMake;
