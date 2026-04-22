defmodule CORD.Application do
  @moduledoc false

  use Application
  require Logger

  @config Application.compile_env!(:cord, :http)
  @local_config Application.compile_env!(:cord, :local_config)

  @impl true
  def start(_type, _args) do
    Logger.configure(level: Application.get_env(:logger, :level))

    children = [
      # The HTTP Server
      {
        Plug.Cowboy,
        scheme: :http,
        plug: {CORD.Webserver, @config},
        options: [
          port: Keyword.get(@local_config, :port, Keyword.fetch!(@config, :port)),
          dispatch: dispatcher()
        ]
      },
      # Channels manager
      {CORD.ChannelsMaster, [:broadcast]},
      # Events manager
      {CORD.EventsMaster,
        {
          Keyword.get(@local_config, :events_pop_interval),
          Keyword.get(@local_config, :websocket_manager)
        }               
      },
      # Permanent Storage
      {CORD.PermanentStorage, []},      
      # User defined APP 
      @local_config[:app_supervisor]
    ]

    opts = [strategy: :one_for_one, name: CORD.Supervisor]
    
    Logger.log(:notice, "[CORD] Starting CORD services...")
    Supervisor.start_link(children, opts)
  end

  defp dispatcher do
    [
      {:_,
       [
         {
           "/websocket", CORD.Websocket, [
             websocket_manager: Keyword.get(@local_config, :websocket_manager)
           ]
         },
         {:_, Plug.Cowboy.Handler, {CORD.Webserver, @config}},
       ]
      }
    ]
  end  
end
