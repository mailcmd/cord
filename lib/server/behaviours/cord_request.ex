defmodule CORD.Request do
  defmacro __using__(_opts) do
    quote do
      import Plug.Conn
      import unquote(__MODULE__)
      require Logger
      @http_config Application.compile_env(:cord, :http)
      @http_server_id Application.compile_env(
                        :cord,
                        [:local_config, :http_server_id],
                        @http_config[:http_server_id]
                      )

    end
  end
  
  defmacro request(fun, do: block) do
    quote do
      def unquote(fun)(var!(conn), var!(params) \\ nil) do
        _ = var!(params)
        var!(conn) = put_resp_header(var!(conn), "server", @http_server_id)
        unquote(block)
      end
    end
  end

  defmacro request(:get, fun, do: block) do
    quote do
      def unquote(fun)(%{method: "GET"} = var!(conn), var!(params) \\ nil) do
        _ = var!(params)
        var!(conn) = put_resp_header(var!(conn), "server", @http_server_id)
        unquote(block)
      end
    end
  end

  defmacro request(:post, fun, do: block) do
    quote do
      def unquote(fun)(%{method: "POST"} = var!(conn), var!(params) \\ nil) do
        _ = var!(params)
        var!(conn) = put_resp_header(var!(conn), "server", @http_server_id)
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
