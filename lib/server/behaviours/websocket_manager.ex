defmodule CORD.Websocket.Manager do
	defmacro __using__(_) do
    quote do
      @behaviour unquote(__MODULE__)
      
      require Logger
  
      defp reply(state, msg) when is_map(msg), do: {state, JSON.encode!(msg)}
      defp reply(state, msg), do: {state, msg}
      
      defp assign(state, key, value) do
        Map.put(state, key, value)
      end
    end
	end
  
  @callback process_connection(conn :: map(), event :: atom()) :: :ok
  @callback process_events(events :: list()) :: :ok
  @callback process_message(msg :: map(), state :: map())
              :: {state :: map, msg :: binary}
end
