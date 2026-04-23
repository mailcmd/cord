defmodule CORD.Request do
  defmacro __using__(_opts) do
    quote do
      import Plug.Conn
      import unquote(__MODULE__)
      require Logger

    end
  end
  
  defmacro request(fun, do: block) do
    quote do
      def unquote(fun)(var!(conn), var!(params)) do
        unquote(block)
      end
    end
  end

  defmacro response(response_text) do
    quote do
      assign(var!(conn), :text, unquote(response_text))
    end
  end

  defmacro response_type(type) do
    quote do
      var!(conn) = put_resp_content_type(var!(conn), unquote(type))
    end
  end
end
