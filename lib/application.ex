defmodule CORD.Application do
  @moduledoc false

  use Application
  require Logger

  @config Application.compile_env!(:cord, :http)
  @local_config Application.compile_env(:cord, :local_config, [])

  @impl true
  def start(_type, _args) do
    Logger.configure(level: Application.get_env(:logger, :level))

    port = Keyword.get(@local_config, :port, Keyword.fetch!(@config, :port)) 
    sport = Keyword.get(@local_config, :https_port, Keyword.fetch!(@config, :https_port))
    http_server =
      [
        {
          Plug.Cowboy,
          scheme: :http,
          plug: {CORD.Webserver, @config},
          options: [
            port: port,
            dispatch: dispatcher()
          ]
        }
      ]
      ++
      if @local_config[:https] do
        [{
          Plug.Cowboy,
          scheme: :https,
          plug: {CORD.Webserver, @config},
          options: [
            port: sport,
            dispatch: dispatcher(),
            keyfile: Keyword.get(@local_config, :keyfile),
            certfile: Keyword.get(@local_config, :certfile),
            otp_app: :secure_app          
          ]
        }]
      else
        []
      end

    children = http_server ++ [
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
      {CORD.PermanentStorage, []}
    ]
    # User defined APP
    ++ (@local_config[:app_supervisor] && [@local_config[:app_supervisor]] || [])

    opts = [strategy: :one_for_one, name: CORD.Supervisor]

    Logger.log(:notice,
               "[CORD] Starting CORD services in ports "<>
               "#{port} #{@local_config[:https] && sport || ""}..."
    )
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
