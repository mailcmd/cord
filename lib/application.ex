defmodule CORD.Application do
  @moduledoc false

  use Application
  require Logger

  @config Application.compile_env!(:cord, :http)

  @impl true
  def start(_type, _args) do

    http_config = Application.get_env(:cord, :http)
    
    children = [
      # The HTTP Server
      {
        Plug.Cowboy,
        scheme: :http,
        plug: {CORD.Webserver, @config},
        options: [
          port: Keyword.fetch!(http_config, :port),
          dispatch: dispatcher()
        ]
      }
    ]

    opts = [strategy: :one_for_one, name: CORD.Supervisor]
    
    Logger.log(:info, "[CORD] Starting CORD services...")
    Supervisor.start_link(children, opts)
  end

  defp dispatcher do
    [
      {:_,
       [
         {"/websocket", CORD.Websocket, []},
         {:_, Plug.Cowboy.Handler, {CORD.Webserver, @config}},
       ]
      }
    ]
  end  
end
