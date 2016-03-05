var Stream = function()
{
	var _this = this;

	var data = [];
	var opens = 0;
	var element_callbacks = [];
	var close_callbacks = [];

	_this.open = function()
	{
		opens++;
	};
	_this.close = function()
	{
		opens--;
		if (opens < 0)
		{
			throw new Error('Cannot close an un-opened stream!');
		}
		else if (opens === 0)
		{
			for (var i = 0; i < close_callbacks.length; i++)
			{
				close_callbacks[i](data);
			}
			close_callbacks = [];
		}
	};

	_this.push = function()
	{
		if (opens === 0)
		{
			throw new Error('Cannot push to an un-opened stream');
		}

		_this.open();
		Stream.flatten(arguments, function(args)
		{
			for (var i = 0; i < args.length; i++)
			{
				var index = data.length;
				data.push(args[i]);
				for (var j = 0; j < element_callbacks.length; j++)
				{
					element_callbacks[j](index);
				}
			}
			_this.close();
		});
	};

	_this.map = function(element_callback)
	{
		var res = new Stream();

		var bound_element_callback = function(index)
		{
			element_callback(data[index], res);
		}

		res.open();
		for (var i = 0; i < data.length; i++)
		{
			bound_element_callback(i);
		}
		element_callbacks.push(bound_element_callback);
		_this.on_close(res.close);

		return res;
	};

	_this.unique = function()
	{
		var res = new Stream();

		var bound_element_callback = function(index)
		{
			if (data.indexOf(data[index]) === index)
			{
				res.push(data[index]);
			}
		}

		res.open();
		for (var i = 0; i < data.length; i++)
		{
			bound_element_callback(i);
		}
		element_callbacks.push(bound_element_callback);
		_this.on_close(res.close);

		return res;
	};

	_this.into = function(dst_stream)
	{
		var bound_element_callback = function(index)
		{
			dst_stream.push(data[index]);
		}

		dst_stream.open();
		for (var i = 0; i < data.length; i++)
		{
			bound_element_callback(i);
		}
		element_callbacks.push(bound_element_callback);
		_this.on_close(dst_stream.close);
	};

	_this.on_close = function(close_callback)
	{
		if (opens)
		{
			close_callbacks.push(close_callback);
		}
		else
		{
			close_callback(data);
		}
	};

	_this.block = function(stream)
	{
		stream.open();
		_this.on_close(stream.close);
	};

	_this.open();
	_this.push.apply(null, arguments);
	_this.close();
};

Stream.flatten = function(arr, callback)
{
	var res = [];
	var index = 0;

	var append_and_continue = function(new_arr)
	{
		res = res.concat(new_arr);
		index++;
		resolve_streams();
	}

	var resolve_streams = function()
	{
		var first_index = index;
		var is_arr = false;
		var is_stream = false;
		while (index < arr.length)
		{
			if (is_arr = arr[index] instanceof Array) {break;}
			else if (is_stream = arr[index] instanceof Stream) {break;}
			index++;
		}

		res = res.concat(Array.prototype.slice.call(arr, first_index, index));

		if (is_arr)
		{
			Stream.flatten(arr[index], append_and_continue);
		}
		else if (is_stream)
		{
			arr[index].on_close(function(data)
			{
				Stream.flatten(data, append_and_continue);
			});
		}
		else
		{
			callback(res);
		}
	};
	resolve_streams();
};

module.exports = Stream;