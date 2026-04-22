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
end
