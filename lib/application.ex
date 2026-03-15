defmodule CORD.Application do
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do

    http_config = Application.get_env(:cord, :http)
    
    children = [
      # The HTTP Server
      # {Plug.Cowboy, scheme: :http, plug: CORD.Plug, options: [port: 8080]}
      {Plug.Cowboy,
       scheme: :http,
       plug: CORD.Router,
       options: [port: Keyword.fetch!(http_config, :port)]
      }
    ]

    opts = [strategy: :one_for_one, name: CORD.Supervisor]
    
    Logger.log(:info, "[CORD] Starting CORD services...")
    Supervisor.start_link(children, opts)
  end
end
