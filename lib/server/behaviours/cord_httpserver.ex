defmodule CORD.HTTPServer do
  defmacro __using__(_opts) do
    quote do
      import Plug.Conn
      import unquote(__MODULE__)
      require Logger

      def init(options), do: options
      defp build_resp(%Plug.Conn{} = conn) do
        send_resp(conn, 200, conn.assigns[:text] || "")
      end
      defp build_resp(_) do
        throw("Not a connection!!")
      end

      @before_compile unquote(__MODULE__)
    end
  end


  defmacro __before_compile__(_env) do
    quote do
      # Default response for non legal calls
      def call(conn, _opts) do
        with list <- String.split(conn.request_path, "/"),
             [_, module, [fun] | _] <- Enum.map(list, fn s ->
               s |> String.split(".") |> Enum.map(&String.to_atom/1)
             end),
             [module, fun] <- [Module.concat(module), fun],
             _ <- Code.ensure_loaded(module),
             true <- function_exported?(module, fun, 2) do
          
          # TODO: Security control, module name starting with "<app_name>."
          try do
            extra_params =
              list
              |> :lists.sublist(4, 99)
              |> Enum.map(fn p ->
                case Regex.scan(~r/(?:\((.+?)\)|)(.+)/, p) do
                  [[_, "", value]] -> value
                  [[_, type, value]] -> apply(String, String.to_atom("to_#{type}"), [value])
                  _ -> nil
                end
              end)
            Logger.log(
              :notice,
              "[CORD][HTTP] Calling external function #{module}.#{fun}(#{inspect extra_params})"
            )            
            module
            |> apply(fun, [conn, extra_params])
            |> build_resp()
          rescue
            e ->
              Logger.log(
                :error,
                "[CORD][HTTP] Function #{module}.#{fun} does not return a connection struct" <>
                "\n#{inspect e}"
              )
              send_resp(conn, 500, "Internal server error!\n")
          end
          
        else
          _ ->
            Logger.log(:warning, "[CORD][HTTP] 404 - Try to get #{conn.request_path}")
            conn
            |> put_resp_content_type("text/plain")
            |> send_resp(404, "404 Not Found!\n")
        end
      end
    end
  end


	defmacro get(path, do: block) do
    quote do
      def call(
            %{method: "GET", request_path: unquote(path)} = var!(conn),
            var!(opts)
          ) do
        _ = var!(opts)
        unquote(block)
      end
    end
  end

	defmacro post(path, do: block) do
    quote do
      def call(
            %{method: "POST", request_path: unquote(path)} = var!(conn),
            var!(opts)
          ) do
        _ = var!(opts)
        unquote(block)
      end
    end
  end
  ###################################################################################
  # Utils
  ###################################################################################
  # def expand_html(html) do
  #   html
  #   |> expand_for()
  # end

  # def expand_for(html) do
  #   matchs =
  #     ~r/:foreach[\t ]+(.+?)[\t ]+in[\t ]+(.+?)[\t ]+:do(.+?):end/s
  #     |> Regex.scan(html, capture: :all)

  #   replaces =
  #     matchs
  #     |> Enum.map(fn [_, r, rows, body] ->
  #       """
  #       ${#{rows}.map( __#{r}__ => { return `
  #       #{body}
  #       `}).join('')}
  #       """
  #       |> String.replace(":{#{r}.", "${__#{r}__.")
  #     end)

  #   matchs
  #   |> Enum.with_index()
  #   |> Enum.reduce(html, fn {[str, _, _, _], i}, acc ->
  #     String.replace(acc, str, Enum.at(replaces, i))
  #   end)
  # end
end
