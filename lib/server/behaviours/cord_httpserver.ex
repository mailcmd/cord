defmodule CORD.HTTPServer do
  defmacro __using__(_opts) do
    quote do
      import Plug.Conn
      import unquote(__MODULE__)
      require Logger
      
      def init(options), do: options

      @before_compile unquote(__MODULE__)       
    end
  end
  

  defmacro __before_compile__(_env) do
    quote do
      # Default response for non legal calls
      def call(conn, _opts) do
        with list <- String.split(conn.request_path, "/"),             
             [_, module, fun] <- Enum.map(&String.to_atom/1),
             true <- function_exported?(Module.concat([module]), fun, 1) do
          Logger.log(:info, "[CORD][HTTP] Calling external function #{module}.#{fun}")
        else
          _ -> 
            Logger.log(:warning, "[CORD][HTTP] 404 - Try to get #{conn.request_path}")
        end
        conn
        |> put_resp_content_type("text/plain")
        |> send_resp(404, "404 Not Found!\n")
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
